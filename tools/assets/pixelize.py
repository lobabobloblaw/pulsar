#!/usr/bin/env python3
"""Pixelize a klein render onto the NES 2C02 palette.

Two stages, NEVER collapsed into one quantize() call:

  stage 1  resize(divisor, NEAREST) -> the target lattice size, then lock every pixel to
           its nearest neighbour in the NES 2C02 quantization set. Doing this first is
           what keeps the result inside real hardware colors; letting PIL pick the palette
           (MEDIANCUT) invents N colors that are not on the 2C02 at all.
  stage 2  count the locked colors, keep the N most frequent, and remap everything else to
           the nearest kept color in sRGB. Still only 2C02 colors, now within the budget.

Collapsing the stages (quantize to N against the NES palette in one shot) gives PIL license
to choose a palette subset by error rather than by frequency, which drops the small bright
highlight that carries the silhouette.

PALETTE DUPLICATION IS DELIBERATE: NES_2C02 / NES_2C02_QUANT below are byte-identical to
src/assets/palette/nes2c02.ts so this pipeline needs no JS runtime.
tests/unit/paletteDrift.test.ts parses both files and fails if they diverge.
2C02 palette, pinned 2026-08-03.

usage:
  python3 tools/assets/pixelize.py IN.png OUT.png --divisor 8 --colors 16 \
      --preview assets/qa/boot_preview_1024.png --ink-min 8 --ink-max 70
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

from PIL import Image

# --- NES 2C02 master palette, pinned 2026-08-03 -----------------------------------------
# All 64 hardware entries, hardware index order $00..$3F.
NES_2C02 = [
    # $00..$0F
    '#545454', '#001E74', '#081090', '#300088',
    '#440064', '#5C0030', '#540400', '#3C1800',
    '#202A00', '#083A00', '#004000', '#003C00',
    '#00323C', '#000000', '#000000', '#000000',
    # $10..$1F
    '#989698', '#084CC4', '#3032EC', '#5C1EE4',
    '#8814B0', '#A01464', '#982220', '#783C00',
    '#545A00', '#287200', '#087C00', '#007628',
    '#006678', '#000000', '#000000', '#000000',
    # $20..$2F
    '#ECEEEC', '#4C9AEC', '#787CEC', '#B062EC',
    '#E454EC', '#EC58B4', '#EC6A64', '#D48820',
    '#A0AA00', '#74C400', '#4CD020', '#38CC6C',
    '#38B4CC', '#3C3C3C', '#000000', '#000000',
    # $30..$3F
    '#ECEEEC', '#A8CCEC', '#BCBCEC', '#D4B2EC',
    '#ECAEEC', '#ECAED4', '#ECB4B0', '#E4C490',
    '#CCD278', '#B4DE78', '#A8E290', '#98E2B4',
    '#A0D6E4', '#A0A2A0', '#000000', '#000000',
]

# The 55 quantization-safe entries: $0D (blacker-than-black) and the eight duplicate
# blacks ($0E $0F $1E $1F $2E $2F $3E $3F) dropped; $1D kept as true black.
NES_2C02_QUANT = [
    # $00..$0C
    '#545454', '#001E74', '#081090', '#300088',
    '#440064', '#5C0030', '#540400', '#3C1800',
    '#202A00', '#083A00', '#004000', '#003C00',
    '#00323C',
    # $10..$1D
    '#989698', '#084CC4', '#3032EC', '#5C1EE4',
    '#8814B0', '#A01464', '#982220', '#783C00',
    '#545A00', '#287200', '#087C00', '#007628',
    '#006678', '#000000',
    # $20..$2D
    '#ECEEEC', '#4C9AEC', '#787CEC', '#B062EC',
    '#E454EC', '#EC58B4', '#EC6A64', '#D48820',
    '#A0AA00', '#74C400', '#4CD020', '#38CC6C',
    '#38B4CC', '#3C3C3C',
    # $30..$3D
    '#ECEEEC', '#A8CCEC', '#BCBCEC', '#D4B2EC',
    '#ECAEEC', '#ECAED4', '#ECB4B0', '#E4C490',
    '#CCD278', '#B4DE78', '#A8E290', '#98E2B4',
    '#A0D6E4', '#A0A2A0',
]


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return '#%02X%02X%02X' % rgb


QUANT_RGB = [hex_to_rgb(c) for c in NES_2C02_QUANT]
QUANT_SET = set(QUANT_RGB)


def palette_image(colors: list[tuple[int, int, int]]) -> Image.Image:
    """A PIL 'P' image carrying `colors`, padded to 256 entries.

    Padding repeats the last real color: duplicate entries resolve to the same RGB, so the
    nearest-neighbour result is unchanged. Padding with black instead would pull dark
    midtones toward black.
    """
    flat: list[int] = []
    for c in colors:
        flat.extend(c)
    if not flat:
        raise ValueError('empty palette')
    tail = flat[-3:]
    while len(flat) < 768:
        flat.extend(tail)
    pal = Image.new('P', (1, 1))
    pal.putpalette(flat[:768])
    return pal


def stage1_lock(img: Image.Image) -> Image.Image:
    """Lock every pixel to its nearest 2C02 quantization-set color (no dither)."""
    return img.convert('RGB').quantize(
        palette=palette_image(QUANT_RGB), dither=Image.Dither.NONE
    ).convert('RGB')


def stage2_reduce(img: Image.Image, max_colors: int) -> Image.Image:
    """Keep the `max_colors` most frequent colors; remap the rest to the nearest kept one."""
    px = list(img.getdata())
    counts = Counter(px)
    if len(counts) <= max_colors:
        return img
    keep = [c for c, _ in counts.most_common(max_colors)]
    memo: dict[tuple[int, int, int], tuple[int, int, int]] = {c: c for c in keep}

    def nearest(p: tuple[int, int, int]) -> tuple[int, int, int]:
        hit = memo.get(p)
        if hit is None:
            hit = min(
                keep,
                key=lambda k: (k[0] - p[0]) ** 2 + (k[1] - p[1]) ** 2 + (k[2] - p[2]) ** 2,
            )
            memo[p] = hit
        return hit

    out = Image.new('RGB', img.size)
    out.putdata([nearest(p) for p in px])
    return out


def pixelize(src: Image.Image, divisor: int, max_colors: int) -> Image.Image:
    w, h = src.size
    if w % divisor or h % divisor:
        raise SystemExit(f'source {w}x{h} is not divisible by {divisor}')
    small = src.convert('RGB').resize((w // divisor, h // divisor), Image.Resampling.NEAREST)
    return stage2_reduce(stage1_lock(small), max_colors)


def report(img: Image.Image, max_colors: int, ink_min: float, ink_max: float) -> bool:
    """Print the D1/D2 QA gates and return True if all pass."""
    px = list(img.getdata())
    counts = Counter(px)
    used = list(counts)
    outside = [c for c in used if c not in QUANT_SET]
    bg, bg_n = counts.most_common(1)[0]
    ink = 100.0 * (1.0 - bg_n / len(px))

    ok_dims = True
    ok_count = len(used) <= max_colors
    ok_member = not outside
    ok_ink = ink_min <= ink <= ink_max

    print(f'  size            : {img.size[0]}x{img.size[1]}')
    print(f'  colors          : {len(used)} (<= {max_colors})  {"PASS" if ok_count else "FAIL"}')
    print(f'  all in 2C02 set : {"PASS" if ok_member else "FAIL " + str(outside)}')
    print(f'  background      : {rgb_to_hex(bg)}')
    print(f'  ink coverage    : {ink:.1f}% (want {ink_min}-{ink_max}%)  '
          f'{"PASS" if ok_ink else "FAIL"}')
    print('  palette         : ' + ' '.join(
        f'{rgb_to_hex(c)}x{n}' for c, n in counts.most_common()))
    return ok_dims and ok_count and ok_member and ok_ink


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--divisor', type=int, default=8)
    ap.add_argument('--colors', type=int, default=16)
    ap.add_argument('--preview', default=None, help='NEAREST upscale written here for QA')
    ap.add_argument('--preview-scale', type=int, default=8)
    ap.add_argument('--ink-min', type=float, default=8.0)
    ap.add_argument('--ink-max', type=float, default=70.0)
    args = ap.parse_args(argv)

    src = Image.open(args.src)
    print(f'{args.src} -> {args.dst}  (divisor {args.divisor}, <= {args.colors} colors)')
    out = pixelize(src, args.divisor, args.colors)
    out.save(args.dst)
    if args.preview:
        out.resize(
            (out.size[0] * args.preview_scale, out.size[1] * args.preview_scale),
            Image.Resampling.NEAREST,
        ).save(args.preview)
        print(f'  preview         : {args.preview}')
    return 0 if report(out, args.colors, args.ink_min, args.ink_max) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
