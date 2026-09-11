#!/usr/bin/env node
// pulsar — ivory-capture (plan Ivory).
//
// Capture-and-assert script for the redesign. Not part of the build; run by
// hand against a preview server.
//
// Serving: this script does NOT start a server itself.
//   1. In one terminal:  pnpm build && pnpm preview
//      (preview serves on :4173 with the COOP/COEP headers the app expects)
//   2. In another terminal:
//        node tools/ivory-capture.mjs              # captures + assertions
//        node tools/ivory-capture.mjs --selftest   # headless audio gate
//
// Captures load the first registered song before shooting, so the pattern
// grid and the order strip show real content and the play key is live — the
// state the design references were drawn in. `--empty` skips that and shoots
// the fresh empty document instead.
//
// Playwright is intentionally NOT a devDependency of this repo — it is
// imported from an absolute path outside the repo (see IMPORT below), and
// the script adds nothing to package.json / pnpm-lock.yaml.

import { chromium } from '/private/tmp/oregon-mobile-remediation/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const CHROME_PATH =
  '/Users/alexvoigt/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'

const WIDTHS = [1024, 736, 390, 320]
const VARIANTS = ['standalone', 'embed']
const MODES = ['live', 'tracker']
const HEIGHT = 900
const TRACKER_MIN_WIDTH = 720

function parseArgs(argv) {
  const out = {
    base: 'http://localhost:4173',
    out: '/private/tmp/claude-501/-Users-alexvoigt-Documents-GPT-5-os/5758cfc0-ed5c-41b8-a4e7-6c97302c20ce/scratchpad/ivory/out',
    selftest: false,
    empty: false,
  }
  for (const arg of argv) {
    if (arg === '--selftest') out.selftest = true
    else if (arg === '--empty') out.empty = true
    else if (arg.startsWith('--base=')) out.base = arg.slice('--base='.length)
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length)
  }
  return out
}

function pad(s, n) {
  s = String(s)
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

/** Runs in the page. Computes an element's accessible name with a small,
 *  deliberately simplified priority order (not full accname):
 *  aria-labelledby > aria-label > associated <label> > own textContent > title.
 */
function accessibleNameFn() {
  function textOf(el) {
    return (el && el.textContent ? el.textContent : '').trim()
  }
  return function accessibleName(el) {
    const labelledby = el.getAttribute('aria-labelledby')
    if (labelledby) {
      const ids = labelledby.split(/\s+/).filter(Boolean)
      const joined = ids
        .map((id) => {
          const ref = document.getElementById(id)
          return ref ? textOf(ref) : ''
        })
        .filter(Boolean)
        .join(' ')
        .trim()
      if (joined) return joined
    }
    const ariaLabel = el.getAttribute('aria-label')
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim()
    if ('labels' in el && el.labels && el.labels.length > 0) {
      const joined = Array.from(el.labels)
        .map((l) => textOf(l))
        .filter(Boolean)
        .join(' ')
        .trim()
      if (joined) return joined
    }
    const closestLabel = el.closest('label')
    if (closestLabel) {
      const joined = textOf(closestLabel)
      if (joined) return joined
    }
    const own = textOf(el)
    if (own) return own
    const title = el.getAttribute('title')
    if (title && title.trim()) return title.trim()
    return ''
  }
}

async function checkUnnamedControls(page) {
  return page.evaluate((accessibleNameSrc) => {
    // eslint-disable-next-line no-new-func
    const accessibleName = new Function(`return (${accessibleNameSrc})()`)()
    const isInClosedDialog = (el) => {
      let node = el
      while (node) {
        if (node.tagName === 'DIALOG' && !node.hasAttribute('open')) return true
        node = node.parentElement
      }
      return false
    }
    const els = Array.from(document.querySelectorAll('button, input, select'))
    const failures = []
    for (const el of els) {
      if (el.hidden) continue
      if (el.getAttribute('type') === 'hidden') continue
      if (isInClosedDialog(el)) continue
      const name = accessibleName(el)
      if (!name) {
        const tag = el.tagName.toLowerCase()
        const id = el.id ? `#${el.id}` : ''
        const cls = el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).join('.')
          : ''
        const html = el.outerHTML.slice(0, 120)
        failures.push(`${tag}${id}${cls} :: ${html}`)
      }
    }
    return failures
  }, accessibleNameFn.toString())
}

