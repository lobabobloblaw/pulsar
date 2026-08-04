#!/usr/bin/env bash
# Regenerate any PULSAR raster asset from its pinned recipe.
#
#   tools/assets/generate.sh <asset> [seed]     one generation, then the post-process
#   tools/assets/generate.sh post               post-process only, no GPU
#   tools/assets/generate.sh list               show the pinned seeds
#
# assets: boot | icon-pulse | icon-triangle | icon-noise | icon-dpcm
#         emblem | hero-klein | hero-krea | grain
#
# Same seed + same flags is bit-reproducible on this machine, so passing no seed reproduces
# the shipped file exactly. Pass a seed to explore; the post-process still reads the PINNED
# filename, so an exploration does not overwrite a shipped asset until you repoint the
# source in the corresponding tools/assets/*.py.
#
# Full provenance -- prompts, wall times, rejected seeds, QA results -- is in ASSETS.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

KLEIN=flux_2_klein_9b_i8x.ckpt
KREA=krea_2_turbo_i8x.ckpt

preflight() {
  if pgrep -x DrawThings >/dev/null; then
    echo "error: the Draw Things app is running; it will contend for the GPU (measured 14x" >&2
    echo "       slowdown). Quit it and retry." >&2
    exit 1
  fi
  if ! draw-things-cli models list --downloaded-only | grep -q "$1"; then
    echo "error: $1 is not downloaded. Get it in the Draw Things app; never auto-download." >&2
    exit 1
  fi
}

# gen <model> <promptfile> <seed> <steps> <w> <h> <out> [config-json]
gen() {
  local model=$1 prompt=$2 seed=$3 steps=$4 w=$5 h=$6 out=$7 cfgjson=${8:-}
  preflight "$model"
  local -a extra=()
  [ -n "$cfgjson" ] && extra=(--config-json "$cfgjson")
  # Krea block-buffers stdout when piped; script(1) gives it a tty so progress is visible.
  script -q /dev/null draw-things-cli generate \
    --model "$model" --prompt-file "$prompt" \
    --width "$w" --height "$h" --steps "$steps" --cfg 1 --seed "$seed" \
    --no-download-missing --disable-preview "${extra[@]}" --output "$out"
  echo "wrote $out"
  echo "now log it:  python3 ~/.claude/skills/draw-things/scripts/dt_gallery.py log \\"
  echo "  --file $out --model $model --prompt \"\$(cat $prompt)\" \\"
  echo "  --seed $seed --steps $steps --cfg 1 --width $w --height $h --time <seconds>"
}

post_boot()  { python3 tools/assets/pixelize.py assets/raw/boot-s1337.png \
                 src/assets/boot/boot-128x64.png --divisor 8 --colors 16 \
                 --preview assets/qa/boot_preview_1024.png; }
post_icons() { python3 tools/assets/icons.py --mode maxpool; }
post_fav()   { python3 tools/assets/favicon.py; }
post_hero()  { python3 tools/assets/hero.py; }
post_grain() { python3 tools/assets/grain.py; }

case "${1:-}" in
  boot)          gen "$KLEIN" assets/prompts/boot.txt          "${2:-1337}" 4 1024 512  "assets/raw/boot-s${2:-1337}.png"
                 [ -z "${2:-}" ] && post_boot ;;
  icon-pulse)    gen "$KLEIN" assets/prompts/icon-pulse.txt    "${2:-2019}" 6 512  512  "assets/raw/icon-pulse-s${2:-2019}-shift45.png" '{"shift":4.5}'
                 [ -z "${2:-}" ] && post_icons ;;
  icon-triangle) gen "$KLEIN" assets/prompts/icon-triangle.txt "${2:-2006}" 4 512  512  "assets/raw/icon-triangle-s${2:-2006}.png"
                 [ -z "${2:-}" ] && post_icons ;;
  icon-noise)    gen "$KLEIN" assets/prompts/icon-noise.txt    "${2:-2007}" 4 512  512  "assets/raw/icon-noise-s${2:-2007}.png"
                 [ -z "${2:-}" ] && post_icons ;;
  icon-dpcm)     gen "$KLEIN" assets/prompts/icon-dpcm.txt     "${2:-2016}" 4 512  512  "assets/raw/icon-dpcm-s${2:-2016}.png"
                 [ -z "${2:-}" ] && post_icons ;;
  emblem)        gen "$KLEIN" assets/prompts/favicon-emblem.txt "${2:-5150}" 6 1024 1024 "assets/raw/emblem-s${2:-5150}.png" '{"shift":4.5}'
                 [ -z "${2:-}" ] && post_fav ;;
  hero-klein)    gen "$KLEIN" assets/prompts/hero.txt          "${2:-810}"  6 1344 768  "assets/raw/hero-klein-s${2:-810}.png" '{"shift":4.5}' ;;
  hero-krea)     gen "$KREA"  assets/prompts/hero.txt          "${2:-810}"  8 1344 768  "assets/raw/hero-krea-s${2:-810}.png"
                 [ -z "${2:-}" ] && post_hero ;;
  grain)         gen "$KLEIN" assets/prompts/grain.txt         "${2:-4242}" 4 1024 1024 "assets/raw/grain-s${2:-4242}.png"
                 [ -z "${2:-}" ] && post_grain ;;
  post)          post_boot; post_icons; post_fav; post_hero; post_grain
                 python3 tools/assets/qa.py ;;
  list)
    cat <<'EOF'
asset          model   seed  steps  size       overrides
boot           klein   1337  4      1024x512   -
icon-pulse     klein   2019  6      512x512    shift 4.5   (lower band cropped in icons.py)
icon-triangle  klein   2006  4      512x512    -
icon-noise     klein   2007  4      512x512    -
icon-dpcm      klein   2016  4      512x512    -
emblem         klein   5150  6      1024x1024  shift 4.5
hero-klein     klein   810   6      1344x768   shift 4.5   (A/B loser)
hero-krea      krea    810   8      1344x768   vendor       (shipped hero)
grain          klein   4242  4      1024x1024  -
EOF
    ;;
  *) sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
