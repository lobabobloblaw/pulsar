#!/usr/bin/env python3
"""Build the PULSAR favicon / app-icon set.

Split by size physics, per plan D3:

  LARGE (512/256/192/180 + maskable)  driven by the generated klein emblem
      (assets/raw/emblem-s5150.png). The render is first flattened to three flat colors --
      off-white field, accent blue, hairline grey -- which both removes the model's
      antialiasing mush and pulls the blue onto the design token #1270b8, so every size
      agrees with favicon.svg. Downscale is LANCZOS because the flattened source is
      hard-edged and large.

  SMALL (32/16, and the 48 inside the .ico)  hand-authored bitmaps below. At 16x16 an
      emblem has ~7 pixels of beam to work with; a downscale spends them on grey ramps,
      a hand-set bitmap spends them on shape. The rows ARE the artwork -- edit them, not a
      filter chain. The 48 is the 16 scaled 3x NEAREST, so it stays pixel-exact rather
      than reintroducing a resampler.

D3 decision rule (whether the generated emblem may drive 32/16) is measured and printed by
this script: accept only if 16x16 ink coverage is 15-85% AND the beams stay distinct.

usage: python3 tools/assets/favicon.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'assets', 'raw')
QA = os.path.join(ROOT, 'assets', 'qa')
PUB = os.path.join(ROOT, 'public')

EMBLEM = 'emblem-s5150.png'

# design tokens (src/design/tokens.css): one accent on the light surface
FIELD = (240, 240, 238)   # off-white icon field
BLUE = (18, 112, 184)     # --enclosure-accent #1270b8
GREY = (168, 168, 168)    # --n hairline #a8a8a8
ENCLOSURE = (216, 216, 216)  # #d8d8d8, the maskable safe-area field

# --- hand-authored bitmaps -------------------------------------------------------------
# '#' = accent blue, '.' = transparent. Filled circle + two tapering beams to opposite
# corners: the same mark as favicon.svg, set by hand at the size it is shown.
FAVICON_16 = [
    '#..............#',
    '.#............#.',
    '..##........##..',
    '...##......##...',
    '....##....##....',
    '.....######.....',
    '.....######.....',
    '....########....',
    '....########....',
    '.....######.....',
    '.....######.....',
    '....##....##....',
    '...##......##...',
    '..##........##..',
    '.#............#.',
    '#..............#',
]

FAVICON_32 = [
    '#..............................#',
    '.#............................#.',
    '..#..........................#..',
    '...##......................##...',
    '....##....................##....',
    '.....##..................##.....',
    '......###..............###......',
    '.......###............###.......',
    '........####........####........',
    '.........####......####.........',
    '..........############..........',
    '...........##########...........',
    '...........##########...........',
    '..........############..........',
    '..........############..........',
    '..........############..........',
    '..........############..........',
    '..........############..........',
    '..........############..........',
    '...........##########...........',
    '...........##########...........',
    '..........############..........',
    '.........####......####.........',
    '........####........####........',
    '.......###............###.......',
    '......###..............###......',
    '.....##..................##.....',
    '....##....................##....',
    '...##......................##...',
    '..#..........................#..',
    '.#............................#.',
    '#..............................#',
]


def bitmap(rows: list[str], color: tuple[int, int, int]) -> Image.Image:
    n = len(rows)
    for i, r in enumerate(rows):
        if len(r) != n:
            raise SystemExit(f'bitmap row {i} is {len(r)} chars, expected {n}')
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '#':
                px[x, y] = (*color, 255)
    return im


def flatten(img: Image.Image) -> Image.Image:
    """Three-way classify the render: blue beam+core, grey beam, off-white field.

    Rule, not clustering: the emblem is already flat art, so a threshold is honest and
    reproducible. Blue is whatever leans blue; the rest splits on luminance.
    """
    img = img.convert('RGB')
    out = Image.new('RGB', img.size)
    src, dst = img.load(), out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            if b - r > 30:
                dst[x, y] = BLUE
            elif (r * 299 + g * 587 + b * 114) / 1000 > 225:
                dst[x, y] = FIELD
            else:
                dst[x, y] = GREY
    return out


def decision_rule(flat: Image.Image) -> None:
    """D3: may the generated emblem drive 32/16? Print the measurement either way."""
    s16 = flat.resize((16, 16), Image.Resampling.LANCZOS)
    px = list(s16.getdata())
    ink = sum(1 for p in px if sum((a - b) ** 2 for a, b in zip(p, FIELD)) > 40 ** 2)
    pct = 100 * ink / 256
    print(f'  D3 small-size rule: 16x16 ink coverage {pct:.1f}% '
          f'(accept 15-85%) -> {"CLEARS" if 15 <= pct <= 85 else "FAILS"}')
    for y in range(16):
        print('    ' + ''.join(
            '#' if sum((a - b) ** 2 for a, b in zip(px[y * 16 + x], FIELD)) > 40 ** 2 else '.'
            for x in range(16)))


def main() -> int:
    os.makedirs(PUB, exist_ok=True)
    os.makedirs(QA, exist_ok=True)

    emblem = Image.open(os.path.join(RAW, EMBLEM))
    flat = flatten(emblem)
    flat.save(os.path.join(QA, 'emblem_flat_1024.png'))
    print(f'{EMBLEM} -> flattened to 3 tokens, {flat.size[0]}x{flat.size[1]}')
    decision_rule(flat)

    for size in (512, 256, 192, 180):
        p = os.path.join(PUB, f'icon-{size}.png')
        flat.resize((size, size), Image.Resampling.LANCZOS).save(p, optimize=True)
        print('  wrote', os.path.relpath(p, ROOT))

    # apple-touch-icon: 180, opaque field (iOS composites alpha onto black)
    atp = os.path.join(PUB, 'apple-touch-icon.png')
    flat.resize((180, 180), Image.Resampling.LANCZOS).save(atp, optimize=True)
    print('  wrote', os.path.relpath(atp, ROOT))

    # maskable: 80% inset so the safe area survives any platform mask
    inset = int(512 * 0.8)
    mask = Image.new('RGB', (512, 512), ENCLOSURE)
    mask.paste(flat.resize((inset, inset), Image.Resampling.LANCZOS),
               ((512 - inset) // 2, (512 - inset) // 2))
    mp = os.path.join(PUB, 'icon-maskable-512.png')
    mask.save(mp, optimize=True)
    print('  wrote', os.path.relpath(mp, ROOT))

    ico16 = bitmap(FAVICON_16, BLUE)
    ico32 = bitmap(FAVICON_32, BLUE)
    ico48 = ico16.resize((48, 48), Image.Resampling.NEAREST)
    ico16.save(os.path.join(PUB, 'favicon-16.png'), optimize=True)
    ico32.save(os.path.join(PUB, 'favicon-32.png'), optimize=True)
    print('  wrote public/favicon-16.png, public/favicon-32.png (hand-authored)')

    # Pillow's ICO writer silently DROPS any requested size larger than the base image,
    # so the base must be the biggest frame; 16 and 32 come in via append_images.
    icop = os.path.join(PUB, 'favicon.ico')
    ico48.save(icop, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)],
               append_images=[ico16, ico32])
    with Image.open(icop) as chk:
        got = sorted(chk.info['sizes'])
    if got != [(16, 16), (32, 32), (48, 48)]:
        print(f'  FAIL favicon.ico carries {got}, expected 16/32/48')
        return 1
    print(f'  wrote public/favicon.ico {got}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
