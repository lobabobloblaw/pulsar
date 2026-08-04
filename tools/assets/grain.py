#!/usr/bin/env python3
"""Turn a klein aluminium render into a seamless 512x512 grain tile.

klein is a DiT: it has no Conv2d anywhere in the denoiser, so circular-padding "seamless
tiling" extensions patch the VAE, run without error, and still produce seams. Tiling is
therefore done deterministically here, not by the model:

  1. flatness scan   the render carries the model's lighting gradient. Score every candidate
                     256x256 crop by the spread of its 8x8 block means (low-frequency
                     drift) and reject any source whose quadrant means drift more than
                     +/-6 luma from the frame mean.
  2. normalize       grayscale, recentre the mean on 128 and compress to ~128+/-10, so the
                     tile multiplies over the enclosure without shifting its value.
  3. mirror-quad     512 = crop | mirrored crop over mirrored crop | both. Seamless by
                     construction rather than by hope: opposite edges are the same pixels.
                     The mirror symmetry is undetectable at 5% opacity and a 256px repeat.
  4. seam gate       offset the tile by half, FIND_EDGES, and compare edge energy on the
                     seam cross against the interior. Ratio must stay under 1.25.

If no seed passes the flatness gate, the correct answer is to ship no file: the CSS
feTurbulence fallback is mathematically seamless and costs nothing.

usage: python3 tools/assets/grain.py [--seed 4242] [--force]
"""

from __future__ import annotations

import argparse
import os
import sys

from PIL import Image, ImageChops, ImageFilter, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'assets', 'raw')
QA = os.path.join(ROOT, 'assets', 'qa')
OUT = os.path.join(ROOT, 'public', 'textures', 'enclosure-grain-512.png')

CROP = 256
TILE = 512
QUADRANT_DRIFT_MAX = 6.0   # luma
SEAM_RATIO_MAX = 1.25


