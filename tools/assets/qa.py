#!/usr/bin/env python3
"""Re-check every shipped PULSAR asset against its Part-D gate. Exit 0 = all clean.

This is the machine half of asset QA -- dimensions, color budgets, palette membership, file
sizes, container contents. It cannot replace looking at the images (a flat grey placeholder
passes every numeric check ever written), so the contact sheets in assets/qa/ stay part of
the process; this just makes regressions loud.

usage: python3 tools/assets/qa.py
"""

from __future__ import annotations

import json
import os
import sys
import xml.dom.minidom
from collections import Counter

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixelize import QUANT_SET, rgb_to_hex  # noqa: E402
from grain import seam_ratio, SEAM_RATIO_MAX  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FAILURES: list[str] = []


def check(label: str, ok: bool, detail: str = '') -> bool:
    print(f'  {"PASS" if ok else "FAIL"}  {label}{"  " + detail if detail else ""}')
    if not ok:
        FAILURES.append(label)
    return ok


def img(rel: str) -> Image.Image:
    return Image.open(os.path.join(ROOT, rel))


def size_of(rel: str) -> int:
    return os.path.getsize(os.path.join(ROOT, rel))


def exists(rel: str) -> bool:
    return os.path.exists(os.path.join(ROOT, rel))


def palette_asset(rel: str, dims: tuple[int, int], max_colors: int,
                  ink: tuple[float, float] | None) -> None:
    if not check(f'{rel} exists', exists(rel)):
        return
    im = img(rel).convert('RGB')
    check(f'{rel} is {dims[0]}x{dims[1]}', im.size == dims, f'got {im.size[0]}x{im.size[1]}')
    counts = Counter(im.getdata())
    check(f'{rel} has <= {max_colors} colors', len(counts) <= max_colors, f'got {len(counts)}')
    outside = [rgb_to_hex(c) for c in counts if c not in QUANT_SET]
    check(f'{rel} uses only NES 2C02 quantization colors', not outside, str(outside[:4]))
    if ink:
        bg_n = counts.most_common(1)[0][1]
        pct = 100 * (1 - bg_n / (im.size[0] * im.size[1]))
        check(f'{rel} ink coverage in {ink[0]}-{ink[1]}%', ink[0] <= pct <= ink[1],
              f'{pct:.1f}%')


def plain_asset(rel: str, dims: tuple[int, int], max_kb: int | None = None) -> None:
    if not check(f'{rel} exists', exists(rel)):
        return
    im = img(rel)
    check(f'{rel} is {dims[0]}x{dims[1]}', im.size == dims, f'got {im.size[0]}x{im.size[1]}')
    if max_kb is not None:
        kb = size_of(rel) / 1024
        check(f'{rel} <= {max_kb} KB', kb <= max_kb, f'{kb:.0f} KB')


def main() -> int:
    print('boot art (D1)')
    palette_asset('src/assets/boot/boot-128x64.png', (128, 64), 16, (8.0, 70.0))

    print('\nvoice icons (D2)')
    for v in ('pulse', 'triangle', 'noise', 'dpcm'):
        palette_asset(f'src/assets/icons/voice-{v}-64.png', (64, 64), 4, (4.0, 92.0))

    print('\nfavicon / app icon set (D3)')
    for s in (512, 256, 192, 180):
        plain_asset(f'public/icon-{s}.png', (s, s))
    plain_asset('public/apple-touch-icon.png', (180, 180))
    plain_asset('public/icon-maskable-512.png', (512, 512))
    plain_asset('public/favicon-16.png', (16, 16))
    plain_asset('public/favicon-32.png', (32, 32))
    if check('public/favicon.ico exists', exists('public/favicon.ico')):
        with img('public/favicon.ico') as ico:
            got = sorted(ico.info['sizes'])
        check('favicon.ico carries 16/32/48', got == [(16, 16), (32, 32), (48, 48)], str(got))
    if check('public/favicon.svg exists', exists('public/favicon.svg')):
        svg = open(os.path.join(ROOT, 'public/favicon.svg'), encoding='utf8').read()
        xml.dom.minidom.parseString(svg)
        check('favicon.svg uses the accent blue #1270b8', '#1270b8' in svg)
    if check('public/site.webmanifest exists', exists('public/site.webmanifest')):
        man = json.load(open(os.path.join(ROOT, 'public/site.webmanifest'), encoding='utf8'))
        check('manifest name is pulsar', man.get('name') == 'pulsar')
        check('manifest theme_color #d8d8d8', man.get('theme_color') == '#d8d8d8')
        missing = [i['src'] for i in man['icons'] if not exists('public' + i['src'])]
        check('every manifest icon exists on disk', not missing, str(missing))
        check('manifest declares a maskable icon',
              any(i.get('purpose') == 'maskable' for i in man['icons']))

    print('\nREADME hero (D4)')
    plain_asset('docs/img/hero.png', (1344, 768), 400)
    plain_asset('docs/img/hero-og.png', (1200, 630), 400)
    # index.html points og:image at "/hero-og.png"; only public/ is served at the site root
    plain_asset('public/hero-og.png', (1200, 630), 400)
    check('public/hero-og.png matches the docs copy byte for byte',
          exists('public/hero-og.png') and exists('docs/img/hero-og.png')
          and open(os.path.join(ROOT, 'public/hero-og.png'), 'rb').read()
          == open(os.path.join(ROOT, 'docs/img/hero-og.png'), 'rb').read())

    print('\nenclosure grain (D5)')
    rel = 'public/textures/enclosure-grain-512.png'
    if exists(rel):
        plain_asset(rel, (512, 512))
        tile = img(rel)
        check(f'{rel} is 8-bit grayscale', tile.mode == 'L', f'mode {tile.mode}')
        lo, hi = tile.getextrema()
        check(f'{rel} stays near mid grey', 100 <= lo and hi <= 160, f'range {lo}-{hi}')
        r = seam_ratio(tile)
        check(f'{rel} seam ratio < {SEAM_RATIO_MAX}', r < SEAM_RATIO_MAX, f'{r:.3f}')
    else:
        print('  SKIP  grain tile absent - CSS feTurbulence fallback only (allowed by D5)')

    print('\nprovenance (D6)')
    if check('ASSETS.md exists', exists('ASSETS.md')):
        doc = open(os.path.join(ROOT, 'ASSETS.md'), encoding='utf8').read()
        shipped = [
            'src/assets/boot/boot-128x64.png', 'src/assets/icons/voice-pulse-64.png',
            'src/assets/icons/voice-triangle-64.png', 'src/assets/icons/voice-noise-64.png',
            'src/assets/icons/voice-dpcm-64.png', 'public/icon-512.png', 'public/favicon.ico',
            'public/favicon.svg', 'public/site.webmanifest', 'docs/img/hero.png',
            'docs/img/hero-og.png', rel,
        ]
        undocumented = [p for p in shipped if p not in doc]
        check('every shipped asset has an ASSETS.md block', not undocumented,
              str(undocumented))
        check('ASSETS.md names the klein license string',
              'flux-non-commercial-license' in doc)
        check('ASSETS.md names the Krea license string', 'krea-2-community-license' in doc)
    check('palette module exists', exists('src/assets/palette/nes2c02.ts'))
    check('gallery manifest exists', exists('assets/raw/manifest.jsonl'))

    print()
    if FAILURES:
        print(f'{len(FAILURES)} FAILED: ' + '; '.join(FAILURES))
        return 1
    print('all asset gates clean')
    return 0


if __name__ == '__main__':
    sys.exit(main())
