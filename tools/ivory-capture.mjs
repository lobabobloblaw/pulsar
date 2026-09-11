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
// After the fine-pointer pass a COARSE pass runs: contexts with
// `hasTouch: true, isMobile: true` (so `(pointer: coarse)` matches) at 320,
// 390 and 820 — 820 opens the Tracker and the Settings strip — asserting no
// document overflow, every visible button/summary at least 44x44 and every
// visible field at a computed font-size of at least 16px, saved as
// `touch-{width}.png`. This is the pass the homepage's phone shell (a 320x568
// touch iframe) exercises; fine-pointer captures cannot see these defects.
// On the phone widths it also starts the (stub) engine with a key press and
// asserts the keybed's top offset is the same with the Start audio cap and
// without it — the transport row must not change its row count when audio
// starts, or the instrument jumps under the finger that started it.
//
// PHONE PAGES (phone-pages branch): below 720px the workspace switch reads
// Play and Voice and pages the shell. The phone pass (320x568 and 390x844,
// standalone and embed, fine and coarse) shoots BOTH pages as `play-{w}.png`
// and `voice-{w}.png` (`embed-`, `touch-` prefixes for the variants) and
// asserts the segment labels, that no segment is disabled, the page
// structure, no horizontal overflow, the keybed under 500px on Play, the
// lattice on Voice, vertical fit at 390 embedded (both pages) and at 320
// embedded (Play; Voice may scroll there and its height is reported), the
// coarse floors on both pages, the start-cap jump on Play, and that a song
// keeps playing — position readout moving, play key pressed — across a
// Voice and back switch.
//
// Playwright is intentionally NOT a devDependency of this repo — it is
// imported from an absolute path outside the repo (see IMPORT below), and
// the script adds nothing to package.json / pnpm-lock.yaml.

import { chromium } from '/private/tmp/oregon-mobile-remediation/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const CHROME_PATH =
  '/Users/alexvoigt/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'

/** Wide widths: the Instrument / Tracker pass. The phone widths are the
 *  paged pass below. */
const WIDTHS = [1024, 736]
const PHONE = [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]
const PAGES = ['play', 'voice']
/** The coarse-pointer pass: phone portrait twice, then a tablet that can
 *  open the tracker. */