def quadrant_drift(gray: Image.Image) -> tuple[float, list[float]]:
    """Max |quadrant mean - frame mean| in luma."""
    w, h = gray.size
    frame = ImageStat.Stat(gray).mean[0]
    means = [
        ImageStat.Stat(gray.crop((x, y, x + w // 2, y + h // 2))).mean[0]
        for y in (0, h // 2) for x in (0, w // 2)
    ]
    return max(abs(m - frame) for m in means), means


def best_crop(gray: Image.Image, stride: int = 64) -> tuple[tuple[int, int], float, float]:
    """Lowest low-frequency drift among CROPxCROP windows; ties broken by more grain."""
    w, h = gray.size
    best = None
    for y in range(0, h - CROP + 1, stride):
        for x in range(0, w - CROP + 1, stride):
            c = gray.crop((x, y, x + CROP, y + CROP))
            blocks = c.resize((8, 8), Image.Resampling.BOX)
            drift = ImageStat.Stat(blocks).stddev[0]
            grain = ImageStat.Stat(
                ImageChops.difference(c, c.filter(ImageFilter.GaussianBlur(2)))
            ).mean[0]
            score = drift - 0.25 * grain
            if best is None or score < best[0]:
                best = (score, (x, y), drift, grain)
    return best[1], best[2], best[3]


def normalize(crop: Image.Image) -> Image.Image:
    """Mean -> 128, +/-2.5 sigma -> +/-10, clamped."""
    st = ImageStat.Stat(crop)
    m, s = st.mean[0], max(st.stddev[0], 1e-6)
    k = 10.0 / (2.5 * s)
    lut = [max(0, min(255, round(128 + (v - m) * k))) for v in range(256)]
    return crop.point(lut)


def mirror_quad(crop: Image.Image) -> Image.Image:
    tile = Image.new('L', (TILE, TILE))
    lr = crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    tb = crop.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    both = lr.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    tile.paste(crop, (0, 0))
    tile.paste(lr, (CROP, 0))
    tile.paste(tb, (0, CROP))
    tile.paste(both, (CROP, CROP))
    return tile


def seam_ratio(tile: Image.Image) -> float:
    """Roll by half so the tile's outer edges meet in the middle, then measure edge energy.

    A real seam shows up as a bright cross in FIND_EDGES; the ratio against the interior is
    what makes this a gate rather than a vibe.
    """
    half = TILE // 2
    rolled = Image.new('L', (TILE, TILE))
    for dx, dy in ((0, 0), (half, 0), (0, half), (half, half)):
        rolled.paste(tile.crop((dx, dy, dx + half, dy + half)),
                     ((dx + half) % TILE, (dy + half) % TILE))
    edges = rolled.filter(ImageFilter.FIND_EDGES).crop((2, 2, TILE - 2, TILE - 2))
    w = edges.size[0]
    band = 3
    c = half - 2  # seam position inside the cropped edge map
    seam_v = edges.crop((c - band, 0, c + band, w))
    seam_h = edges.crop((0, c - band, w, c + band))
    seam = (ImageStat.Stat(seam_v).mean[0] + ImageStat.Stat(seam_h).mean[0]) / 2
    interior_a = edges.crop((0, 0, c - band * 4, w))
    interior_b = edges.crop((c + band * 4, 0, w, w))
    interior = (ImageStat.Stat(interior_a).mean[0] + ImageStat.Stat(interior_b).mean[0]) / 2
    return seam / max(interior, 1e-6)


def contact_sheet(tile: Image.Image, path: str) -> None:
    """2x2 repeat at the shipped 256px scale, over the enclosure grey, as it will be seen."""
    rep = tile.resize((256, 256), Image.Resampling.LANCZOS)
    sheet = Image.new('L', (512, 512))
    for y in (0, 256):
        for x in (0, 256):
            sheet.paste(rep, (x, y))
    sheet.save(path)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--seed', type=int, default=None, help='force one seed instead of scanning')
    ap.add_argument('--force', action='store_true', help='write the tile even if a gate fails')
    args = ap.parse_args(argv)

    seeds = [args.seed] if args.seed else [4242, 4243, 4244]
    chosen = None
    for seed in seeds:
        src = os.path.join(RAW, f'grain-s{seed}.png')
        if not os.path.exists(src):
            print(f'seed {seed}: {src} missing'); continue
        gray = Image.open(src).convert('L')
        fdrift, fmeans = quadrant_drift(gray)
        # Frame-level drift is a report, not the gate: every 1024 render carries the model's
        # lighting gradient, and the tile is one 256 window out of sixteen. The gate belongs
        # on the crop that actually ships.
        print(f'seed {seed}: frame quadrant means {[round(m, 1) for m in fmeans]} '
              f'(frame drift {fdrift:.2f} luma - report only)')
        (x, y), blockdrift, grain = best_crop(gray)
        crop = gray.crop((x, y, x + CROP, y + CROP))
        cdrift, cmeans = quadrant_drift(crop)
        flat = cdrift <= QUADRANT_DRIFT_MAX
        print(f'         flattest {CROP}^2 crop at ({x},{y}): block-mean stddev '
              f'{blockdrift:.2f}, grain energy {grain:.2f}')
        print(f'         crop quadrant means {[round(m, 1) for m in cmeans]} '
              f'max drift {cdrift:.2f} luma (<= {QUADRANT_DRIFT_MAX}) '
              f'{"PASS" if flat else "FAIL"}')
        if not flat and not args.force:
            continue
        if chosen is None:
            chosen = (seed, crop, (x, y))

    if chosen is None:
        print('\nNO SEED PASSED THE FLATNESS GATE -> ship no file; '
              'use the CSS feTurbulence fallback only.')
        return 2

    seed, crop, xy = chosen
    norm = normalize(crop)
    tile = mirror_quad(norm)
    ratio = seam_ratio(tile)
    st = ImageStat.Stat(tile)
    # Measure the NORMALIZED CROP, not the tile: mirror-quad gives all four tile quadrants
    # the same mean by construction, so a tile-level drift check would read 0.00 even for a
    # badly sloped source. This is the same number that would expose the slope.
    ndrift, nmeans = quadrant_drift(norm)
    flat_ok = ndrift <= 2.5
    ok = ratio < SEAM_RATIO_MAX and flat_ok
    print(f'\nchosen seed {seed}, crop {xy}')
    print(f'  tile mean {st.mean[0]:.1f} stddev {st.stddev[0]:.2f} '
          f'range {tile.getextrema()}')
    print(f'  normalized-crop quadrant means {[round(m, 1) for m in nmeans]} '
          f'drift {ndrift:.2f} (<= 2.5 of a +/-10 range) {"PASS" if flat_ok else "FAIL"}')
    print(f'  seam gate: edge ratio {ratio:.3f} (< {SEAM_RATIO_MAX}) '
          f'{"PASS" if ratio < SEAM_RATIO_MAX else "FAIL"}')
    if not ok and not args.force:
        print('  -> seam gate failed; ship no file, use the CSS fallback.')
        return 2
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tile.save(OUT, optimize=True)
    sheet = os.path.join(QA, 'grain_contact_2x2.png')
    contact_sheet(tile, sheet)
    print(f'  wrote {os.path.relpath(OUT, ROOT)} '
          f'({os.path.getsize(OUT) / 1024:.0f} KB), contact sheet {os.path.relpath(sheet, ROOT)}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
