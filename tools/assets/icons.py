#!/usr/bin/env python3
"""Reduce the four chosen klein voice renders to 64x64 4-color NES icons.

Each icon is one pinned raw render (see ASSETS.md) put through the same two-stage
NES 2C02 lock as the boot art, at a 4-color budget instead of 16.

`prep` is per-icon and deliberately explicit rather than clever: the pulse render is the
shift-4.5 doubling repair, whose *lower* band is the clean square wave, so it is cropped and
re-centred on a 512 black canvas before the divide so the divisor still lands on whole
source pixels.

Downsample mode:
  nearest  point-sample every 8th pixel (the boot-art rule; correct for filled shapes)
  maxpool  take the brightest pixel of each 8x8 block, then lock

maxpool exists because these icons are thin white strokes on black: point sampling drops a
1-pixel-wide riser whenever the sample grid falls between strokes, which silently breaks the
symbol. Taking the max over the block preserves stroke connectivity at the same output size.
The stage-2 palette reduction is unchanged either way.

usage: python3 tools/assets/icons.py [--mode maxpool]
"""

from __future__ import annotations

import argparse
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixelize import stage1_lock, stage2_reduce, report  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'assets', 'raw')
OUT = os.path.join(ROOT, 'src', 'assets', 'icons')
QA = os.path.join(ROOT, 'assets', 'qa')

# name -> (raw file, crop box or None, divisor)
ICONS = {
    'pulse':    ('icon-pulse-s2019-shift45.png', (40, 285, 360, 370), 8),
    'triangle': ('icon-triangle-s2006.png',      None,                8),
    'noise':    ('icon-noise-s2007.png',         None,                8),
    'dpcm':     ('icon-dpcm-s2016.png',          None,                8),
}
COLORS = 4
SIZE = 64


def prep(name: str) -> Image.Image:
    """Load the raw render and return a 512x512 RGB frame ready to divide."""
    src_name, box, _ = ICONS[name]
    img = Image.open(os.path.join(RAW, src_name)).convert('RGB')
    if box is None:
        return img
    piece = img.crop(box)
    canvas = Image.new('RGB', (512, 512), (0, 0, 0))
    canvas.paste(piece, ((512 - piece.width) // 2, (512 - piece.height) // 2))
    return canvas


def downsample(img: Image.Image, divisor: int, mode: str) -> Image.Image:
    w, h = img.size
    tw, th = w // divisor, h // divisor
    if mode == 'nearest':
        return img.resize((tw, th), Image.Resampling.NEAREST)
    # maxpool: brightest pixel of each divisor x divisor block wins
    src = img.load()
    out = Image.new('RGB', (tw, th))
    dst = out.load()
    for y in range(th):
        for x in range(tw):
            best, best_lum = (0, 0, 0), -1
            for by in range(divisor):
                for bx in range(divisor):
                    p = src[x * divisor + bx, y * divisor + by]
                    lum = p[0] * 299 + p[1] * 587 + p[2] * 114
                    if lum > best_lum:
                        best, best_lum = p, lum
            dst[x, y] = best
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--mode', choices=('nearest', 'maxpool'), default='maxpool')
    args = ap.parse_args(argv)

    os.makedirs(OUT, exist_ok=True)
    os.makedirs(QA, exist_ok=True)
    ok = True
    icons = {}
    for name in ICONS:
        _, _, div = ICONS[name]
        small = downsample(prep(name), div, args.mode)
        icon = stage2_reduce(stage1_lock(small), COLORS)
        dst = os.path.join(OUT, f'voice-{name}-64.png')
        icon.save(dst)
        icons[name] = icon
        print(f'voice-{name}-64.png  ({args.mode})')
        # icons are a symbol on a field: 8-92% is the readable band, not the boot art's 8-70
        ok &= report(icon, COLORS, 4.0, 92.0)

    # QA sheet: top row 64x64 at 4x, bottom row the 32x32 the screen actually shows, at 8x
    pad, cell = 8, 256
    sheet = Image.new('RGB', (len(icons) * (cell + pad) + pad, 2 * (cell + pad) + pad),
                      (48, 48, 48))
    for i, (name, im) in enumerate(icons.items()):
        x = pad + i * (cell + pad)
        sheet.paste(im.resize((cell, cell), Image.Resampling.NEAREST), (x, pad))
        half = im.resize((32, 32), Image.Resampling.NEAREST)
        sheet.paste(half.resize((cell, cell), Image.Resampling.NEAREST), (x, cell + 2 * pad))
    sheet_path = os.path.join(QA, 'icons_contact.png')
    sheet.save(sheet_path)
    print('contact sheet:', sheet_path, '(top 64x64, bottom the 32x32 screen size)')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