const TOUCH = [{ width: 820, height: 1180, tracker: true }]
const MIN_TARGET = 44
const MIN_FIELD_FONT = 16
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
    touchOnly: false,
  }
  for (const arg of argv) {
    if (arg === '--selftest') out.selftest = true
    else if (arg === '--empty') out.empty = true
    else if (arg === '--touch-only') out.touchOnly = true
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
            const { w, wellInner } = await page.evaluate(() => {
              const canvas = document.querySelector('.well > canvas')
              const well = document.querySelector('.well')
              const cs = well ? getComputedStyle(well) : null
              return {
                w: canvas ? parseFloat(getComputedStyle(canvas).width) : null,
                wellInner: well && cs ? well.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : null,
              }
            })
            canvasWidth = `${w}/${wellInner}`
            const ok = Number.isInteger(w) && w % 128 === 0 && w > 0
            if (!ok) {
              captureFailures.push(`screen canvas width ${w} is not a positive multiple of 128`)
            }
            if (wellInner !== null && w !== null && w > wellInner) {
              captureFailures.push(`lattice ${w}px wider than the well's inner ${wellInner}px`)
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
    pad('canvas/well', 12),
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
        pad(r.canvasWidth, 12),
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

/** Runs in the page: every visible button/summary under 44x44 and every
 *  visible field under 16px, reported as `tag#id.class WxH` / `tag#id.class NNpx`. */
function touchAuditFn() {
  return function touchAudit(minTarget, minFont) {
    const visible = (el) => {
      if (el.closest('dialog:not([open])')) return false
      if (el.hidden || el.getAttribute('type') === 'hidden') return false
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      return el.getClientRects().length > 0
    }
    const name = (el) => {
      const cls = [...el.classList].map((c) => `.${c}`).join('')
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}`
    }
    const smallTargets = []
    for (const el of document.querySelectorAll('button, summary')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < minTarget - 0.5 || r.height < minTarget - 0.5) {
        smallTargets.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
    }
    const smallFonts = []
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (!visible(el)) continue
      const px = parseFloat(getComputedStyle(el).fontSize)
      if (!(px >= minFont)) smallFonts.push(`${name(el)} ${px}px`)
    }
    const well = document.querySelector('.well')
    const canvas = document.querySelector('.well > canvas')
    const wellInner = well === null ? null : well.clientWidth - parseFloat(getComputedStyle(well).paddingLeft) - parseFloat(getComputedStyle(well).paddingRight)
    return {
      coarse: matchMedia('(pointer: coarse)').matches,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      wellInner,
      canvasWidth: canvas === null ? null : parseFloat(getComputedStyle(canvas).width),
      smallTargets,
      smallFonts,
    }
  }
}

async function runTouch(base, outDir, loadSong) {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  })
  const rows = []
  const failures = []
  try {
    for (const t of TOUCH) {
      const context = await browser.newContext({
        viewport: { width: t.width, height: t.height },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      })
      const page = await context.newPage()
      await page.goto(`${base}/?stub`, { waitUntil: 'load' })
      await page.waitForSelector('nav[aria-label="Workspace"] button')
      await page.waitForTimeout(400)
      if (loadSong) {
        await page.selectOption('[data-slot="preset-bar"] select', { index: 1 })
        await page.waitForTimeout(250)
      }
      const issues = []
      const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
      if (!coarse) issues.push('(pointer: coarse) does not match under touch emulation')

      // Open the Settings strip everywhere; open the Tracker where it is allowed.
      await page.click('button[aria-controls="settings-strip"]')
      await page.waitForTimeout(150)
      if (t.tracker) {
        const trackerBtn = page.locator('nav[aria-label="Workspace"] button').nth(1)
        if (await trackerBtn.isDisabled()) issues.push(`Tracker disabled at ${t.width}`)
        else await trackerBtn.click()
        await page.waitForTimeout(300)
        if ((await page.locator('section[aria-label="tracker"]').count()) === 0) {
          issues.push('tracker section absent after opening it')
        }
      }
      await page.waitForTimeout(300)

      // Audit BEFORE the screenshot: a full-page capture under mobile
      // emulation re-applies the device metrics and drops the touch pointer,
      // so anything measured after it is measured under `pointer: fine`.
      const audit = await page.evaluate(
        ([src, minTarget, minFont]) => new Function(`return (${src})()`)()(minTarget, minFont),
        [touchAuditFn.toString(), MIN_TARGET, MIN_FIELD_FONT],
      )
      if (!audit.coarse) issues.push('(pointer: coarse) did not match at audit time')
      const fileName = `touch-${t.width}.png`
      await page.screenshot({ path: `${outDir}/${fileName}`, fullPage: true })

      if (audit.scrollWidth > audit.innerWidth) {
        issues.push(`document overflow: scrollWidth ${audit.scrollWidth} > innerWidth ${audit.innerWidth}`)
      }
      for (const s of audit.smallTargets) issues.push(`target under ${MIN_TARGET}px: ${s}`)
      for (const s of audit.smallFonts) issues.push(`field under ${MIN_FIELD_FONT}px: ${s}`)

      if (audit.canvasWidth !== null && audit.wellInner !== null && audit.canvasWidth > audit.wellInner) {
        issues.push(`lattice ${audit.canvasWidth}px wider than the well's inner ${audit.wellInner}px`)
      }

      // The start-cap jump check, on a FRESH page in the same touch context:
      // the full-page screenshot above dropped this page's touch pointer, and
      // the check has to run under the coarse floors the phone really has.
      let jump = 'n/a'
      if (!t.tracker) {
        const p2 = await context.newPage()
        await p2.goto(`${base}/?stub`, { waitUntil: 'load' })
        await p2.waitForSelector('nav[aria-label="Workspace"] button')
        await p2.waitForTimeout(400)
        if (loadSong) {
          await p2.selectOption('[data-slot="preset-bar"] select', { index: 1 })
          await p2.waitForTimeout(250)
        }
        const keybedTop = () =>
          p2.evaluate(() => {
            const el = document.querySelector('[role="toolbar"][aria-label^="keybed"]')
            return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null
          })
        const capBefore = await p2.locator('button.start').count()
        if (capBefore !== 1) issues.push(`expected the Start audio cap before the gesture, found ${capBefore}`)
        const idleTop = await keybedTop()
        // The first key press is the audio gesture: App.startAudio -> the
        // stub's start(), which publishes starting then running.
        await p2.keyboard.press('z')
        try {
          await p2.waitForSelector('button.start', { state: 'detached', timeout: 3000 })
        } catch {
          issues.push('the Start audio cap did not leave after the key gesture')
        }
        await p2.waitForTimeout(150)
        const runningTop = await keybedTop()
        jump = `${idleTop}/${runningTop}`
        if (idleTop !== runningTop) {
          issues.push(`keybed top moved when audio started: ${idleTop} -> ${runningTop}`)
        }
        await p2.close()
      }
      rows.push({
        width: t.width,
        state: t.tracker ? 'tracker+settings' : 'live+settings',
        overflow: `${audit.scrollWidth}/${audit.innerWidth}`,
        well: audit.wellInner === null ? 'n/a' : `${audit.canvasWidth}/${audit.wellInner}`,
        targets: audit.smallTargets.length,
        fonts: audit.smallFonts.length,
        jump,
        file: fileName,
      })
      if (issues.length > 0) failures.push({ width: t.width, issues })
      await context.close()
    }
  } finally {
    await browser.close()
  }

  const header = [
    pad('touch', 8),
    pad('width', 6),
    pad('state', 18),
    pad('scrollW/innerW', 16),
    pad('canvas/well', 12),
    pad('<44px', 6),
    pad('<16px', 6),
    pad('keybed idle/run', 16),
    'file',
  ].join('| ')
  console.log('')
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const r of rows) {
    console.log(
      [pad('coarse', 8), pad(r.width, 6), pad(r.state, 18), pad(r.overflow, 16), pad(r.well, 12), pad(r.targets, 6), pad(r.fonts, 6), pad(r.jump, 16), r.file].join('| '),
    )
  }
  if (failures.length === 0) {
    console.log('\nTOUCH PASS')
    return 0
  }
  console.log('\nTOUCH FAIL')
  for (const f of failures) {
    console.log(`  [coarse ${f.width}]`)
    for (const i of f.issues) console.log(`    - ${i}`)
  }
  return 1
}

