#!/usr/bin/env python3
"""Cut the README hero and its og:image from the winning render.

  hero.png     the winner at native 1344x768
  hero-og.png  1200x630 (the og:image ratio), centre-cropped then LANCZOS-resized --
               cropped first so the device is not squashed to fit the wider ratio

Both must land under 400 KB. A 1344x768 photographic PNG does not (1090 KB), so the encoder
walks a ladder and reports which rung it stopped on.

THE QUANTIZER CHOICE IS LOAD-BEARING. This frame is ~99% neutral grey with one small deep
blue knob, and that knob is a D4 acceptance gate. MEDIANCUT splits color space by pixel
population, so it spends every slot on greys and quantizes the knob to near-black -- at 256
colors it still lost 80% of the blue (measured: b-r 39.6 -> 8.1), while the file size gate
happily passed. MAXCOVERAGE optimizes for coverage instead and keeps it exactly (39.6 ->
40.0) in a SMALLER file. So the size gate is paired with a blue-retention gate that
re-measures the shipped bytes through the source's own blue mask; passing bytes with a dead
knob is a failure, not a pass.

usage: python3 tools/assets/hero.py [--src assets/raw/hero-krea-s810.png]
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys

from PIL import Image, ImageChops, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS = os.path.join(ROOT, 'docs', 'img')
QA = os.path.join(ROOT, 'assets', 'qa')
LIMIT = 400 * 1024
OG = (1200, 630)
BLUE_KEEP = 0.80          # shipped blue must retain this share of the source's blue


def blue_mask(img: Image.Image) -> tuple[Image.Image, float]:
    """(mask of strongly blue pixels, their mean blue excess b-r) for an RGB image."""
    r, g, b = img.convert('RGB').split()
    diff = ImageChops.subtract(b, r)               # clamped at 0
    mask = diff.point(lambda v: 255 if v > 25 else 0)
    if not ImageStat.Stat(mask).sum[0]:
        return mask, 0.0
    return mask, ImageStat.Stat(diff, mask).mean[0]


def blue_through(img: Image.Image, mask: Image.Image) -> float:
    """Mean blue excess of `img` measured through someone else's mask."""
    r, g, b = img.convert('RGB').split()
    return ImageStat.Stat(ImageChops.subtract(b, r), mask).mean[0]


def encode(img: Image.Image, path: str) -> str:
    """Write `img` under LIMIT without losing its blue. Least destructive rung first."""
    mask, want = blue_mask(img)
    ladder: list[tuple[str, object]] = [('rgb + optimize', None)]
    ladder += [(f'palette {n} maxcoverage', n) for n in (256, 192, 128)]
    for label, colors in ladder:
        if colors is None:
            img.save(path, optimize=True)
        else:
            img.convert('RGB').quantize(
                colors=colors, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE
            ).save(path, optimize=True)
        size = os.path.getsize(path)
        with Image.open(path) as back:
            got = blue_through(back, mask)
        keep = got / want if want else 1.0
        if size <= LIMIT and keep >= BLUE_KEEP:
            print(f'    [{label}] {size / 1024:.0f} KB, blue retained {keep * 100:.0f}% '
                  f'(b-r {want:.1f} -> {got:.1f})')
            return label
        print(f'    [{label}] rejected: {size / 1024:.0f} KB, blue retained {keep * 100:.0f}%')
    raise SystemExit(f'{path}: no encoding meets both the size and blue gates')


def centre_crop(img: Image.Image, ratio: float) -> Image.Image:
    w, h = img.size
    if w / h > ratio:                     # too wide: trim the sides
        nw = int(round(h * ratio))
        box = ((w - nw) // 2, 0, (w - nw) // 2 + nw, h)
    else:                                 # too tall: trim top and bottom
        nh = int(round(w / ratio))
        box = (0, (h - nh) // 2, w, (h - nh) // 2 + nh)
    return img.crop(box)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(ROOT, 'assets', 'raw', 'hero-krea-s810.png'))
    args = ap.parse_args(argv)

    os.makedirs(DOCS, exist_ok=True)
    src = Image.open(args.src).convert('RGB')
    print(f'{os.path.relpath(args.src, ROOT)}  {src.size[0]}x{src.size[1]}')

    hero = os.path.join(DOCS, 'hero.png')
    how = encode(src, hero)
    print(f'  hero.png     {src.size[0]}x{src.size[1]}  '
          f'{os.path.getsize(hero) / 1024:.0f} KB  [{how}]')

    og_img = centre_crop(src, OG[0] / OG[1]).resize(OG, Image.Resampling.LANCZOS)
    og = os.path.join(DOCS, 'hero-og.png')
    how_og = encode(og_img, og)
    print(f'  hero-og.png  {OG[0]}x{OG[1]}  '
          f'{os.path.getsize(og) / 1024:.0f} KB  [{how_og}]')

    # The og:image is referenced from index.html as "/hero-og.png", and Vite serves the site
    # root from public/ -- docs/ is not served at all, so the docs copy alone would 404 for
    # every scraper. Same bytes, two homes: docs/img for the README, public/ for the web.
    served = os.path.join(ROOT, 'public', 'hero-og.png')
    shutil.copyfile(og, served)
    print(f'  public/hero-og.png  copy of the above, so index.html\'s og:image resolves')

    # side-by-side of the same 600x400 region, source vs shipped, so palette banding is
    # judged at native scale instead of on a thumbnail
    os.makedirs(QA, exist_ok=True)
    box = (400, 100, 1000, 500)
    check = Image.new('RGB', (1200, 400))
    check.paste(src.crop(box), (0, 0))
    check.paste(Image.open(hero).convert('RGB').crop(box), (600, 0))
    check.save(os.path.join(QA, 'hero_palette_check.png'))
    print('  wrote assets/qa/hero_palette_check.png (left: source, right: shipped)')

    ok = os.path.getsize(hero) <= LIMIT and os.path.getsize(og) <= LIMIT
    print(f'  size gate: both <= 400 KB  {"PASS" if ok else "FAIL"}')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
