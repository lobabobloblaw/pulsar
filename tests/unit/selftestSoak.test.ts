/** The raw soak drives EIGHT lanes, and keeps driving them.
 *
 *  `/?selftest&soak=N` is the only gate that runs the whole write path for
 *  minutes at a time, and its claim in `docs/register-timeline.md` and
 *  `CLAUDE.md` is "all-channel". It was written when all-channel meant the 2A03,
 *  and nothing in `pnpm test` could notice when the VRC6 lanes were added to the
 *  product but not to the soak — the harness needs a browser, an AudioContext
 *  and a real clock, so it cannot run in this suite at all.
 *
 *  So this file reads it, the way `trackerUiWiring.test.ts` reads components and
 *  for the same reason: a source tripwire is the only test there is, and the
 *  alternative is none. What it pins is the shape a future edit must not lose —
 *  the ten VRC6 registers, their canonical order, `$9003` once, the two-register
 *  note-off, the stop sequence, and the tally that makes the soak FAIL rather
 *  than quietly shrink back to five lanes.
 *
 *  Anti-vacuity: `inOrder` is proved to reject a reversed sequence, and the
 *  section extractors are proved to have found the 2A03 writes they sit beside.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', '..', 'src')

/** Source with comments removed, so a tripwire can never be satisfied by prose. */
const CODE = readFileSync(join(SRC, 'selftest.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

function section(code: string, start: string, end: string): string {
  const from = code.indexOf(start)
  expect(from, `missing: ${start}`).toBeGreaterThanOrEqual(0)
  const to = code.indexOf(end, from + start.length)
  expect(to, `missing: ${end}`).toBeGreaterThan(from)
  return code.slice(from, to)
}

/** True when every needle appears, and appears in the order given. */
function inOrder(text: string, needles: readonly string[]): boolean {
  let at = -1
  for (const n of needles) {
    const found = text.indexOf(n, at + 1)
    if (found <= at) return false
    at = found
  }
  return true
}

const SOAK = section(CODE, 'async function runSoakTest(minutes: number)', '\n}\n')
const LOOP = section(SOAK, 'while (performance.now() < endAt) {', 'const stopAt =')
const STOP = section(SOAK, 'const stopAt =', 'await sleep(200)')
const REPORT = section(SOAK, 'const countersOk =', 'SELFTEST PASS')

describe('the extractors found the soak, not an empty string', () => {
  it('reads a loop that still drives the 2A03 lanes', () => {
    expect(LOOP.length).toBeGreaterThan(400)
    for (const addr of ['0x4015', '0x4000', '0x4004', '0x4008', '0x400c', '0x4011']) {
      expect(LOOP, `2A03 ${addr} missing from the soak loop`).toContain(addr)
    }
  })

  it('has an ordering check that can fail', () => {
    expect(inOrder('a b c', ['a', 'b', 'c'])).toBe(true)
    expect(inOrder('a b c', ['c', 'b', 'a'])).toBe(false)
    expect(inOrder('a b', ['a', 'z'])).toBe(false)
  })
})

describe('the soak drives the three VRC6 lanes', () => {
  it('writes all ten expansion registers', () => {
    // The brief's floor: $9000/$A000/$B000 must be reachable from the soak, so a
    // future edit cannot silently drop a whole lane.
    const all = LOOP + STOP
    for (const addr of [
      '0x9000',
      '0x9001',
      '0x9002',
      '0x9003',
      '0xa000',
      '0xa001',
      '0xa002',
      '0xb000',
      '0xb001',
      '0xb002',
    ]) {
      expect(all, `VRC6 ${addr} is never written`).toContain(addr)
    }
  })

  it('emits each lane in the canonical order, side-effect register LAST', () => {
    // $x002 clears/sets the enable bit, which resets the lane's step, its
    // accumulator and its timer. Writing it before the period is a phase reset
    // applied to the OLD period (docs/register-timeline.md, "VRC6 lanes").
    expect(inOrder(LOOP, ['0x9000', '0x9001', '0x9002']), 'vrc6 pulse 1').toBe(true)
    expect(inOrder(LOOP, ['0xa000', '0xa001', '0xa002']), 'vrc6 pulse 2').toBe(true)
    expect(inOrder(LOOP, ['0xb000', '0xb001', '0xb002']), 'vrc6 saw').toBe(true)
  })

  it('writes $9003 once, at the start, before any lane register', () => {
    // "No halt, no period shift", written on the first step and never again —
    // per-step it would be nine extra writes a second saying nothing.
    const nines = [...LOOP.matchAll(/0x9003/g)]
    expect(nines).toHaveLength(1)
    expect(LOOP).toMatch(/if \(step === 0\) vrc6\(c, 0x9003, 0x00\)/)
    expect(LOOP.indexOf('0x9003')).toBeLessThan(LOOP.indexOf('0x9000'))
  })

  it('spells a note-off as volume 0 AND the enable bit cleared', () => {
    // Either half alone is wrong: volume 0 leaves the divider running, and
    // clearing the enable bit alone leaves a volume the next trigger inherits.
    const off = section(LOOP, 'const held = step % 2 === 0', '0xb000')
    expect(off).toMatch(/0xa000,\s*\(SOAK_VRC6_DUTY_2 << 4\) \| \(held \? SOAK_VRC6_VOL_2 : 0\)/)
    expect(off).toMatch(/0xa002,\s*\(held \? 0x80 : 0x00\)/)
  })

  it('stops the chip with the driver’s own stop() sequence, and never $4015', () => {
    expect(inOrder(STOP, ['0x4015', '0x9000', '0x9002', '0xa000', '0xa002', '0xb000', '0xb002'])).toBe(
      true,
    )
    // $4015 belongs to five lanes that have nothing to do with this chip; a
    // VRC6 note-off that touched it would cut a 2A03 voice.
    expect([...STOP.matchAll(/0x4015/g)]).toHaveLength(1)
    expect(STOP).not.toMatch(/vrc6\([^)]*0x4015/)
  })
})

describe('the soak fails when the expansion lanes are not driven', () => {
  it('tallies every VRC6 write through one counting path', () => {
    expect(SOAK).toMatch(/let vrc6Writes = 0/)
    expect(SOAK).toMatch(/const vrc6 = \(cycle: number, addr: number, value: number\): void => \{/)
    // Nothing may bypass the tally: every expansion address in the soak goes
    // through `vrc6(`, never `engine.write(` directly.
    const calls = [...(LOOP + STOP).matchAll(/(\w+)\((?:c|stopAt), (0x[9ab]0{2}[0-3])/g)]
    // 10 in the loop (nine per step plus $9003), 6 in the stop sequence — and a
    // count, so a regex that matched nothing could not pass this vacuously.
    expect(calls).toHaveLength(16)
    for (const m of calls) expect(m[1], `${m[2]} bypasses the tally`).toBe('vrc6')
  })

  it('gates PASS on the tally matching the shape the loop emits', () => {
    expect(REPORT).toMatch(/const vrc6Expected = 1 \+ step \* vrc6PerStep \+ 6/)
    expect(REPORT).toMatch(/const vrc6Ok = step > 0 && vrc6Writes === vrc6Expected/)
    expect(REPORT).toMatch(/pass = pass && vrc6Ok/)
    expect(SOAK).toMatch(/const vrc6PerStep = 9/)
  })

  it('keeps the gates that were already there', () => {
    // The new gate is added to the contract, not substituted for it.
    expect(REPORT).toMatch(/pass = pass && countersOk/)
    expect(REPORT).toContain('peakGate=')
    expect(REPORT).toMatch(/pass = pass && peakOk/)
    expect(SOAK).toContain('lateWrites')
    expect(SOAK).toContain("lines.push(pass ? 'SELFTEST PASS' : 'SELFTEST FAIL')")
  })
})