/** The phone pass: both pages at each phone width and variant, fine or
 *  coarse. Every page gets a fresh browser page, because a full-page
 *  screenshot under mobile emulation drops the touch pointer. */
async function runPhone(base, outDir, loadSong, coarse) {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  })
  const rows = []
  const failures = []
  const label = coarse ? 'coarse' : 'fine'
  try {
    for (const t of PHONE) {
      for (const variant of VARIANTS) {
        const context = await browser.newContext({
          viewport: { width: t.width, height: t.height },
          deviceScaleFactor: 1,
          ...(coarse ? { hasTouch: true, isMobile: true } : {}),
        })
        const qs = variant === 'embed' ? '?stub&embed' : '?stub'
        const open = async () => {
          const page = await context.newPage()
          await page.goto(`${base}/${qs}`, { waitUntil: 'load' })
          await page.waitForSelector('nav[aria-label="Workspace"] button')
          await page.waitForTimeout(400)
          if (loadSong) {
            await page.selectOption('[data-slot="preset-bar"] select', { index: 1 })
            await page.waitForTimeout(250)
          }
          return page
        }
        const segment = (page, name) => page.locator('nav[aria-label="Workspace"] button', { hasText: name })
        const keybedTop = (page) =>
          page.evaluate(() => {
            const el = document.querySelector('[role="toolbar"][aria-label^="keybed"]')
            return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null
          })

        for (const pageName of PAGES) {
          const issues = []
          const page = await open()

          const labels = (await page.locator('nav[aria-label="Workspace"] button').allTextContents()).map((x) => x.trim())
          if (labels.join('|') !== 'Play|Voice') issues.push(`segments are ${JSON.stringify(labels)}, expected Play|Voice`)
          const disabledCount = await page.locator('nav[aria-label="Workspace"] button:disabled').count()
          if (disabledCount > 0) issues.push(`${disabledCount} disabled segment(s)`)
          if (pageName === 'voice') {
            await segment(page, 'Voice').click()
            await page.waitForTimeout(300)
          }
          const pressed = await segment(page, pageName === 'play' ? 'Play' : 'Voice').getAttribute('aria-pressed')
          if (pressed !== 'true') issues.push(`${pageName} segment is not pressed`)

          const hasKeys = (await page.locator('[role="toolbar"][aria-label^="keybed"]').count()) > 0
          const hasWell = (await page.locator('.well > canvas').count()) > 0
          const hasFooter = (await page.locator('.project').count()) > 0
          if (pageName === 'play' && (!hasKeys || hasWell || !hasFooter)) {
            issues.push(`play page structure: keys=${hasKeys} well=${hasWell} footer=${hasFooter}`)
          }
          if (pageName === 'voice' && (hasKeys || !hasWell || hasFooter)) {
            issues.push(`voice page structure: keys=${hasKeys} well=${hasWell} footer=${hasFooter}`)
          }

          // Coarse floors, audited BEFORE the screenshot (see runTouch).
          let audit = null
          if (coarse) {
            audit = await page.evaluate(
              ([src, minTarget, minFont]) => new Function(`return (${src})()`)()(minTarget, minFont),
              [touchAuditFn.toString(), MIN_TARGET, MIN_FIELD_FONT],
            )
            if (!audit.coarse) issues.push('(pointer: coarse) did not match')
            for (const x of audit.smallTargets) issues.push(`target under ${MIN_TARGET}px: ${x}`)
            for (const x of audit.smallFonts) issues.push(`field under ${MIN_FIELD_FONT}px: ${x}`)
          }

          const geo = await page.evaluate(() => {
            const canvas = document.querySelector('.well > canvas')
            const well = document.querySelector('.well')
            const cs = well ? getComputedStyle(well) : null
            return {
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
              scrollHeight: document.documentElement.scrollHeight,
              clientHeight: document.documentElement.clientHeight,
              canvas: canvas ? parseFloat(getComputedStyle(canvas).width) : null,
              wellInner: well && cs ? well.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : null,
            }
          })
          if (geo.scrollWidth > geo.innerWidth) issues.push(`document overflow: ${geo.scrollWidth} > ${geo.innerWidth}`)

          let top = 'n/a'
          if (pageName === 'play') {
            top = await keybedTop(page)
            if (top === null || !(top < 500)) issues.push(`keybed top ${top} not < 500`)
          }
          if (pageName === 'voice') {
            const ok = Number.isInteger(geo.canvas) && geo.canvas % 128 === 0 && geo.canvas > 0
            if (!ok) issues.push(`screen canvas width ${geo.canvas} is not a positive multiple of 128`)
            if (geo.wellInner !== null && geo.canvas > geo.wellInner) {
              issues.push(`lattice ${geo.canvas}px wider than the well's inner ${geo.wellInner}px`)
            }
          }

          // Vertical fit inside the phone shell: 390 both pages, and 320 Play
          // under a fine pointer. Under a coarse pointer the 320x568 Play page
          // cannot fit by arithmetic — the 44px floors on Settings, the switch,
          // the octave caps and the footer's five actions plus the 164px coarse
          // keybed exceed 568 with every gap at zero — so there it is reported
          // (the * mark) and not failed.
          const fits = geo.scrollHeight <= geo.clientHeight
          const mustFit = variant === 'embed' && (t.width === 390 || (pageName === 'play' && !coarse))
          if (mustFit && !fits) issues.push(`page needs vertical scrolling: ${geo.scrollHeight} > ${geo.clientHeight}`)

          const unnamed = await checkUnnamedControls(page)
          for (const u of unnamed) issues.push(`unnamed control: ${u}`)

          const fileName = `${variant === 'embed' ? 'embed-' : ''}${coarse ? 'touch-' : ''}${pageName}-${t.width}.png`
          await page.screenshot({ path: `${outDir}/${fileName}`, fullPage: true })
          await page.close()

          // The start-cap jump, on the Play page, on a fresh page.
          let jump = 'n/a'
          if (pageName === 'play') {
            const p2 = await open()
            const capBefore = await p2.locator('button.start').count()
            if (capBefore !== 1) issues.push(`expected the Start audio cap before the gesture, found ${capBefore}`)
            const idleTop = await keybedTop(p2)
            await p2.keyboard.press('z')
            try {
              await p2.waitForSelector('button.start', { state: 'detached', timeout: 3000 })
            } catch {
              issues.push('the Start audio cap did not leave after the key gesture')
            }
            await p2.waitForTimeout(150)
            const runningTop = await keybedTop(p2)
            jump = `${idleTop}/${runningTop}`
            if (idleTop !== runningTop) issues.push(`keybed top moved when audio started: ${idleTop} -> ${runningTop}`)
            await p2.close()
          }

          // Playback survives a Voice-and-back switch (checked with the Voice row).
          let playing = 'n/a'
          if (pageName === 'voice') {
            const p3 = await open()
            const pos = () => p3.locator('.position strong').first().textContent()
            await p3.click('button.play')
            await p3.waitForTimeout(500)
            const a = (await pos()).trim()
            await segment(p3, 'Voice').click()
            await p3.waitForTimeout(500)
            const pressedOnVoice = await p3.getAttribute('button.play', 'aria-pressed')
            const b = (await pos()).trim()
            await segment(p3, 'Play').click()
            await p3.waitForTimeout(500)
            const pressedOnPlay = await p3.getAttribute('button.play', 'aria-pressed')
            const c = (await pos()).trim()
            const ok = pressedOnVoice === 'true' && pressedOnPlay === 'true' && a !== b && b !== c
            playing = ok ? 'ok' : `pressed ${pressedOnVoice}/${pressedOnPlay}, position ${a} > ${b} > ${c}`
            if (!ok) issues.push(`playback did not survive the page switch: ${playing}`)
            await p3.close()
          }

          rows.push({
            width: t.width,
            variant,
            page: pageName,
            overflow: `${geo.scrollWidth}/${geo.innerWidth}`,
            height: `${geo.scrollHeight}/${geo.clientHeight}${fits ? '' : '*'}`,
            top,
            well: geo.canvas === null ? 'n/a' : `${geo.canvas}/${geo.wellInner}`,
            unnamed: unnamed.length,
            targets: audit === null ? '-' : audit.smallTargets.length,
            fonts: audit === null ? '-' : audit.smallFonts.length,
            jump,
            playing,
            file: fileName,
          })
          if (issues.length > 0) failures.push({ label: `${label} ${t.width} ${variant} ${pageName}`, issues })
        }
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  const header = [
    pad(label, 7),
    pad('width', 6),
    pad('variant', 10),
    pad('page', 6),
    pad('scrollW/innerW', 15),
    pad('docH/viewH', 12),
    pad('keybed', 7),
    pad('canvas/well', 12),
    pad('unnamed', 8),
    pad('<44', 4),
    pad('<16', 4),
    pad('idle/run', 9),
    pad('playing', 8),
    'file',
  ].join('| ')
  console.log('')
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const r of rows) {
    console.log(
      [
        pad(label, 7),
        pad(r.width, 6),
        pad(r.variant, 10),
        pad(r.page, 6),
        pad(r.overflow, 15),
        pad(r.height, 12),
        pad(r.top, 7),
        pad(r.well, 12),
        pad(r.unnamed, 8),
        pad(r.targets, 4),
        pad(r.fonts, 4),
        pad(r.jump, 9),
        pad(r.playing, 8),
        r.file,
      ].join('| '),
    )
  }
  console.log('(docH/viewH marked * means the page scrolls vertically)')
  if (failures.length === 0) {
    console.log(`\nPHONE ${label.toUpperCase()} PASS`)
    return 0
  }
  console.log(`\nPHONE ${label.toUpperCase()} FAIL`)
  for (const f of failures) {
    console.log(`  [${f.label}]`)
    for (const i of f.issues) console.log(`    - ${i}`)
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
  let code
  if (args.selftest) {
    code = await runSelftest(args.base)
  } else {
    const fine = args.touchOnly
      ? 0
      : (await runCaptures(args.base, args.out, !args.empty)) |
        (await runPhone(args.base, args.out, !args.empty, false))
    const touch =
      (await runPhone(args.base, args.out, !args.empty, true)) | (await runTouch(args.base, args.out, !args.empty))
    code = fine || touch
  }
  process.exit(code)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