async function runCaptures(base, outDir, loadSong) {
  await mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  })

  const rows = []
  const failures = []

  try {
    for (const mode of MODES) {
      for (const width of WIDTHS) {
        for (const variant of VARIANTS) {
          const context = await browser.newContext({
            viewport: { width, height: HEIGHT },
            deviceScaleFactor: 1,
          })
          const page = await context.newPage()

          const qs = variant === 'embed' ? '?stub&embed' : '?stub'
          await page.goto(`${base}/${qs}`, { waitUntil: 'load' })

          await page.waitForSelector('main[aria-label="pulsar"]')
          await page.waitForSelector('nav[aria-label="Workspace"] button')
          await page.waitForTimeout(400)
          if (loadSong) {
            // The song picker is a native select; the first option is the
            // disabled placeholder, index 1 is the first registered song.
            await page.selectOption('[data-slot="preset-bar"] select', { index: 1 })
            await page.waitForTimeout(250)
          }

          const captureFailures = []

          // --- mode setup + mode assertion ------------------------------
          const navButtons = page.locator('nav[aria-label="Workspace"] button')
          if (mode === 'tracker') {
            const trackerBtn = navButtons.nth(1)
            const isDisabled = await trackerBtn.isDisabled()
            if (width < TRACKER_MIN_WIDTH) {
              if (!isDisabled) {
                captureFailures.push(
                  `expected Tracker button disabled at width ${width}, but it was enabled`,
                )
              }
              const hasVoice = (await page.locator('section[aria-label="voice controls"]').count()) > 0
              const hasTracker = (await page.locator('section[aria-label="tracker"]').count()) > 0
              if (!hasVoice || hasTracker) {
                captureFailures.push(
                  `expected instrument view at width ${width} (voice controls present, tracker absent); got voice=${hasVoice} tracker=${hasTracker}`,
                )
              }
            } else {
              if (isDisabled) {
                captureFailures.push(
                  `expected Tracker button enabled at width ${width}, but it was disabled`,
                )
              } else {
                await trackerBtn.click()
              }
              const hasTracker = (await page.locator('section[aria-label="tracker"]').count()) > 0
              if (!hasTracker) {
                captureFailures.push(`expected section[aria-label="tracker"] after clicking Tracker at width ${width}`)
              }
            }
          } else {
            const hasVoice = (await page.locator('section[aria-label="voice controls"]').count()) > 0
            if (!hasVoice) {
              captureFailures.push('expected section[aria-label="voice controls"] in live mode')
            }
            const firstPressed = await navButtons.nth(0).getAttribute('aria-pressed')
            if (firstPressed !== 'true') {
              captureFailures.push(`expected first Workspace button aria-pressed="true" in live mode, got ${firstPressed}`)
            }
          }

          await page.waitForTimeout(300)

          const fileName = variant === 'embed' ? `embed-${mode}-${width}.png` : `${mode}-${width}.png`
          const filePath = `${outDir}/${fileName}`
          await page.screenshot({ path: filePath, fullPage: true })

          // --- assertion 1: no horizontal document overflow -------------
          const overflow = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }))
          const overflowOk = overflow.scrollWidth <= overflow.innerWidth
          if (!overflowOk) {
            captureFailures.push(
              `document overflow: scrollWidth ${overflow.scrollWidth} > innerWidth ${overflow.innerWidth}`,
            )
          }

          // --- assertion 2: keybed top < 500 at width <= 390 -------------
          let keybedTop = 'n/a'
          if (width <= 390) {
            const top = await page.evaluate(() => {
              const el = document.querySelector('[role="toolbar"][aria-label^="keybed"]')
              if (!el) return null
              return el.getBoundingClientRect().top + window.scrollY
            })
            if (top === null) {
              captureFailures.push('keybed toolbar not found at width <= 390')
              keybedTop = 'missing'
            } else {
              keybedTop = Math.round(top)
              if (!(top < 500)) {
                captureFailures.push(`keybed top ${top} not < 500 at width ${width}`)
              }
            }
          }

          // --- assertion 3: screen canvas CSS width multiple of 128 ------
          let canvasWidth = 'n/a'
          const canvasCount = await page.locator('.well > canvas').count()
          if (canvasCount > 0) {
            const w = await page.evaluate(() => {
              const canvas = document.querySelector('.well > canvas')
              return canvas ? parseFloat(getComputedStyle(canvas).width) : null
            })
            canvasWidth = w
            const ok = Number.isInteger(w) && w % 128 === 0 && w > 0
            if (!ok) {
              captureFailures.push(`screen canvas width ${w} is not a positive multiple of 128`)
            }
          } else if (mode !== 'tracker') {
            // Screen is expected outside tracker mode; absence is a failure there.
            captureFailures.push('screen canvas (.well > canvas) not found')
            canvasWidth = 'missing'
          }
          // mode === 'tracker' with no canvas: leave canvasWidth as 'n/a', no failure.

          // --- assertion 4: every control has an accessible name ---------
          const unnamed = await checkUnnamedControls(page)
          if (unnamed.length > 0) {
            for (const u of unnamed) {
              captureFailures.push(`unnamed control: ${u}`)
            }
          }

          rows.push({
            mode,
            width,
            variant,
            overflow: `${overflow.scrollWidth}/${overflow.innerWidth}`,
            keybedTop,
            canvasWidth,
            unnamed: unnamed.length,
            file: fileName,
          })

          if (captureFailures.length > 0) {
            failures.push({ mode, width, variant, issues: captureFailures })
          }

          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
  }

  // --- print the table ------------------------------------------------
  const header = [
    pad('mode', 8),
    pad('width', 6),
    pad('variant', 10),
    pad('scrollW/innerW', 16),
    pad('keybedTop', 10),
    pad('canvasW', 8),
    pad('unnamed', 8),
    'file',
  ].join('| ')
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const r of rows) {
    console.log(
      [
        pad(r.mode, 8),
        pad(r.width, 6),
        pad(r.variant, 10),
        pad(r.overflow, 16),
        pad(r.keybedTop, 10),
        pad(r.canvasWidth, 8),
        pad(r.unnamed, 8),
        r.file,
      ].join('| '),
    )
  }

  if (failures.length === 0) {
    console.log('\nCAPTURE PASS')
    return 0
  }

  console.log('\nCAPTURE FAIL')
  for (const f of failures) {
    console.log(`  [${f.mode} ${f.width} ${f.variant}]`)
    for (const issue of f.issues) console.log(`    - ${issue}`)
  }
  return 1
}

