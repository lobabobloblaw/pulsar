# ASSETS — provenance for every generated raster in PULSAR

Every raster in this repo was generated **locally** with [Draw Things](https://drawthings.ai)
via `draw-things-cli` on Apple Silicon. No hosted API, no third-party service, no training on
this repo's content. Each block below is an executable recipe: same seed + same flags is
bit-reproducible on this machine, so any asset can be rebuilt from its `regenerate:` line.

The machine-readable twin of this file is `assets/raw/manifest.jsonl` (34 logged runs) and
`assets/raw/gallery.html`. Raw renders live in `assets/raw/`, QA sheets in `assets/qa/`;
both are committed and neither ships in the app bundle.

## Licensing posture

PULSAR is a **personal / open-source, non-monetized** project. That is what makes these model
licenses usable here:

| Checkpoint | License string | Used for |
|---|---|---|
| `flux_2_klein_9b_i8x.ckpt` (FLUX.2 [klein] 9B, 8-bit) | `flux-non-commercial-license` | boot art, voice icons, app-icon emblem, grain tile, hero A/B loser |
| `krea_2_turbo_i8x.ckpt` (Krea 2 Turbo, 8-bit) | `krea-2-community-license` | the shipped README hero |

**If PULSAR is ever monetized, both are blockers.** klein 9B is explicitly non-commercial and
Krea 2 is a community license — neither is cured by attribution. The escape route is designed
in rather than hoped for: **the app boots, plays and looks intentional with `src/assets/`,
`public/textures/` and `docs/img/` all deleted.** Generated art is enrichment over a complete
procedural design (wordmark boot fallback, `feTurbulence` grain, hand-authored SVG/bitmap
icons, text README). Replacing every file below is a licensing fix, not a redesign.

Not model-generated, so not encumbered: `public/favicon-16.png`, `public/favicon-32.png`,
`public/favicon.ico`, `public/favicon.svg`, `public/site.webmanifest`,
`src/assets/palette/nes2c02.ts`, and everything in `tools/assets/`. Those are MIT with the
rest of the repo.

The NES 2C02 palette used for quantization is **the 2C02 palette, pinned 2026-08-03**
(`src/assets/palette/nes2c02.ts`). The 2C02 emits NTSC composite, not RGB, so every published
"NES palette" is one decoding choice; cross-emulator sRGB drift of a few units per channel is
cosmetic and deliberately not chased. `tests/unit/paletteDrift.test.ts` parses the TypeScript
module *and* `tools/assets/pixelize.py` as text and fails if the two copies ever diverge.

**Non-affiliation:** PULSAR is not a Teenage Engineering product and is not affiliated with
them. The hero render is a concept render of an imaginary device with a deliberately blank,
unbranded faceplate.

Total GPU time for the whole batch: **1065.6 s (17 min 46 s) across 34 serialized runs.**

---

## `src/assets/boot/boot-128x64.png` — boot screen art

| | |
|---|---|
| Generated | 2026-08-03 |
| Checkpoint | `flux_2_klein_9b_i8x.ckpt` |
| License | `flux-non-commercial-license` |
| Seed / steps / cfg | 1337 / 4 / 1 |
| Size | 1024×512 raw → 128×64 shipped |
| shift / sampler | vendor defaults (not overridden) |
| Wall time | 28.83 s |

Prompt (`assets/prompts/boot.txt`), verbatim:

```
Pixel art title screen illustration, flat colors, 16-color palette, one-pixel outline, strong silhouette, hard edges.
A pulsar neutron star: one bright compact sphere at the exact center, two narrow tapering polar beams sweeping out to opposite corners, a thin ring of dust around the equator.
Plain solid black background, wide empty margins, high contrast, simple shapes.
Render exactly one subject, centered.
```

Post-process — `tools/assets/pixelize.py`, two stages, never collapsed:
1. `resize(÷8, NEAREST)` → 128×64 (1024×512 divides exactly onto the screen lattice), then
   lock every pixel to its nearest neighbour in `NES_2C02_QUANT` (55 entries).
2. keep the 16 most frequent locked colors, remap the rest to the nearest kept color in sRGB.

Collapsing these into one `quantize(colors=16, palette=…)` lets PIL choose the surviving
palette by error instead of by frequency, which drops the small bright core that carries the
silhouette.

QA (D1): 128×64 ✓ · **11 colors** ≤ 16 ✓ · all ∈ 2C02 quantization set ✓ · ink coverage
**11.5 %** ∈ 8–70 % ✓ · subject identifiable at 1:1 without the original ✓ (bright orb with an
X of beams) · zero legible glyphs ✓. Preview: `assets/qa/boot_preview_1024.png`.

```
regenerate: tools/assets/generate.sh boot
```

Rejected seeds: **1338** — rendered a ringed disc with no polar beams at all, so the subject
reads as a planet, not a pulsar. **1339** — beams present but dotted and asymmetric; the
breaks are sub-pixel at ÷8 and the beams disappear entirely.

---

## `src/assets/icons/voice-*-64.png` — four voice icons

Files: `src/assets/icons/voice-pulse-64.png`, `src/assets/icons/voice-triangle-64.png`,
`src/assets/icons/voice-noise-64.png`, `src/assets/icons/voice-dpcm-64.png`.

Shared post-process — `tools/assets/icons.py`: max-pool ÷8 → 64×64 → 2C02 lock → 4 most
frequent colors. **Max-pool rather than NEAREST point-sampling**: these are thin white strokes
on black, and point sampling drops a 1-px riser whenever the sample grid falls between
strokes, silently breaking the symbol. Taking the brightest pixel of each 8×8 block preserves
stroke connectivity at the same output size.

Shared QA (D2): 64×64 ✓ · 4 colors ✓ · all ∈ 2C02 set ✓ · **identifiable at the 32×32 the
screen actually shows** ✓ and mutually distinguishable — verified by eye on
`assets/qa/icons_contact.png`, which renders each icon at both 64 and 32.

### `voice-pulse-64.png`

| | |
|---|---|
| Checkpoint / license | `flux_2_klein_9b_i8x.ckpt` / `flux-non-commercial-license` |
| Seed / steps / cfg | 2019 / 6 / 1 |
| Size | 512×512 raw |
| shift / sampler | **shift 4.5** / vendor sampler |
| Wall time | 23.31 s |
| Ink coverage | 5.9 % |

Prompt (`assets/prompts/icon-pulse.txt`, v3), verbatim:

```
Pixel art icon of a crenellated battlement line: one continuous thick white line made only of horizontal and vertical segments meeting at right angles, running flat along the top for a stretch, dropping straight down, running flat along the bottom for the same stretch, climbing straight up, repeating twice across the frame like castle battlements, on plain black, thick even strokes, 4-color palette, hard edges, readable at postage-stamp size, wide empty margins, wordless.
```

Extra post-process step: the render is a **two-row** border pattern (klein reads
"battlements" as ornament). The clean lower band — a 3-cycle square wave — is cropped at
`(40, 285)–(360, 370)` and re-centred on a 512² black canvas before the divide, so the
divisor still lands on whole source pixels.

```
regenerate: tools/assets/generate.sh icon-pulse
```

Rejected: **2001, 2002, 2003** (prompt v1, `assets/prompts/icon-pulse-v1.txt`) — klein read
"two flat-topped rectangular pulses" as *filled blocks*; 2002 reads as a pause button.
**2013, 2014, 2015** (prompt v2, `assets/prompts/icon-pulse-v2.txt`) — the oscilloscope-trace
framing produced ECG-style spikes with no flat plateaus. **2013 + `{"sampler":10}`** — same
seed, same execution failure, so the sampler lever did not apply. **2019 at 4 steps** — the
v3 prompt finally produced true square-wave geometry but **doubled it into two rows**;
`shift 4.5 / steps 6` (the measured doubling repair) reduced but did not remove the doubling,
hence the crop.

### `voice-triangle-64.png`

| | |
|---|---|
| Seed / steps / cfg | 2006 / 4 / 1 · 512×512 · vendor shift |
| Wall time | 20.74 s · ink 12.8 % |

Prompt (`assets/prompts/icon-triangle.txt`), verbatim:

```
Pixel art icon of a triangle wave: a zigzag of straight diagonal ramps rising and falling to sharp points, single bold white symbol centered on plain black, thick even strokes, 4-color palette, hard edges, readable at postage-stamp size, wide empty margins, wordless.
```

```
regenerate: tools/assets/generate.sh icon-triangle
```

Rejected: **2005** — converged to a solid mountain/"A" silhouette, no wave reading.
**2004** — correct zigzag but no baseline, so it reads as terrain rather than a waveform;
2006's baseline stubs are what make it a signal.

### `voice-noise-64.png`

| | |
|---|---|
| Seed / steps / cfg | 2007 / 4 / 1 · 512×512 · vendor shift |
| Wall time | 18.22 s · ink 20.8 % |

Prompt (`assets/prompts/icon-noise.txt`), verbatim:

```
Pixel art icon of a noise waveform: a dense burst of jagged vertical spikes of random uneven heights along a center line, single bold white symbol centered on plain black, thick even strokes, 4-color palette, hard edges, readable at postage-stamp size, wide empty margins, wordless.
```

```
regenerate: tools/assets/generate.sh icon-noise
```

Rejected: **2008, 2009** — same motif with finer, denser spikes; at ÷8 the spikes merge into
a solid bar and the "random heights" reading is lost. 2007 has the sparsest spacing of the
three and survives the divide.

### `voice-dpcm-64.png`

| | |
|---|---|
| Seed / steps / cfg | 2016 / 4 / 1 · 512×512 · vendor shift |
| Wall time | 19.86 s · ink 4.3 % |

Prompt (`assets/prompts/icon-dpcm.txt`, v2), verbatim:

```
Pixel art icon of a staircase wave oscilloscope trace: one continuous line climbing left to right in four equal square steps like a flight of stairs, then dropping straight back down to the baseline, single bold white line on plain black, thick even strokes, 4-color palette, hard edges, readable at postage-stamp size, wide empty margins, wordless.
```

```
regenerate: tools/assets/generate.sh icon-dpcm
```

Rejected: **2010, 2011, 2012** (prompt v1, `assets/prompts/icon-dpcm-v1.txt`) — "blocky
rectangular sample bars" produced scattered, off-centre blocks in red/orange/green, i.e. both
the wrong subject and outside the monochrome brief. **2017** — clean staircase spoiled by a
stray filled block. **2018** — descending staircase with broken, disconnected steps.

---

## `public/icon-*.png` — app icon set (generated emblem)

Files: `public/icon-512.png`, `public/icon-256.png`, `public/icon-192.png`,
`public/icon-180.png`, `public/apple-touch-icon.png`, `public/icon-maskable-512.png`.

| | |
|---|---|
| Generated | 2026-08-03 |
| Checkpoint | `flux_2_klein_9b_i8x.ckpt` |
| License | `flux-non-commercial-license` |
| Seed / steps / cfg | 5150 / 6 / 1 |
| Size | 1024×1024 raw |
| shift / sampler | **shift 4.5** / vendor sampler |
| Wall time | 56.77 s |

Prompt (`assets/prompts/favicon-emblem.txt`), verbatim:

```
Bold geometric emblem of a pulsar: one filled circle at the exact center with two long tapering beams extending to opposite corners, flat vector shapes, hard edges, one deep blue and one light grey on an off-white background, perfectly centered, generous margins, completely wordless.
```

Post-process — `tools/assets/favicon.py`: flatten the render to three flat colors (off-white
field `#F0F0EE`, accent `#1270B8`, hairline grey `#A8A8A8`) by a documented threshold rule,
then LANCZOS-downscale. Flattening does two jobs: it removes the model's antialiasing mush
before resampling, and it pulls the render's navy onto the **design token** blue so every
icon size agrees with the hand-written `favicon.svg`. Maskable variant: emblem inset to 80 %
on a `#d8d8d8` field, so the safe area survives any platform mask.

QA (D3): all sizes exact ✓ · wordless ✓ · centred ✓ · manifest references every file ✓.

**D3 small-size decision rule — outcome: CLEARS.** Downscaled to 16×16 the emblem measures
**29.7 % ink coverage** (accept band 15–85 %) and its beams stay distinct from the core rather
than collapsing to a blob. So the generated emblem *was* eligible to drive 32/16. The
hand-authored bitmaps ship anyway, per D3's rule that small sizes are the hand-authored
tier's primary route: they are pixel-exact with no resampler softness and share one accent
color with `favicon.svg`, which a LANCZOS downscale cannot promise.

```
regenerate: tools/assets/generate.sh emblem
```

Rejected: **5151** — circle off-centre and one beam notched into a ribbon shape (doubled
geometry). **5152** — on-brief and genuinely tapering, but the taper leaves the beam tips
1 px wide by 16×16; kept in `assets/raw/` as the alternate if a softer mark is ever wanted.

---

## `public/favicon-16.png`, `public/favicon-32.png`, `public/favicon.ico`, `public/favicon.svg`

**Hand-authored — no model involved, MIT with the repo.**

- `tools/assets/favicon.py` carries the 16×16 and 32×32 marks as explicit bitmap rows. The
  rows *are* the artwork: at 16×16 an emblem has ~7 px of beam to spend, and a downscale
  spends them on grey ramps while a hand-set bitmap spends them on shape.
- `favicon.ico` packs **16, 32 and 48**. The 48 is the 16 scaled ×3 NEAREST, so it stays
  pixel-exact rather than reintroducing a resampler. Pillow's ICO writer silently drops any
  requested size *larger than the base image*, so the 48 is the base and 16/32 arrive via
  `append_images`; the script asserts the written file really carries all three.
- `favicon.svg` is hand-written: a filled circle plus four tapering wedges to the corners,
  one accent `#1270b8`, transparent field.

All four render the same mark as the generated large sizes (filled core, beams crossing to
opposite corners), so the icon set reads as one identity from 16 px to 512 px.

```
regenerate: python3 tools/assets/favicon.py     # deterministic, no GPU
```

---

## `public/site.webmanifest`

Hand-written. `name`/`short_name` `pulsar`, `display: standalone`, `theme_color #d8d8d8`
(the aluminium enclosure), `background_color #181818` (the screen well, so the splash reads
as the instrument waking up). Declares the SVG, both bitmap favicons, all four PNG sizes and
the maskable 512. `tools/assets/qa.py` asserts every referenced file exists on disk.

---

## `docs/img/hero.png`, `docs/img/hero-og.png` — README hero

| | |
|---|---|
| Generated | 2026-08-03 |
| Checkpoint | **`krea_2_turbo_i8x.ckpt`** (Krea 2 Turbo, 8-bit) |
| License | **`krea-2-community-license`** |
| Seed / steps / cfg | 810 / 8 / 1 |
| Size | 1344×768 |
| shift / sampler | vendor defaults (Krea preset, not overridden) |
| Wall time | 118.35 s |

Prompt (`assets/prompts/hero.txt`), verbatim:

```
A compact handheld synthesizer resting on a matte concrete surface, three-quarter overhead view, light grey anodised aluminium body with a fine bead-blasted finish, a small dark dot-matrix display recessed at the top, four machined metal knobs in a row and two rows of small white keys below, exactly one knob in deep blue, completely blank unmarked faceplate with no lettering, soft diffuse studio light from the upper left, shallow soft shadow, 50 mm lens, sharp focus throughout, product photograph.
```

**A/B result — Krea 2 Turbo beat FLUX.2 klein.** Same prompt, same seed 810, klein at
6 steps + shift 4.5 (54.67 s) vs Krea at 8 steps (118.35 s). Krea won on brief compliance and
craft: it rendered **four** knobs and **two** rows of keys as asked (klein's best gave three
knobs and one row), a true dot-matrix grid, and materially convincing bead-blasted aluminium.
Krea cost 2.2× the wall time for a one-off image — an easy trade. The klein A/B loser is kept
at `assets/raw/hero-klein-s810.png`.

Post-process — `tools/assets/hero.py`: `hero.png` is the native 1344×768 frame;
`hero-og.png` is centre-cropped to 1200:630 *then* LANCZOS-resized, so the device is not
squashed to fit the wider ratio.

The og:image ships **twice, byte for byte**: `docs/img/hero-og.png` for the README and
`public/hero-og.png` for the web. `index.html` references it as `/hero-og.png`, and Vite
serves the site root from `public/` — `docs/` is not served at all, so the docs copy alone
would 404 for every scraper. `tools/assets/qa.py` asserts the two copies stay identical.

**The quantizer choice is load-bearing.** A photographic 1344×768 PNG is 1090 KB, over the
400 KB budget. MEDIANCUT splits color space by pixel population, and this frame is ~99 %
neutral grey with one small deep blue knob — so at 256 colors it still destroyed the knob
(blue excess b−r **39.6 → 8.1**, visibly black) while the file-size gate passed happily.
MAXCOVERAGE optimizes for coverage instead and preserves it exactly (**39.6 → 40.0**) in a
*smaller* file. The encoder therefore pairs the size gate with a **blue-retention gate** that
re-measures the shipped bytes through the source's own blue mask and refuses any encoding
that keeps < 80 % of it.

QA (D4): exactly one device ✓ · **zero legible text — verified on a native-resolution crop of
the faceplate** (`assets/qa/hero-krea-s810_faceplate.png`), because a whole-image glance
downsamples away exactly the garbled lettering this gate is looking for ✓ · no doubled knobs
or geometry ✓ · no Teenage Engineering logo, silhouette or trade dress ✓ · the single blue
knob is present ✓ · `hero.png` 334 KB and `hero-og.png` 256 KB, both ≤ 400 KB ✓ · palette
encode verified against the source side by side at native scale
(`assets/qa/hero_palette_check.png`) ✓.

README caption (required, not optional):

> concept render. generated locally with Krea 2 Turbo (seed 810, 8 steps, cfg 1, 1344×768).
> the krea-2-community-license applies to this image — see ASSETS.md. **pulsar is not a
> teenage engineering product and is not affiliated with them.**

```
regenerate: tools/assets/generate.sh hero-krea
```

Rejected: **klein 808** — melted, irregular keys and a lone blue knob stranded mid-faceplate.
**klein 809** — five knobs (brief says four). **klein 810** — the best klein frame and the
A/B loser: clean and text-free, but only three knobs and one key row.

---

## `public/textures/enclosure-grain-512.png` — enclosure grain tile

| | |
|---|---|
| Generated | 2026-08-03 |
| Checkpoint | `flux_2_klein_9b_i8x.ckpt` |
| License | `flux-non-commercial-license` |
| Seed / steps / cfg | 4242 / 4 / 1 |
| Size | 1024×1024 raw → 512×512 shipped (136 KB) |
| shift / sampler | vendor defaults |
| Wall time | 41.41 s |

Prompt (`assets/prompts/grain.txt`), verbatim:

```
Flat top-down macro photograph of bead-blasted anodised aluminium, even fine matte grain edge to edge, unbroken continuous surface filling the whole frame, uniform soft lighting with no hotspots and no vignette, neutral light grey, sharp focus throughout.
```

klein **cannot** produce a seamless tile: it is a DiT with no `Conv2d` in the denoiser, so
circular-padding "seamless tiling" extensions patch only the VAE, run without error, and
still emit seams. Tiling is therefore deterministic, in `tools/assets/grain.py`:

1. **flatness scan** — score every candidate 256² window by the spread of its 8×8 block means.
   Chosen crop `(448, 768)`, block-mean stddev 1.80 (the flattest of the three seeds).
2. **normalize** — grayscale, mean → 128, ±2.5σ → ±10.
3. **mirror-quad** — 512² from the crop and its three mirrors. Seamless *by construction*:
   opposite edges are literally the same pixels. The mirror symmetry is undetectable at 5 %
   opacity and a 256 px repeat.
4. **seam gate** — offset the tile by half, `FIND_EDGES`, compare edge energy on the seam
   cross against the interior.

QA (D5): frame-level quadrant drift is reported but is **not** the gate — every 1024 render
carries the model's lighting gradient and the tile is one 256 window out of sixteen; the gate
is on the crop that actually ships. Chosen crop quadrant means
`[165.0, 165.8, 163.0, 162.8]`, **max drift 1.68 luma** ≤ 6 ✓ (seeds 4243/4244 measured 2.02
and 1.74 and would also have passed). Normalized-crop drift **0.49** of a ±10 range ✓ —
measured on the crop, not the tile, because mirror-quad gives all four tile quadrants an
identical mean by construction and a tile-level check would read 0.00 even for a badly sloped
source. Tile mean 128.0, stddev 4.01, range 114–148. **Seam ratio 0.987** < 1.25 ✓, plus the
2×2 contact sheet at the shipped 256 px repeat (`assets/qa/grain_contact_2x2.png`) inspected
by eye: no seam, no visible tiling structure, no mirror artifact.

Shipped at 136 KB rather than the estimated 60–90 KB: the entropy is the grain itself, and
palette encoding at 64/32/16 colors made the file *larger*, not smaller.

Intended CSS (`.device::before`): `background: url(...) repeat; background-size: 256px 256px;
opacity: .05; mix-blend-mode: multiply;` zeroed under `prefers-contrast: more`. The shipped
code path keeps the inline `feTurbulence baseFrequency=0.85 stitchTiles='stitch'` data-URI
fallback, which is mathematically seamless and costs no asset.

```
regenerate: tools/assets/generate.sh grain
```

Rejected: **4243** and **4244** — both pass the crop flatness gate, but 4242's flattest window
had the lowest low-frequency drift of the three (block-mean stddev 1.80 vs 1.94 and 1.91).

---

## Verifying this file

```bash
python3 tools/assets/qa.py        # every dimension, color budget, size and container check
pnpm test -- paletteDrift         # the TS and Python palettes are identical
tools/assets/generate.sh list     # the pinned seeds
```