async function runSelftest(base) {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  })

  let exitCode = 1
  try {
    const context = await browser.newContext({ viewport: { width: 1024, height: HEIGHT } })
    const page = await context.newPage()
    await page.goto(`${base}/?selftest`, { waitUntil: 'load' })

    const deadline = Date.now() + 120_000
    let title = await page.title()
    while (
      title !== 'pulsar-selftest-pass' &&
      title !== 'pulsar-selftest-fail' &&
      Date.now() < deadline
    ) {
      await page.waitForTimeout(500)
      title = await page.title()
    }

    await page.waitForSelector('pre[data-selftest]', { timeout: 5_000 }).catch(() => null)
    const preText = await page
      .locator('pre[data-selftest]')
      .textContent()
      .catch(() => null)

    console.log(preText ?? '(no pre[data-selftest] content found)')

    if (title === 'pulsar-selftest-pass') {
      console.log('\nSELFTEST PASS')
      exitCode = 0
    } else if (title === 'pulsar-selftest-fail') {
      console.log('\nSELFTEST FAIL')
      exitCode = 1
    } else {
      console.log(`\nSELFTEST FAIL (timed out after 120s; title was "${title}")`)
      exitCode = 1
    }

    await context.close()
  } finally {
    await browser.close()
  }
  return exitCode
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const code = args.selftest
    ? await runSelftest(args.base)
    : await runCaptures(args.base, args.out, !args.empty)
  process.exit(code)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
