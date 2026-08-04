# preset suite — critic scorecard

**Scored against** `docs/preset-suite.md` §6 as amended by §9.5: eleven axes, 1–5, total out of 55.
Any axis ≤ 2 → mandatory revision · total < 42 → mandatory revision · 42–47 → director's discretion ·
≥ 48 with no axis < 3 → pass to audition.

**Gates (reported separately, never part of the score).** `vitest run tests/unit/presets.test.ts
tests/unit/presetFormat.test.ts` → **130 passed, 0 failed**. All twelve songs are gate-green and
therefore scorable. Bank-drift is zero across all twelve files; every canonical instrument resolves
to byte-identical macro values against `tests/fixtures/songs/shared-bank.json`.

**Method.** Every axis-7 and axis-11 `frame:row` claim in `extra.qa` was opened against the pattern
data and either confirmed attack-for-attack or marked absent. Axis-4 pulse-1/pulse-2 attack
coincidence and contrary/oblique motion were computed per frame and per section. Axis-2/3/5 were
traced through the actual note columns (motif statements compared row-for-row, named non-diatonic
devices located at their citations, stepwise percentages measured on the lead lane). Axes 1/6/8/10
come from the document plus measured counts. **Not auditioned** — no render was made, so axis 9 is
scored structurally (the five §2.9 rules read off the seam rows) rather than by ear.

**Context rulings applied** (from the director): batch A's frame-boundary phase resets cap axis 11 at
4 where the rotation is real inside frames and the section-span claim holds; the four demos (09–12)
are §5 QA fixtures whose specs override §9's floors, so their verdict is *fixture — discretion: keep*
unless something is broken.

---

## 01 · iron sunrise — **49 / 55 — pass to audition**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **5** | `form` matches §4.1's frame map exactly (0–1 I, 2–5 A, 6–7 A′, 8–11 B, 12 break, 13–16 A″); the one asymmetry is the 6-bar chromatic descent at `8:0 → 9:16` plus a 2-bar link, and `D00` at `12:47` cuts the break to 3 bars. |
| 2 | motif development | **4** | p1:2 recurs at frames 2/4/13; octave transposition at `6:0` (p1:5); re-orchestration onto pulse 2 at `6:0` (p2:4, same rows, same pitches); hemiola regrouping at `16:32 → 16:59`. But the claimed "motif restated one row late in p1:3 / two rows late in p1:4" is **not a restatement** — p1:3 (`3:1`) and p1:4 (`5:2`) are different answering phrases on a shifted grid. Three recurrences, two real variations. |
| 3 | cadences + harmony | **5** | Chromatic bass descent d–c♯–c–b–b♭–a, one link per bar, verified `8:0 → 9:16`; F → A chromatic mediant at `11:32 → 11:48` into the break's A pedal; chained secondaries E7 → A7 → Dm at `16:32 / 16:48 / loop` — a real 3-link descending-fifths chain; borrowed b♭ throughout. Four distinct devices in three sections. |
| 4 | counterpoint | **3** | Section A (frames 2–5) is 70 % non-coincident (39 of pulse 2's 56 attacks land where the lead has none) and 57 % contrary/oblique on shared rows — both §9.2 floors clear, and pulse 2 has its own half-note contour. But frames 15 and 16 put it in octave lockstep with pulse 1 (`15:0` 5 % non-coincident, 19 of 20 shared moves similar; `16:0 → 16:59` exact octaves, 0 % non-coincident) — **8 consecutive parallel bars** against §9.2's ≤ 4-bar cap. Suspensions: the 4–3 at `p2:2 32 → 40` (c4 over G, prepared at row 30, resolving to b3) is genuine; the claimed 7–6 at `p2:5 24 → 32` is **broken by a `---` cut at 8:28**, so the dissonance never sounds over the new chord. One written dissonance, not two. |
| 5 | melodic contour | **4** | 83 % stepwise (223/269), phrases end with `---` at rows 28/30/60, one peak per section. But the global peak d6 first lands at `6:40` — 35 % through — and is only **equalled**, never exceeded, at `15:40`; §2.10 wants it in the last third. |
| 6 | dynamics | **4** | 1096 note events, 6.2 % at vol 15, 12 distinct column values (6 pulse 1 / 7 pulse 2 / 12 noise), 7 bars with two or more lanes resting. Docked one for an **undeclared §9.8 breach**: 41 of 68 bars exceed the 28-attacks-per-bar ceiling, peaking at 38 at `6:0` (16 triangle 16ths + ~12 kit + both pulses). |
| 7 | briefed techniques | **5** | (1) driving 16th triangle bass — 64 attacks per frame with octave alternation and a chromatic approach (c♯2 at `2:15` into the C bar) on `bass-short`; (2) `Qxy`/`Rxy` articulation — Q117 at `1:61`, Q50 at `2:1 / 4:1 / 6:1 / 13:1 / 15:1`, R51 at `2:57 / 4:57 / 5:54 / 6:57 / 13:57 / 14:54 / 15:57`, **every one cancelled with `2xx` param 0** before the next note that must speak; (3) `Gxx` flams — G3 at `2:27`, G2 at `3:43`. All three present and prominent. |
| 8 | groove consistency | **5** | 150/6 → exactly 150 BPM, inside the declared [148,152]; integer ticks/row, no swing claimed; `Gxx` is 2–3 ticks and lives only on the noise lane's off-beat rows, never a section downbeat. |
| 9 | loop seam | **5** | `B2` at `16:63` = `loopFrame 2`; frame 2 row 0 carries explicit `inst`+`vol` on all four lanes; the last `Rxy` is cancelled at `15:60`, the last `0xy` at `12:46`, the last `Axy` at `12:46` — nothing runs across; pulses cut at `16:62`; the turnaround is A7 → Dm. |
| 10 | bank + hygiene | **5** | Zero bank drift, no `x-` instruments needed, no pulse note below MIDI 55, noise notes 36–46, every pitch-macro loop segment sums to 0, all params decimal and the non-obvious ones documented. |
| 11 | metric interest | **4** | The 3-row register cell is real: tri:2 puts the octave-up on every `r%3==2` row (`2:2, 2:5 … 2:62`), tri:3 on every `r%3==0` row (`3:0, 3:3 … 3:60`), so the accent rotates 3-against-4 inside every frame and realigns with the bar only every 3 bars — running frames 2–7 with a phase displacement between the two patterns. Plus tresillo bass in B (`8:0/6/12` per bar through frames 8–11), tresillo kick in A′ (frames 6–7), hemiola on both pulses at `16:32 → 16:59`, and one metric surprise (`D00` at `12:47`, kit out `12:25–31`). What it does not do is carry phase **across** the frame boundary (64 mod 3 = 1 needs entry rows 0, 2, 1); the phase resets each frame. Capped at 4 per ruling. |

**Verdict: pass to audition.** Two things for the revision round if the director wants them: the
climax's 8 bars of octave doubling (frames 15–16), and the global peak arriving at 35 %.

---

## 02 · glass ladder — **49 / 55 — pass to audition**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **4** | Matches §4.2 exactly (0–1 I, 2–5 A, 6–7 A′, 8–11 B, 12–15 A″). Docked one because §2.9's required "one 6-bar or 2-bar asymmetry at a section boundary" is absent — the half-time passage at `11:48 → 11:63` is a texture event, not a phrase-length asymmetry. |
| 2 | motif development | **5** | Statement at `2:0`; **+2-row displacement** at `4:2` (verified row-for-row); **rhythmic diminution** at `6:0` — p1:5 halves every value so the 4-bar phrase fits in 2 and is then stated twice; **re-harmonisation** under the b♭VI F chromatic mediant at `7:16` and `14:16`. Four recurrences, three genuine transformations. |
| 3 | cadences + harmony | **5** | A climbs I–ii–iii–IV / V–vi–IV–V (an 8-bar non-looping unit, each phrase entering a step higher — the brief's "climbing" delivered literally); C♯7 (V/vi) → F♯m at `8:0 → 9:0`; G♯7 → C♯7 → F♯m across frames 10–11, a 3-link chain; F major, the b♭VI chromatic mediant, at `7:16` and `14:16`. Harmonic rhythm differs per section. Two distinct devices in different sections. |
| 4 | counterpoint | **3** | Independence is genuinely sustained — A is 50–67 % non-coincident with the bed on its own tresillo rhythm, B swaps the roles entirely (pulse 2 holds the melody while pulse 1 runs the ostinato, 54 of pulse 1's 64 attacks free, 56–60 % contrary/oblique), A″ frame 14 is 74 % non-coincident at 67 % good motion. But **all three cited written dissonances fail on inspection**: `8:48`'s e♯4 is the *third* of C♯7 — a chord tone — moving up to f♯4 at `8:56`; `9:48`'s e♯5 likewise; `7:16`'s f4 is the *root* of the F chord and its step down to e4 at `7:32` coincides with the chord change. Good chromatic voice-leading, zero written dissonance, so §9.2's ≥ 2 quota is unmet. |
| 5 | melodic contour | **4** | 82 % stepwise across the melodic frames, max leap 6 semitones. (The 45 % global figure is the B ostinato — written-out arpeggiation, which is the piece's stated argument and §2.4's sanctioned "ostinato" use; excluding it is the musically correct measurement.) Phrases breathe every 4 bars. Docked one: global peak b5 first at `7:2`, 44 % through, re-touched at `15:40`. |
| 6 | dynamics | **4** | 1018 events, 2.4 % at vol 15, 13 distinct values (6/8/12 per lane), 4 bars with two lanes resting. Docked one for the same undeclared §9.8 breach: 18 of 64 bars over 28 attacks, peaking at 33 at `14:32`. |
| 7 | briefed techniques | **5** | (1) `0xy` as the harmonic bed for the whole piece — params 71/55/74 on pulse 2, changed on each chord downbeat, cancelled with `000`; (2) the arp-effect vs arp-written-out contrast — A's `0xy` bed against B's 64-written-16ths ostinato, which is the piece's whole argument and it lands; (3) `Sxx` chokes carving rests into the bed — S4/S5 at `2:5, 2:11, 2:15` and on every subsequent strike. All three prominent and used as §2 describes. |
| 8 | groove consistency | **5** | 150/7 → 128.571 BPM, inside [127,130]; tempo 150 = 2.5·engineSpeed so ticks/row is exactly 7, straight as briefed; no `Gxx` at all. |
| 9 | loop seam | **5** | `B2` at `15:63`; frame 2 row 0 explicit on all four lanes; `000` cancels before the seam; pulse 2's g♯4 at `15:62` is restruck at `2:0`. The `Vxx`-inertness trap is documented and handled — the loop target reinstates `lead-bright`, whose duty macro overrides any stale `Vxx`. |
| 10 | bank + hygiene | **5** | Zero drift; one piece-specific instrument, correctly named `x-glass-ladder-glass`, and it exists for a real engine reason (no duty macro, so `Vxx` can speak); no pulse note below 56; noise 39–46. |
| 11 | metric interest | **4** | The 5-row broken-chord ostinato is verified across frames 8–11: 64 attacks per frame with the cell head accented v13 against v10 at rows `0, 5, 10 … 60`, so against a 16-row bar it never lines up after row 0 — exactly as claimed. Plus the A bed's tresillo (strikes at `2:0/6/12` with chokes at 5/11/15), a 3-row triangle walking cell through A′ (`6:0 … 6:63`, every 3 rows, 22 attacks), and a 6-row hat accent cycle in A′ (v9 at `6:0/6/12/18/[30]/36 …` — one accent dropped at row 24). Four devices, all verified. No device carries phase across a frame boundary (the 5-cell restarts at row 0 in each of frames 8–11 rather than entering at 0/1/2/3), and the "metric event" is a half-time texture change rather than one of §9.4's four forms. Capped at 4. |

**Verdict: pass to audition.** Lowest axes: 4 (counterpoint — no actual written dissonance) and 1/5/6.

---

## 03 · midnight ferry — **50 / 55 — pass to audition**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **5** | 18 frames, `form` matches §4.3 exactly including the single `pickup` frame at 14 and A′ extending to frame 9. |
| 2 | motif development | **4** | p1:2 at frames 2/4/15; **+1-row displacement** in p1:4/p1:5 (verified: every row exactly +1); recast as a canon subject in B; re-harmonised over A7–D7 with the global peak in A″ (`17:24`). But the A′ "variation" is the *same pitches* one row later — a metric device, not development — and the canon subject is new material rather than a transformation. Two real variations (the A″ reharmonisation, the octave-down echo re-orchestration). |
| 3 | cadences + harmony | **5** | A = i–b♭VI–b♭III–V alternating with i–iv–b♭VI–V, D7 (f♯) as the secondary dominant; A′ chromatic bass descent g–f♯–f–e♭ at frames 7/9 (verified from the bar roots); B adds D♭ major, the b♭III chromatic mediant of B♭, at `11:16`; chains A7 → D7 → Gm at `12:32 → 12:48`; closes on the E♭ → D half cadence in frame 13. Three distinct devices in three sections, every one located. |
| 4 | counterpoint | **3** | Two genuine written dissonances, both verified: the **cadential 4–3 at `8:44 → 8:52`** (g4 as the sixth of B♭, held across the barline into the D7 bar where it is the fourth, resolving down to f♯4 — textbook), and the **appoggiatura at `8:28 → 8:30`** (f4 over E♭ → e♭4). Frames 8–9 give pulse 2 a fully independent countermelody: 0 shared attacks with the lead across both frames. But that is 2 frames of 18; echo covers 2–7 and 15–17, canon covers 10–13 — 13 of 18 frames (72 %), just over §9.2's two-thirds allowance for this named exception — and in B the follower shares 14 of 15 attacks (7 % non-coincident), failing §9.2's 40 % floor. Echo/canon is the default posture, which is §9.5's "3" verbatim. |
| 5 | melodic contour | **4** | 69 % stepwise globally — but 85 % in all the A/A′/A″ material and 29–57 % only in B, where the canon subject is deliberately built from consonant leaps so leader and follower consonate at the 4-row offset. **Judging the musical claim, not the number:** a stepwise subject would produce seconds against itself at that delay, so this is the right craft decision and the composer documents it. Global peak a5 at `17:24`, 94 % through — the best-placed peak of the batch. |
| 6 | dynamics | **5** | 893 events, 3.0 % at vol 15, 11 distinct values (6/5/10 per lane), 9 bars with two or more lanes resting, ghost snares at v5–7 between the backbeats. Max 24 attacks/bar — comfortably inside §9.8 everywhere, the only batch-A piece that is. |
| 7 | briefed techniques | **5** | (1) The echo trick, textbook: pulse 2 is pulse 1 **exactly +3 rows** at `2:3, 2:9, 2:11, 2:15 …` on `echo-thin`, v9 against v13 (69 %, inside §2.2's 55–70 %), `P126` = P7e detune, same octave, moved an octave down onto `echo-round` in A′ and *stopped* at frames 8–9 where pulse 2 has real material. (2) A true canon at 4 rows: pulse 2's attack set is pulse 1's +4 exactly at frames 11/12/13, near-equal volume on `lead-round`. (3) `Gxx` humanisation: `G01` on every beat-1 and and-of-2 triangle note through A and A′ (`2:0, 2:6, 2:16, 2:22 …`), dead-on in B. All three are the piece's identity. |
| 8 | groove consistency | **5** | 140/6, `evenTempo: false` → 140 BPM inside [139,141]. The composer corrects the doc: this engine's Bresenham produces a **seven**-row cycle (7 6 7 6 7 6 6 = 45 ticks / 7 rows) rather than §2.7's illustrative eight-entry list, and notes that because 7 does not divide 16 the lilt itself drifts against the bar. That is an engine-measured correction, stated plainly, and it is correct — accepted. |
| 9 | loop seam | **5** | `B2` at `17:63`; frame 2 row 0 explicit on pulse 1/triangle/noise, pulse 2 legitimately silent (it is an echo lane entering at row 3, with `P126` restated there); `4xy` cancelled with 400, `Axy` with A00; the last bar is A7 → D7 into Gm. The `D52` at `13:63` entering frame 14 at row 52 gives a 12-row (3-beat) pickup — that is §2.9's stated use of `Dxx`, **not** a deviation; frame 14's rows 0–51 are unplayed data, harmless, and the frame is still reached so the no-dead-frames check holds. |
| 10 | bank + hygiene | **5** | Zero drift, no `x-` instruments, no pulse note below 67, noise 36–46, macros canonical. |
| 11 | metric interest | **4** | The 3-row hat cell is real **and it moves**: every hat in A lands on `r%3==0` (`2:3, 2:9, 2:18, 2:21 …`), every hat in A′ lands on `r%3==1` (`6:1, 6:7, 6:13, 6:19 …`) — a genuine one-row phase displacement of a polymetric cell between sections, verified by isolating note 45. B replaces it with a 6-row triangle ostinato at `10:0 → 13:60` (rows 0, 6, 12 … 60 in all four B frames), realigning with the 16-row bar only every 3 bars. Plus a dropped beat (kit out `13:25–31`) and the `D52` pickup. Cells reset phase at frame boundaries within each section; the displacement is between sections rather than a carry. Capped at 4. |

**Verdict: pass to audition.** Axis 4 is the ceiling here by design — §9.2 grants this piece the
echo/canon exception, and it uses all of it and one frame more.

---

## 04 · paper lanterns — **54 / 55 — pass to audition** *(album best)*

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **5** | Exact match to §4.4's arch (0–1 I, 2–5 A, 6–9 B, 10–12 C, 13–14 B′, 15–17 A′), 48-row frames, `rowHighlight2: 12` so a 12-row bar is three beats, `percussionGap 24` declared for the drumless centre. The asymmetry is `D00` at `12:43`, which makes C's last bar 2 beats instead of 3. |
| 2 | motif development | **4** | Statement `2:0` (d5–f5–g5 · g5–f5–e♭5–d5); **+2-row displacement** at `4:2` verified row-for-row; portamento-connected legato restatement at `15:0`; **transposed and rhythmically regrouped** into 8-row hemiola units at `17:0/8/16`; −2 anticipation with the head written into `13:46`. Docked one because `15:0` is a literal pitch restatement (the variation is articulative) and the motif is never inverted, augmented or moved to another channel — one menu-level transformation, not two. |
| 3 | cadences + harmony | **5** | Three distinct devices in three sections, all located: **chromatic bass descent** B♭–A–A♭–G–G♭–F, one link per bar, `10:0 → 11:18` (6 links, harmony implied by the collision with held pulses); **chained secondary dominants as a descending-fifths sequence** A7–Dm–G7–Cm–F, `16:0 → 17:0`, with the raised thirds voiced in pulse 2 (c♯4 = 61 at `16:4`, b3 = 59 at `16:28`) and a chromatic lower neighbour c♯5 at `16:10` resolving up to d5 at `16:12`; **borrowed iv (E♭ minor)** at `9:24` with its g♭ in the lead (66), the ostinato (66 at `9:31`) and the bass (42 at `9:32`). Harmonic rhythm changes section to section. Plagal E♭ → B♭ at the final cadence, V–I at the seam. One citation imprecision: the fifths chain's stated endpoint `17:12` is wrong — B♭ actually lands at `17:36`. |
| 4 | counterpoint | **5** | **Two genuine prepared suspensions and a genuine appoggiatura, all verified.** `5:32`: e♭4 attacked as the root of the E♭ bar, held across the change to B♭ at row 36, resolving down by step to d4 at `5:38`. `17:30 → 17:38`: the same figure at the plagal cadence. `13:0`: e♭6 on the downbeat over B♭ — the fourth — resolving down to d6 at `13:2`, and it is the piece's global peak. Pulse 2 runs its own 5-row ostinato with its own rhythm *and its own contour* (a♯3–d4–g4–a♯3–d4–e♭4–g4 …, moving with the harmony) through the whole of B (90/80/78/90 % non-coincident) and B′; in A its stab line is a moving inner voice (d4–f4–a♯3–d4–e♭4–g4–f4–c4), never a doubling. Independence sustained across two complete sections. |
| 5 | melodic contour | **5** | 84 % stepwise, max leap 15 (the octave-up B′ entry), range inside a tenth per section, every phrase ended with `===` so release tails overlap. Global peak e♭6 at `13:0` — 72 % through, in the last third — and it *is* the appoggiatura, so the piece's highest note and its sharpest dissonance are the same event. |
| 6 | dynamics | **5** | 445 events, 4.3 % at vol 15, 12 distinct values (7/4/9 per lane), **12 bars with two or more lanes resting** (all of C is two voices and no kit). Max 13 attacks per bar — never near §9.8's ceiling. `rmsRange` is a snug ±1.8 dB around a stated −22.79 dBFS measurement. |
| 7 | briefed techniques | **5** | (1) 3/4 via row geometry — 12-row bars, triangle root on beat 1, pulse-2 `stab` on beats 2 and 3, which is the whole waltz idiom on this hardware; (2) delayed `4xy` + `3xx` portamento — vibrato written effect-side (note on row *n*, `4` param 66 on row *n*+2 at `16:12/16:14`, `16:24`, `17:24`), cancelled with `4` param 0 on the next attack, and the portamento in A′ cancelled with `2` param 0 at `15:0, 15:24, 17:0, 17:24, 17:44` because `300` only freezes this driver's persistent mode; (3) arpeggiated triangle bass in B and the 6-row cell through C. All three prominent. Minor undeclared deviation: the brief's kit implies a kick somewhere and the piece has none. |
| 8 | groove consistency | **5** | 150/8 → 112.5 BPM inside [111,114]; integer ticks/row; `G02` as the waltz's third-beat lilt and `G03` as a tom flam, never on a section downbeat. |
| 9 | loop seam | **5** | `B2` at `17:47` = `loopFrame 2`; frame 2 row 0 explicit on pulse 1 and triangle, the other three legitimately silent; `4` param 0, `2` param 0 and `A` param 0 are **all** stated together at `17:44` before the seam; the last bar is E♭ → B♭ → F into B♭, a real turnaround. |
| 10 | bank + hygiene | **5** | Zero drift, no `x-` instruments, no pulse note below 60, noise 37–46, all pitch macros end on 0, dpcm lane declared unused and empty. |
| 11 | metric interest | **5** | The best in the suite. A **genuine phase-carried 5-row ostinato** across the whole B section — entry rows **0 / 2 / 4 / 1** at frames 6/7/8/9, which is exactly §9.1's 48-row table (0, 2, 4, 1, 3) *computed, not guessed* — cited `6:0 → 9:46` and returning at `13:0` (entry 0) and `14:2` (entry 2). A 6-row 2:3 cell on the triangle through all of C, `10:0 → 12:42`, two bass attacks per three-beat bar. Hemiola at `5:24/32/40` (kit accents at v12 on exactly those rows, triangle holding) and again at `17:0/8/16` (both pulses and the kit). Metric surprise: `D00` at `12:43`. Displacement both +2 (`4:2`) and −2 (head at `13:46`). **Every citation checked out.** |

**Verdict: pass to audition.** The only correctable item in the whole file is the descending-fifths
endpoint citation (`17:12` should read `17:36`).

---

## 05 · tide pool — **52 / 55 — pass to audition**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **5** | Exact match to §4.5's arch (0 intro, 1–3 A, 4–6 B, 7–8 peak, 9–10 A′), 11 frames, `loopFrame 1`, `percussionGap 32` declared with its justification. |
| 2 | motif development | **5** | Five statements with three real transformations: p1:1 at `1:0` (c5–d5–e5 · a5 · g5); **+2-row displacement** at `2:2`; **transposed up a step as a sequence** at `3:0` (d5–e5–f5 · b5 · a5); **inverted and a fourth higher** at `4:0` over the borrowed E♭ (f5–e♭5–d5 · a4 · c5); final thinned statement at `9:0` over the chromatic bass. Transposition *and* inversion — the only piece that does both. |
| 3 | cadences + harmony | **4** | Three devices in three sections, all located: borrowed b♭VII (E♭ major) at `4:0` and `5:0`, its e♭ in the lead at `4:8`, flatly contradicting lydian's raised fourth; chromatic bass descent f1–e1–e♭1–d1, one link per bar, `9:0 → 9:48`, in the triangle's lowest octave; the A-major chromatic mediant in the peak. Cadences are functional (B closes C → F at `6:48 → 7:0`, A′ closes C → F across the seam). Docked one for two things: the chromatic-mediant **citation is off** — the A-major triad is frame 8 bars 1–2 with the bass at `8:0`; by `8:32` the bass has already moved to C and the c♯5 is a *retained* dissonance resolving to c5 at `8:48`, which is a different (still good) event — and §9.3's positive requirement of a descending-fifths or descending-thirds chain of ≥ 3 links is not met anywhere (the chromatic descent is stepwise). |
| 4 | counterpoint | **4** | Pulse 2 has its own metre for the whole A section via the 6-row cell (82/82/90 % non-coincident) and at `6:4 → 6:60` every one of its eight attacks falls on a row pulse 1 does not touch (100 %) — independence sustained across two complete sections. **Two real written dissonances:** `4:24` (g4 as the third of E♭, held across the change to F at row 32, resolving down by step to f4 at `4:36`) and the cadential appoggiatura at `10:32` (f5 over C, the fourth, on the strong beat, resolving down to e5 at `10:36`). Docked one for `5:0`, where pulse 2 doubles the lead in unison for a whole frame (0 % non-coincident, all similar motion) — declared and deliberate (the `P130` detune is meant to beat against it), but it is a frame of no independence at all. |
| 5 | melodic contour | **4** | 73 % stepwise, max leap 12, every phrase ended with `===` so releases overlap the next entry, one peak per section. Docked one: the global peak d6 is attacked at `7:0` — 63.6 % through — and although it is *held* through `8:15` (74 %), it straddles the last-third boundary rather than sitting inside it. |
| 6 | dynamics | **5** | 224 events across 117 s, 4.9 % at vol 15, 11 distinct values (5/5/5 per lane), 9 bars with two or more lanes resting, max 10 attacks per bar. Deliberately and correctly quiet; `rmsRange` snug around a stated −22.82 dBFS. |
| 7 | briefed techniques | **5** | All three verified at their citations. (1) Long macro envelopes with real release points — `pad` (`vol-pad`, release 11) and `lead-thin` (`vol-lead`, release 5), every phrase ending with `===` at `1:28, 1:44, 1:60` and onward. (2) `Axy` swells + `Pxx` static detune — `A04` on both pulses at `0:0` cancelled at `0:32`, again on the peak note at `7:0` cancelled at `7:24`; `P130` (0x82, two raw units sharp) on pulse 2 at `0:0` **and re-stated at the loop target `1:0`** so the seam state never depends on the intro. (3) The one destabilisation — `4` param 247 (`4f7`) at `8:0` on the held global peak, cancelled with `4` param 0 at `8:12`, earned by five frames of stillness. |
| 8 | groove consistency | **5** | 150/10 → 90 BPM inside [89,91]; integer ticks/row; no `Gxx`. The brief's "no drum kit" is honoured literally: the noise lane uses only notes 46 and 45 (index 1 and 2) as wash and drips. |
| 9 | loop seam | **5** | `B1` at `10:63` = `loopFrame 1`; frame 1 row 0 explicit on all four sounding lanes; `4` param 0 at `1:0`, `P130` restated at `1:0`, `7` param 0 at `8:48`, `A` param 0 at `10:52` — nothing runs across; the triangle sustains through the seam so the render gate's 1.2 s −60 dBFS window cannot fire on a piece with no kit to carry it. |
| 10 | bank + hygiene | **5** | Zero drift, no `x-` instruments, no pulse note below 67, noise notes 45/46 only, all pitch macros end on 0, dpcm declared unused and empty. |
| 11 | metric interest | **5** | **Two genuine phase carries, both computed from §9.1's table.** The noise weather's 5-row cell enters at rows **0 / 1 / 2 / 3 / 4** across frames 4/5/6/7/8 — a complete five-frame re-alignment cycle, cited `4:0 → 8:59`, and it stops exactly where A′ begins. Pulse 2's 6-row dotted-quarter cell enters at rows **0 / 2 / 4** across frames 1/2/3, cited `1:0 → 3:58`. Plus a 16th-level tresillo in A′ (`9:0/3/6` + `9:8/11/14`, again at `9:32` and `10:0`) and one metric surprise (`D00` at `8:59`, so the render is 700 rows rather than 704). Every claim verified exactly. |

**Verdict: pass to audition.** Lowest axes: 3 (no fifths/thirds sequence; one mis-cited device) and
4/5.

---

## 06 · switch cutter — **49 / 55 — pass to audition**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **5** | Exact match to §4.6 (0–1 intro, 2–5 A, 6–7 A′, 8–11 B, 12–13 break, 14–17 A″), 18 frames, `loopFrame 2`. |
| 2 | motif development | **4** | Six statements: `lead-thin` at `1:0`; `Vxx`-repainted with `Sxx` chokes at `2:0`/`3:0` (frames 3 and 5 are the *same notes* with a different `V` sequence, so timbre is the only difference — §2.3 allows this for one of the two variation quotas); **+2 displacement** at `6:2`; chopped to fragments in the break at `12:0`; all three duties cycling at `14:0`; **+4 displacement** at `15:4`. Docked one because the pitch material barely changes across the A sections — development is almost entirely timbral and metric, which the brief asks for but which caps axis 2. |
| 3 | cadences + harmony | **3** | The **augmented sixth at `11:0` is the album's most ambitious chord and it is really there**: triangle a♭2 (♭6), pulse 2 c4 (the tonic), pulse 1 f♯5 (♯4) — an Italian 6th in C minor — resolving outward to G at `11:32` as the bass falls a♭ → g and the lead rises to g5 (though pulse 1 passes through f natural at `11:24` en route, softening the outward pull). Chromatic bass descent c–b♮–b♭–a♭, one link per half-bar, `12:0 → 12:48` over a held c pedal. Chained secondary dominants D7 → G7 → Cm at `17:0 / 17:16 / 17:32`, a 3-link descending-fifths chain. Blue ♭5 (f♯4 = 66) at `2:13` resolving up to g4 at `2:14`, a weak-position wink exactly as briefed. **Docked two** for §9.3's no-stock-loop rule: the A backbone is Cm ‖ Cm ‖ Fm ‖ G7 repeated across frames 2–7 — **24 consecutive bars** — and 12 more at A″, against a mechanical bound of 8. |
| 4 | counterpoint | **3** | Independence is real and sustained: pulse 2's eight A-section attacks land **entirely** on rows the riff leaves empty (`2:8, 2:12, 2:20, 2:24, 2:36, 2:40, 2:52, 2:56` — 0 shared, exactly as claimed), B is 73–80 % non-coincident with 100 % contrary/oblique on shared rows, and the A″ voice crossing at `14:4 → 14:24` is genuine and good (pulse 2 descends c5–b4–a♯4–g♯4–g4 *above* the rising riff). But **one of the two cited written dissonances does not exist**: "8:56 holds e♭5 across the change and resolves down to d5 at `9:16`" — at `8:56` pulse 1 plays d♯5 over a c3 bass, the bass moves to a♭2 at `9:0` where d♯5 is **restruck as a chord tone** of A♭, and pulse 1's next notes are g5 (`9:8`) and f5 (`9:16`). There is no d5 anywhere in frame 9. That leaves the augmented sixth's ♯4→5 as the only written dissonance; §9.2's ≥ 2 quota is unmet. |
| 5 | melodic contour | **5** | 82 % stepwise, max leap 12, the riff's off-beat placement deliberate and legible (77 % of its attacks are off the 4-row beat). Global peak b♭5 at `17:58` — 94 % through — reached by a rising broken-chord close e♭4–g4–b♭4–e♭5–b♭5 across `17:34 → 17:58` with both pulses in unison, and it lands on the hemiola's eighth accent, closing exactly on the barline. The best-engineered peak in the suite. |
| 6 | dynamics | **4** | 967 events, 2.5 % at vol 15, 12 distinct values (6/5/11 per lane), max 24 attacks per bar so §9.8's ceiling holds. Docked one: only **2 bars in the entire piece** have two or more lanes resting — the §2.8 minimum, and §2.8 calls one-voice moments "the album's dynamic range". A relentless piece with almost no air. |
| 7 | briefed techniques | **5** | (1) Duty automation as the hook, and the engine fact behind it is correctly diagnosed: `Vxx` is inert against any instrument carrying a duty macro, so `x-switch-cutter-blade` and `x-switch-cutter-edge` deliberately carry none. A repaints every two bars (`V01/V02/V00/V02` at `2:0, 2:16, 2:32, 2:48`); A′ automates duty **inside one sustained note** (`V00/V01/V02/V01/V00/V02/V01/V00` every two rows at `6:34 → 6:48`); A″ cycles all three every eight rows; `x-switch-cutter-buzz` carries `dut-pwm-fast` for the +4 restatement at `15:4`. (2) The fractional 6/7 swing as the groove, riff written off-beat so the alternation is maximally audible. (3) `Sxx` chokes on nearly every riff note (S2/S3) and the whole break choked from `12:0`. All three verified and all three are the piece's identity. |
| 8 | groove consistency | **5** | 160/6 → 5.625 ticks/row, `evenTempo: false`, 160 BPM inside [158,162]; the riff is written so the alternation reads rather than hides; no `Gxx`. |
| 9 | loop seam | **5** | `B2` at `17:63`; frame 2 row 0 explicit on pulse 1 (`i10 v13`), triangle and noise; pulse 2 is silent at row 0 and its last note (b♭5 at `17:58`) runs on `pluck`, whose 12-tick `vol-pluck` auto-cuts inside two rows, so nothing is stranded across the seam. `A0f` cancelled with `A00` at `13:58` *before* the `D00` truncation; `000` cancels stated; the last bar is G7 → Cm. |
| 10 | bank + hygiene | **5** | Zero drift; three piece-specific instruments, all correctly named and all existing for the same documented `Vxx`-inertness reason; no pulse note below 55; noise notes 35/41/44/45 exactly matching the brief's tight-kit spec (kick-tight 35, snare-hi 41, metal 44 mode 1); params decimal. |
| 11 | metric interest | **5** | Verified across the board. 8th-level tresillo (6+6+4) on the triangle through A and A″ — attacks at rows 0/6/12 of every 16-row bar, `2:0 → 2:60` and `14:0 → 16:60` — plus a +2-displaced version at `6:2`. A **genuine phase-carried 6-row cell** on pulse 2 through the whole B section, entry rows **0 / 2 / 4 / 0** at frames 8/9/10/11, exactly §9.1's table, resolving onto the downbeat at frame 11. A hemiola across the last three bars carried by **all four lanes simultaneously** at `17:16/22/28/34/40/46/52/58`, eight groups closing on the barline. Metric surprise `D00` at `13:59`. Displacements of +2 (`6:2`) and +4 (`15:4`), both exact row-for-row. |

**Verdict: pass to audition** — but with the two named lowest axes flagged: **3 (harmony: a 4-chord
loop held for 24 bars)** and **4 (a claimed suspension that is not in the file)**. If any album piece
gets a revision round, this is the one where a real second written dissonance and one re-harmonised
A frame would move it several points.

---

## 07 · rust and neon — **50 / 55 — pass to audition**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **5** | 12 frames, `loopFrame 1`, form labels preserved as §9.6 required; the A′ label on frame 3 inside the A block is the octave-up statement §9.6 explicitly told the composer to leave alone. |
| 2 | motif development | **5** | Seven statements (frames 1, 2, 3, 4, 9, 10, 11) with four kinds of variation: metric re-grouping as a tresillo (p1:6, frame 2), +2 displacement (p1:7, frame 4), transposition a fifth up (p1:2, frame 3), and re-harmonisation under the phrygian b♭II with the peak lifted to g5 (p1:4/p1:5). |
| 3 | cadences + harmony | **3** | The phrygian **b♭II (F major)** is genuinely there and lands well — bass f2 from `9:28`, restated on the downbeat at `9:32`, f natural (65) in the lead at `9:32`, and F → Em is a real phrygian cadence at frames 9/10. But the claimed second device, "secondary dominant B7 at `11:48`", is **the primary dominant with a raised third** — standard minor-key practice, not one of §9.3's eight menu devices, and B7 is V, not V/x. (The cited bass note 39 is at `11:56`, not `11:52`.) Meanwhile A is four frames of an E-minor pedal with a B in bar 4 — 16 bars of essentially one chord — and B is Em ‖ Em ‖ F ‖ F. Functional closure exists; §9.3's ≥ 2-distinct-device floor is met **once**, and there is no ≥ 3-link sequence anywhere. |
| 4 | counterpoint | **4** | Fully verified and strong. Pulse 2's attack set across frames 1–4 is exactly as claimed (`0, 4, 8, 12, 16, 20, 26, 28, 32, 36, 40, 44, 48, 52, 56, 60`) — 63 % non-coincident against the riff's syncopated set, and it moves **contrary to the lead on every single shared attack row** (5 of 5 in frame 1: rows 16, 20, 32, 48, 56). A″ gets a different counter-line per frame (p3/p5/p4 at frames 9/10/11) at 64/43/53 % non-coincident — "never below 43 %" is precisely right. Docked one: the written dissonance at `11:28 → 11:36` is real (b3 against F major — the tritone — resolving down by step to a3) but it is an **accented appoggiatura, not the prepared suspension claimed**: the bass moves to f2 on row 28, the same row the b3 is attacked, so nothing is held across a change. It is also the only one, so §9.2's ≥ 2 quota is unmet. |
| 5 | melodic contour | **4** | 78 % stepwise, max leap 14, global peak g5 at `9:48` — 75 % through, in the last third — phrases end with rests, the half-time grid's space respected. Docked one: only one peak-level gesture in the whole piece and the lead's range is a narrow perfect fifth plus an octave (64–79). |
| 6 | dynamics | **5** | 591 events, 4.7 % at vol 15, 12 distinct values (5/4/11 per lane), **16 bars with two or more lanes resting** (the break is DPCM-only, so the ducking pump is naked as briefed). Max exactly **28** attacks per bar at `2:0` — right on §9.8's ceiling and never over, which the composer engineered deliberately and documented ("two bars of 16ths would have put frame 9 at 31"). The only piece in the album that demonstrably managed the ceiling. |
| 7 | briefed techniques | **5** | Every §4.7 and §9.6 item verified at its citation. (1) DPCM carries kick(36) + snare(39) and **there is no noise kick anywhere in the file**. (2) The ducking pump — the triangle re-strikes on rows 0/8/16/24 of every bar under the DPCM kick, exposed in the break. (3) `7xy` tremolo on the sustained B chords (`7` param 52, cancelled with `7` param 0) and `Vxx` noise-mode switching for the metal ticks. §9.6's prescriptions: ghost snares at vol 4–5 on rows **11, 15, 27, 31, 43, 47, 59, 63** — exact; per-section kit variation — A = 8th hats + snare 39, B = off-8th hats + `metal`(44) on every bar downbeat, break = hats out entirely with ghosts only, A″ = 16ths through bar 1 (rows 2–15) + snare moved to 41 + metal kept — all four verified; **five distinct fills, no two alike** — snare roll `2:48–62`, toms with `pit-tom-drop` `4:56–62`, all-ghost `6:52–59`, crash-led `8:56`, pitch-macro riser `10:56–62` — all five verified. |
| 8 | groove consistency | **5** | 150/9 → 100 BPM inside [99,101]; integer ticks/row; `G01` nudges only, never on a section downbeat. |
| 9 | loop seam | **5** | `B1` at `11:63` on the dpcm lane = `loopFrame 1`; frame 1 row 0 explicit on all five lanes (dpcm's volume column is ignored by design); both pulses released with `===` at `11:62`; `7xy` and `Axy` both cancelled; the last bar is B7 → Em across the seam with the lead's d♯ resolving into the loop. |
| 10 | bank + hygiene | **5** | Zero drift; one piece-specific instrument, correctly named `x-rust-and-neon-riser`, whose pitch macro walks the noise index down and ends on 0; no pulse note below 55; noise notes 37/39/41/44/45/46 all inside 32–47; dpcm assignments carry explicit `delta` preloads per §3.5. |
| 11 | metric interest | **4** | The tresillo at frame 2 is exactly as cited — attacks at rows **0, 3, 6 ‖ 8, 11, 14 ‖ 16, 19, 22 ‖ 24, 27, 30** and the same 3+3+2 through bars 3–4 to row 62, 24 attacks, group heads accented. The +2 displacement at frame 4 is row-for-row exact against an unmoved kit and bass, with the closing note shortened so nothing crosses row 63. The metric surprise `D00` at `6:59` sits on a **new** noise pattern (index 8), so frame 5 is not truncated — the pattern-sharing trap §9.6 warned about, correctly avoided. What it lacks is a device that *spans*: the tresillo is one frame, the displacement is one frame, and no cell carries phase anywhere. §9.6's stated target was "axis 11 ≥ 4 (the tresillo restatement plus the dropped beat, both cited)" and that target is met on the director's own terms — **but this is the thinnest 4 in the album**, and a 6-row triangle cell through the B section would have been nearly free. |

**Verdict: pass to audition.** Lowest axes: **3 (one menu-level non-diatonic device, not two)** and
4/5/11.

---

## 08 · long division — **52 / 55 — pass to audition**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **5** | 25 frames, `form` matches §4.8's map exactly (0–1 I, 2–6 A, 7–10 B, 11–13 bridge, 14–15 retransition, 16–20 A′, 21–24 coda), `F07`/`F06` architecture preserved at frames 11 and 14 as §9.7 required, `loopFrame 2`. |
| 2 | motif development | **5** | The best motif work in the suite. Statement (p1:1); rhythmic diminution of the answer (p1:2); transposition into C major (p1:3) with a **+2-displaced re-entry** (p1:13 at `7:2`, frame 8 keeping the undisplaced version so the displacement reads as an entry gesture); **augmentation at doubled note values** (p1:7/p1:8) with a **−2 anticipated re-entry** (p1:16, head written into `15:62`); re-orchestration onto the triangle in the bridge; final re-harmonisation under the Neapolitan (p1:9). Four menu-level transformations plus three displaced re-entries. |
| 3 | cadences + harmony | **4** | Three key centres with three *different* prepared modulations, all present: pivot chord (the shared Am held bare across frames 6/7), bare unison lead-in plus `F07` at `11:0`, and a whole bar of E7 with `F06` at `14:0`. **Chromatic inner voice** in the bridge, verified exactly at its citations: pulse 2 descends d4 → c♯4 → c4 → b3 → a♯3, one step per bar, each chromatic tone resolving by step in the same direction within 2 rows at `11:12/14`, `11:28/30`, `11:44/46`, `11:60/62`, the shape inverted at frame 12, closed at `13:60/62` with a g♯ lower neighbour preparing the E7 — over a re-articulated d pedal in the triangle. **Neapolitan B♭** opening the coda at `21:0` (bass a♯2, lead f5, pulse 2 a♯3 with a `071` major-triad arp). Docked one for §9.3's mechanical bound: the surface progressions under all of this are 4-bar loops held well past 8 bars — Am–F–Dm–E for 20 bars (frames 2–6), C–Am–F–G for 16 (frames 7–10), B♭–E–Am–E for 16 (the coda). |
| 4 | counterpoint | **4** | The 6-row cell gives pulse 2 its own metre for the whole of A (frames 2–4: 45/55/30 % non-coincident, 43 % for the section — over §9.2's floor, though frame 4 alone dips under it), and the bridge gives it a genuinely independent chromatic line (67 % non-coincident, 100 % contrary/oblique at frame 11). **One textbook cadential 4–3 suspension, verified:** c4 prepared at `10:46` as the fifth of F, held through the change to G at row 48, resolving down by step to b3 at `10:52`. The second claimed dissonance — "appoggiatura at `24:56`, g♯4 over E7" — is a **chord tone** (g♯ is E7's third); it is a leading-tone resolution across the loop seam into a4 at `2:0`, a fine gesture but the wrong label. The bridge's chromatic line supplies the missing written dissonance in substance if not in name. |
| 5 | melodic contour | **5** | 84 % stepwise, max leap 10, the motif recognisable through all four transformations (§4.8's stated pass/fail test). Global peak f5 at `21:0` — 84 % through — landing on the Neapolitan's downbeat, so the highest note and the biggest harmonic event are the same moment. Phrase rests throughout. |
| 6 | dynamics | **4** | 1190 events, 3.5 % at vol 15, 13 distinct values, 8 bars with two or more lanes resting, max 23 attacks per bar. Docked one for two small misses: pulse 2 uses exactly **3** distinct volume values (10/11/12), the bare §2.8 minimum on the album's longest and fullest piece; and the noise lane's longest gap is 11 rows at `11:56` against a declared `percussionGap` of 8 (inside the gate's slack, over the declaration). |
| 7 | briefed techniques | **5** | §4.8's three: three key centres with one modulation technique each; `Fxx` as a structural event (`F07` at `11:0`, defensively restated at `12:0`/`13:0`; `F06` at `14:0`/`15:0`, so the speed at the loop seam is unambiguous on both passes); motif development across the whole form. **All six of §9.7's prescribed changes implemented at their cited locations** — A (polymetric cell), B (three displaced re-entries), C (hemiola), D (chromatic inner voice), E (B-accompaniment variation: triangle 6-row cell at frames 9/10 entry 0 then 2, pulse 2's own pattern at frame 10), F (`D00` at `20:59` on `pulse1 p12`, which frame 20 alone references). Both engine traps documented and handled: `3xx` is a persistent channel mode cancelled with `200` rather than the ineffective `300`, and a duty macro overrides `Vxx` from the next tick. |
| 8 | groove consistency | **5** | 150/6 → 150 BPM, bridge at speed 7 → 128.57 BPM, `bpmRange [128,151]` correctly declared to cover both; integer ticks/row at both speeds; `G02` flams only. |
| 9 | loop seam | **5** | `B2` at `24:63`; frame 2 row 0 explicit on all four sounding lanes with `A0` cancelling the swell; speed is 6 at the seam on both passes because `F06` is restored at `15:0`; portamento cancelled with `200`; the coda's last bar is E7 with g♯4 at `24:56` resolving to a4 at `2:0` — a turnaround, not a stop. |
| 10 | bank + hygiene | **5** | Zero drift; no `x-` instruments; no pulse note below 60; noise 36–46; `dpcm-kit` used only for snare reinforcement in the last two coda frames, exactly as §4.8 specifies; params decimal and documented. |
| 11 | metric interest | **5** | A clean 5. The **6-row dotted-quarter cell on pulse 2 under the whole A theme, phase-carried by hand across three patterns** — entry rows **0 / 2 / 4** at frames 2/3/4, exactly §9.1's table — resolving onto the downbeat at frame 5 where the aligned pattern returns, cited `2:0 → 4:58`. The **hemiola into the tempo drop** at frame 10 rows **16, 22, 28, 34, 40, 46, 52, 58**, eight groups closing on the barline, carried by pulse 2 *and* the kit (snare on the odd groups, tom with `pit-tom-drop` on the even) — verified exactly. A second 6-row cell on the triangle at frames 9/10 (entry 0 then 2). Three displaced re-entries, one per modulation (+2 at `7:2`, +4 at `11:4`, −2 with the head at `15:62`), all row-exact. One metric surprise, `D00` at `20:59`. (One descriptive slip: the note says the triangle "holds its bar root as a pedal from `10:16`" — it is actually still running its 6-row cell there, re-articulating the root once per bar.) |

**Verdict: pass to audition.** Lowest axes: 3 (4-chord loops under good modulations) and 4/6.

---

# the four demo fixtures (09–12)

These are `phase2-design.md` §5.2 QA fixtures, not album pieces. Per the director's ruling their §5
specs override §9's floors where the two conflict, so they are **scored honestly on the eleven axes**
and their verdict line is *fixture — discretion: keep* unless something is actually broken. Two of
them carry an axis at 2; in both cases the 2 is the direct consequence of the fixture's own spec, and
is named as such.

## 09 · first light — **43 / 55 — fixture — discretion: keep**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **4** | 8 frames, intro/A/A/B/B/A′/A′/turn, coherent and matching its own declaration. Not an album form (51 s against the album's 90–180 s), which is the fixture spec. |
| 2 | motif development | **4** | p1:1 stated; p1:2 inverts the opening contour and lifts the peak to a5; p1:5 states it in augmentation as the turnaround. Three recurrences, two variations. |
| 3 | cadences + harmony | **3** | C major with A7 as V/ii at `3:0`, spelled by the `0xy` effect (param 74) rather than by written notes — which is *why* the accidental count is 0 %. That is a deliberate fixture decision, and a correct one: the piece is diatonic so a key-lint regression shows up as a real failure instead of being masked by a chromatic budget. One colour, effect-spelled. |
| 4 | counterpoint | **2** | Pulse 2 **is** pulse 1 one frame later, by construction: `order[k][1] == order[k-1][0]` for every k (pulse 1 column 0,1,2,3,4,1,2,5; pulse 2 column 6,0,1,2,3,4,1,2) — verified exactly. Under §9.5's tightened axis 4 that is "an echo machine and nothing else". **But it is the fixture's entire subject** — §2.2 says the one-frame echo may *only* be authored this way, and this file exists to regression-test it. The `turn` frame (43 % non-coincident, 71 % contrary/oblique) is the one place two lines emerge. Scored 2 on the rubric; §5 spec wins on the verdict. |
| 5 | melodic contour | **3** | 73 % stepwise, max leap 8, phrases end with `===`. Global peak a5 at `2:40` — 25 % through. |
| 6 | dynamics | **4** | 445 events, 2.5 % at vol 15, 11 distinct values (5/4/10 per lane). Only 1 bar with two lanes resting — the §2.8 minimum. |
| 7 | briefed techniques | **5** | Every §5.2 claim verified. Volume envelopes with loop and release — `===` at `1:28`/`1:60`, and the intro `pad` at `0:0` showing `vol-pad`'s 12-tick swell, sustain at 12, and 9-tick release at `0:24`. Duty macros — `dut-attack` on the lead, `dut-pwm-slow` on a 24-row pad note (long enough to hear the 16-tick sweep), `dut-12` on the echo. **Arpeggio macro vs arpeggio effect side by side** — `0:32–63` uses `arp-bed-maj`/`arp-bed-min` instrument macros, frames 3–4 use the `0xy` effect (74/55/71), cancelled with `000` at frames 1, 2, 5, 7 row 0. One-frame echo via the order column. `F05` at `3:0`/`4:0`, `F06` at `1:0` — **and frame 1 is the loop target, so the speed is restated rather than inherited**. `G02` snare flam at `2:27`. |
| 8 | groove consistency | **5** | 150 BPM base, `F05` lifts B to 180, and `bpmRange [148,182]` is declared to cover the event — the correct way to declare a tempo-changing fixture. Integer ticks/row at both speeds. |
| 9 | loop seam | **5** | `B1` at `7:63`; frame 1 row 0 explicit on all four lanes and restates `F06`; `000` cancels the arp before the loop so nothing leaks into the lead; both pulses released with `===`. |
| 10 | bank + hygiene | **5** | Zero drift, no `x-` instruments, no pulse note below 60, noise 36–46, all macros canonical. |
| 11 | metric interest | **3** | The triangle's 6-row octave cell in frames 1–2 and 5–6 is real — the octave-up note recurs every 6 rows (`1:4, 1:10, 1:16, 1:22, 1:28, 1:34 …`) against 16-row bars, realigning every 3 bars, verified by reading the note column. B swaps it for an 8th-level tresillo bass (`3:0/6/12` of every bar, frames 3–4). Two devices, each spanning a full section, but no phase carry and no metric surprise. |

**Verdict: fixture — discretion: keep.** Nothing is broken; axis 4 = 2 is the §5-vs-§9.5 conflict the
ruling anticipates. If it is ever promoted out of fixture status it needs a real pulse-2 line.

## 10 · long fall — **43 / 55 — fixture — discretion: keep**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **4** | 7 frames, intro/A/A/B/B/A′/riser, coherent; 60 s, fixture length. |
| 2 | motif development | **4** | p1:1; p1:3 augments the A phrase into 16-row held notes for the vibrato section; p1:5 scoops into it with `Qxy` and re-harmonises the tail over F♯7; p1:6 states it once more and then dismantles it with `2xx`/`1xx`. Three recurrences, two–three variations. |
| 3 | cadences + harmony | **3** | B minor with F♯7 (a♯, notes 82 and 34) as the real dominant at frames 2, 4 and `5:48`. One colour, and it is the raised third of a minor-key dominant — standard practice rather than a menu device. |
| 4 | counterpoint | **3** | A (frames 1–2) is 88/75 % non-coincident with pulse 2 on its own rhythm; B (frames 3–4) is 0 % — pulse 2 doubles the held notes in thirds so the `P7e` detune can beat against them, which is the demo's point. Independence in moments; parallel thirds are B's default posture. No written suspensions. |
| 5 | melodic contour | **3** | 47 % stepwise, max leap 15, peak b5 at `2:40` (29 % through). The lead is deliberately built from scoops, falls and slides — as a melody it is not shaped; as a pitch-effect fixture it is exactly right. |
| 6 | dynamics | **3** | 190 events, 4.7 % at vol 15, 10 distinct values overall — but **pulse 2 uses only two** (9 and 10), below §2.8's "at least three per melodic channel". A genuine, one-line-fixable miss. 2 bars with two lanes resting. |
| 7 | briefed techniques | **5** | All five §5.2 pitch-effect claims verified at their cited rows. `3xx` as a **persistent channel mode** — `303` at `1:4`, `2:4`, `5:12`, with every exit written as `2xx` param 0 at `1:62`, `2:62`, `5:52`, because `300` only freezes the glide. `Qxy`/`Rxy` do not retrigger and arm from whatever is sounding — `R52` at `0:36`, `R51` at `0:52`, `Q50` at `5:2`, each followed by a `200`. Delayed `4xy` — note on row *n*, vibrato on *n*+2 at `3:2/3:18/3:34/3:50` and `4:2/4:18/4:34/4:50`, each cancelled with `400`, running on `lead-plain` (the one bank instrument with no pitch macro) so `4xy` is the only vibrato in the signal. `Pxx` persists — `P126` from `0:48`, restated at the loop target `1:0`, returned to `P128` at `6:56`. The riser — `2xx` at `6:40`, then `1xx` param 4 from `6:52`, cancelled with `100` at `6:63` so the slide rate cannot leak onto the first note of the loop. |
| 8 | groove consistency | **5** | 150/8 → 112.5 BPM inside [111,114]; integer ticks/row. |
| 9 | loop seam | **5** | `B1` at `6:63`; frame 1 row 0 explicit on all four lanes with `P126` restated there; the `1xx` cancellation on row 63 is the sharpest seam hygiene in the whole set. |
| 10 | bank + hygiene | **5** | Zero drift, no `x-` instruments, no pulse note below 59, noise 36–46. |
| 11 | metric interest | **3** | The B section's triangle is a 6-row cell (`3:0/6/12/18/24/30/36/42/48/54/60`, frames 3–4) against a 4-row beat — two bass attacks per three beats, realigning every three bars — while the A sections walk in straight quarters, so the bass metre changes with the section rather than with the tempo. One device, one section, no displacement, no surprise. |

**Verdict: fixture — discretion: keep.** One cheap improvement if a revision round happens: give
pulse 2 a third volume value.

## 11 · hammer shop — **44 / 55 — fixture — discretion: keep**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **4** | 6 frames, intro/A/A/slow/tempo/finale — 38.4 s, the shortest piece in the set, which is the fixture spec rather than an album form. |
| 2 | motif development | **3** | The subject is a 3+3+2 stab cell (p1:1) restated over the Neapolitan B♭ and choked with `Sxx` (p1:4). Two statements, one variation. It is a percussion-and-dynamics fixture, not a tune. |
| 3 | cadences + harmony | **3** | A minor; the raised third of the E major dominant (g♯4 = 68, g♯5 = 80) at `1:48`, and a Neapolitan B♭ major at `5:16`. Two colours, one of them a real menu device. |
| 4 | counterpoint | **3** | Pulse 1 runs the 3+3+2 stab cell while pulse 2 plays straight quarters underneath — 50 % non-coincident with 86 % contrary/oblique on shared rows, sustained through the whole A section. Genuine rhythmic independence for a stab piece, but neither lane is a melodic line and there are no written suspensions. |
| 5 | melodic contour | **2** | 57 % stepwise across 82 events, peak g♯5 at `1:56` (17 % through), no phrase architecture. **There is no melody to score** — both pulse lanes are chord stabs, which is precisely what §5.2 asks this fixture to be. Scored 2 on the rubric; §5 spec wins on the verdict. |
| 6 | dynamics | **5** | The fixture's own subject and it delivers. 384 events, 12.5 % at vol 15 (the album's highest and still a third of the 45 % ceiling), 12 distinct values (6/6/12 per lane); ghost snares at vol 4–5 on rows **7, 15, 23, 31, 39, 47, 55, 63** against backbeats at v13 — verified; `A0f` swell at `3:0` cancelled at `3:8`; `732` tremolo at `2:0`/`3:16` cancelled at `3:48`; `Sxx` chokes at `5:0`, `5:16`, `5:32`. 3 bars with two lanes resting. |
| 7 | briefed techniques | **5** | The auto-cut idiom is absolute — every drum's length comes from its volume macro reaching 0 and the noise lane is nothing but notes and a volume column. Four `Fxx` events demonstrating **both sides of `speedSplitPoint`**: `F` param 8 at `3:0` sets speed, param 120 at `4:0` crosses 32 and sets *tempo*, param 6 at `5:0` and param 150 at `5:48` restore both — verified. Per-section kit variation: A = 3-row hat cell + snare 39 + ghosts; frame 3 = snare 41; frame 4 = closed hats out entirely, open hats on the off-8ths, `metal`(44, mode 1) on row 2 of each bar and the backbeat moved to row 11; finale = hat cell back plus a tom fill. `Vxx` on noise selecting the LFSR mode, made demonstrable by `x-hammer-shop-anvil`, which carries no duty macro — the engine fact is correctly diagnosed and the workaround is the right one. |
| 8 | groove consistency | **4** | 150 BPM base and integer ticks/row, `G02` nudges only. Docked one for a **declaration error**: the four `Fxx` events take the piece to 112.5 BPM (`3:0`) and 90 BPM (`4:0`), but `bpmRange` is declared `[148,152]`. `09-first-light` widens its range to `[148,182]` for exactly this reason; this file should read `[89,152]`. |
| 9 | loop seam | **5** | `B1` at `5:63`; frame 1 row 0 explicit on all lanes; `F` param 150 at `5:48` restores tempo so the state at the seam is identical on both passes — loop rule 2 satisfied and named; `7xy` cancelled at `3:48`, `Axy` at `3:8`. |
| 10 | bank + hygiene | **5** | Zero drift; one piece-specific instrument, correctly named; no pulse note below 69; noise 36–46 including `metal` at 44 with mode 1. |
| 11 | metric interest | **5** | The densest polymetric writing per frame in the whole set. A **genuine phase-carried 3-row hat cell**: hats fall on `r%3==0` in frame 1, `r%3==2` in frame 2, `r%3==1` in frame 3 — entry rows **0 / 2 / 1**, exactly §9.1's table for c = 3 in 64-row frames — verified by isolating note 45, and it clears out at frame 4 where the kit changes. Simultaneously: a 16th-level tresillo on pulse 1 (`1:0/3/6 ‖ 1:8/11/14` of every bar) against straight quarters on pulse 2 and a 6+6+4 triangle (`1:0/6/12`), three grids at once through the whole A section. The `Fxx` events are the metric surprise. |

**Verdict: fixture — discretion: keep.** Axis 5 = 2 is "there is no melody here by design". The one
real defect is the `bpmRange` declaration, which is a two-number fix.

## 12 · switchback — **46 / 55 — fixture — discretion: keep**

| # | axis | score | finding |
|---|---|---|---|
| 1 | form fidelity | **4** | 9 frames, intro/A/A′/B/B′/A″/C/D/end — a structure-and-timing fixture rather than an album form, and 54 s. |
| 2 | motif development | **4** | Statement (p1:1); **re-orchestrated onto pulse 2 while pulse 1 drops to a slow harmony line beneath it** at `2:0` and `4:0` — the two frames §5.2 asks for, verified; truncated by the dropped beat (p1:5); final statement in rhythmic diminution over the turnaround (p1:8). Four statements, three variations including a real re-orchestration. |
| 3 | cadences + harmony | **3** | D minor; the raised third of A7 (c♯5 = 73) at `1:60` and `6:32`, and a **Neapolitan b♭II (E♭ major)** at `6:16` voiced e♭5 = 75 in the lead over an e♭2 = 39 bass. Two colours, one a menu device. |
| 4 | counterpoint | **3** | Pulse 2 carries the melody at frames 2 and 4 while pulse 1 drops beneath it — a real role swap; elsewhere it plays an independent pluck counter-line on the off-8ths whose attacks never coincide with pulse 1's (frames 1, 3, 5: 100 % non-coincident). Sustained independence through complete sections, but no written suspensions or appoggiaturas anywhere. |
| 5 | melodic contour | **3** | 69 % stepwise — just under the floor — max leap 16; global peak a5 at `7:16`, 78 % through, in the last third. Phrases breathe. |
| 6 | dynamics | **4** | 393 events, 2.5 % at vol 15, 12 distinct values (6/5/11 per lane), max 17 attacks per bar. Only 2 bars with two lanes resting. |
| 7 | briefed techniques | **5** | Every item of §5.2's order-list vocabulary verified. `B` param 1 at `8:63` loops to frame 1 so the intro plays once. `D` param 0 at `5:59` **drops a beat** — frame 5 runs 60 rows. `D` param 8 at `6:63` is the **shortcut** — frame 7 starts at row 8, eliding its first half-bar. `F` param 7 at `6:0` sets speed 7 and `F` param 6 at `7:8` — deliberately placed on the elided frame's *first played row* — restores speed 6, so the seam state is identical on both passes. `Vxx` repaints on `x-switchback-voice`, which carries no duty macro precisely so `Vxx` can speak, with `V01` restated at `8:62`. **The documented deviation is the right call**: §5.2 also asks for a `Cxx`-terminated ending variant, but preset-suite §7.1's Gate-B loop-frame check now fails any registered song carrying `Cxx`, so the ending variant is reached by the `D08` elision into frames 7–8 instead. The later binding rule wins, the fixture still exercises an ending variant, and the deviation is stated plainly. |
| 8 | groove consistency | **5** | 160/6 → 5.625 ticks/row, `evenTempo: false`, 160 BPM inside [158,162]; melody and counter-line written on off-8ths (`1:2`, `1:10`, `1:18` …) so the alternation reads as swing rather than as an artifact; `F07` at frame 6 changes it deliberately. |
| 9 | loop seam | **5** | `B1` at `8:63`; frame 1 row 0 explicit on pulse 1/triangle/noise, pulse 2 legitimately silent; speed restored to 6 at `7:8` so the seam matches on both passes; `V01` restated at `8:62`; both pulses released with `===` at `8:62`; no `Cxx` anywhere. |
| 10 | bank + hygiene | **5** | Zero drift; one piece-specific instrument, correctly named; no pulse note below 55; noise 36–46. |
| 11 | metric interest | **5** | **The album's cleanest phase carry.** The triangle runs a 10-row cell across five frames with entry rows **0 / 6 / 2 / 8 / 4** at frames 1/2/3/4/5 — exactly §9.1's table for c = 10 in 64-row frames, verified attack-for-attack (`1:0,10,20,30,40,50,60` · `2:6,16,26,36,46,56` · `3:2,12,22,32,42,52,62` · `4:8,18,28,38,48,58` · `5:4,14,24,34,44,54`). It is 5-over-4 against the kit, it re-aligns exactly at frame 6 where the tempo changes, and **its last attack at `5:54` lands before the dropped beat at `5:59`**, which is precisely what §9.8 requires of a phase-carried cell at a truncation. Plus an 8th-level tresillo kit through the whole B section — kick at rows 0, 6 **and 12** of every bar and snare at row 8, `3:0 → 4:46`, i.e. a fuller 6+6+4 than the note claims — and two order-list metric events. |

**Verdict: fixture — discretion: keep.** The strongest of the four demos and the only one that would
survive album scoring on its own terms.

---

# album level

## totals

| # | piece | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | total | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 04 | paper lanterns | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **54** | pass to audition |
| 08 | long division | 5 | 5 | 4 | 4 | 5 | 4 | 5 | 5 | 5 | 5 | 5 | **52** | pass to audition |
| 05 | tide pool | 5 | 5 | 4 | 4 | 4 | 5 | 5 | 5 | 5 | 5 | 5 | **52** | pass to audition |
| 03 | midnight ferry | 5 | 4 | 5 | 3 | 4 | 5 | 5 | 5 | 5 | 5 | 4 | **50** | pass to audition |
| 07 | rust and neon | 5 | 5 | 3 | 4 | 4 | 5 | 5 | 5 | 5 | 5 | 4 | **50** | pass to audition |
| 06 | switch cutter | 5 | 4 | 3 | 3 | 5 | 4 | 5 | 5 | 5 | 5 | 5 | **49** | pass to audition |
| 02 | glass ladder | 4 | 5 | 5 | 3 | 4 | 4 | 5 | 5 | 5 | 5 | 4 | **49** | pass to audition |
| 01 | iron sunrise | 5 | 4 | 5 | 3 | 4 | 4 | 5 | 5 | 5 | 5 | 4 | **49** | pass to audition |
| 12 | switchback | 4 | 4 | 3 | 3 | 3 | 4 | 5 | 5 | 5 | 5 | 5 | **46** | fixture — discretion: keep |
| 11 | hammer shop | 4 | 3 | 3 | 3 | **2** | 5 | 5 | 4 | 5 | 5 | 5 | **44** | fixture — discretion: keep |
| 10 | long fall | 4 | 4 | 3 | 3 | 3 | 3 | 5 | 5 | 5 | 5 | 3 | **43** | fixture — discretion: keep |
| 09 | first light | 4 | 4 | 3 | **2** | 3 | 4 | 5 | 5 | 5 | 5 | 3 | **43** | fixture — discretion: keep |

**All eight album pieces clear §9.5's ≥ 48 / no-axis-below-3 bar. None requires revision.** The two
fixture axes at 2 (09's counterpoint, 11's contour) are both direct consequences of what §5.2 asks
those files to demonstrate, and both are covered by the standing ruling.

## ranking, best → weakest

1. **04 paper lanterns (54)** — the only file where every single `frame:row` citation survived
   inspection, and the only one whose composer computed §9.1's phase-carry table instead of guessing it.
2. **08 long division (52)** — the biggest achieved scope: four motif transformations, three key
   centres with three different prepared modulations, and all six of §9.7's prescribed changes landed.
3. **05 tide pool (52)** — two independent phase carries running for eight of eleven frames, and the
   only lead that is both transposed *and* inverted; slightly behind 08 on harmonic reach.
4. **03 midnight ferry (50)** — the most beautiful surface in the album and the two cleanest
   suspensions; capped by the fact that its brief *is* pulse 2 following pulse 1.
5. **07 rust and neon (50)** — the revision worked: pulse 2 now moves contrary on every shared attack
   and the kit has five distinct fills; held back by a harmony of one chord and one device.
6. **06 switch cutter (49)** — the most exciting piece here (augmented sixth, four-lane hemiola,
   real duty automation) sitting on top of the album's most static progression.
7. **02 glass ladder (49)** — the arp-effect-vs-arp-written-out argument genuinely lands, and the
   diminution is textbook; its three "written dissonances" are all chord tones.
8. **01 iron sunrise (49)** — the best articulation discipline in the set (every `Qxy`/`Rxy` cancelled)
   and a real chromatic descent, undercut by 8 bars of octave doubling at the climax.
9. **12 switchback (46)** — the strongest fixture; a flawless five-frame 10-row phase carry and the
   right call on the `Cxx` ban.
10. **11 hammer shop (44)** — three grids at once in a 6-frame file; a percussion fixture with a
    `bpmRange` that does not cover its own tempo events.
11. **10 long fall (43)** — five pitch-effect traps demonstrated exactly, one thin melodic axis and a
    two-value pulse-2 volume column.
12. **09 first light (43)** — the macro fixture, correct in every technical claim; the one-frame echo
    is definitionally a mirror, so it scores lowest on the axis the prestige pass cares most about.

## the three strongest moments in the suite

1. **`06 switch cutter · 11:0 → 11:32` — the augmented sixth.** Triangle a♭2 (♭6), pulse 2 c4 (the
   tonic), pulse 1 f♯5 (♯4): three voices, exactly the chord, on a 2A03 — resolving outward to G at
   `11:32` as the bass falls a♭ → g and the lead climbs to g5. Nothing else in the album reaches this
   far harmonically, and the voicing is exactly §9.3's cheap-3-voice recipe.
2. **`04 paper lanterns · 6:0 → 9:46` — the phase-carried 5-row ostinato.** Entry rows 0 / 2 / 4 / 1
   across four 48-row frames, under a 3/4 waltz, so the cell and the bar argue for a complete section
   and then resolve — and it *returns* at `13:0` and `14:2` so the device has a reprise as well as a
   beginning and an end. This is what §9.1 was written to produce.
3. **`06 switch cutter · 17:16 → 17:58` — the hemiola close.** Eight 6-row groups carried by pulse 1,
   pulse 2, triangle and the kit *simultaneously*, closing exactly on the barline, with the piece's
   global peak b♭5 landing on the eighth accent at `17:58` after a rising e♭4–g4–b♭4–e♭5–b♭5 climb.
   The one place in the album where every voice agrees to disagree with the bar at once.

Two that came close: `08 long division · 10:46 → 10:52`, the cadential 4–3 suspension held through
the chord change immediately before `F07` drops the tempo; and `12 switchback · 1:0 → 5:54`, the
10-row cell that re-aligns exactly where the tempo changes and lands its last attack five rows before
the dropped beat.

## the three weakest moments

1. **`06 switch cutter · 8:56 → 9:16` — claimed but absent.** `extra.qa.notes` says "8:56 holds e♭5
   from Cm across the change and resolves down to d5 at 9:16". At `8:56` pulse 1 plays d♯5 over a c3
   bass; the bass moves to a♭2 at `9:0` where d♯5 is **restruck as a chord tone of A♭**; pulse 1's next
   notes are g5 (`9:8`) and f5 (`9:16`). There is no d5 anywhere in frame 9. This is the only
   flatly-absent device in the entire suite, and losing it drops the piece to one written dissonance
   against §9.2's quota of two.
2. **`01 iron sunrise · 15:0 → 16:63` — eight bars of one voice.** Frame 15 has pulse 2 shadowing
   pulse 1 at 5 % non-coincidence with 19 of 20 shared moves similar; frame 16 is exact parallel
   octaves, 0 % non-coincident, for four more bars. §9.2 allows the parallel gesture for ≤ 4 bars at a
   time and frame 16's octaves are briefed — but stacking frame 15 in front of it means the album's
   loudest climax is also the moment it has the fewest voices.
3. **`07 rust and neon · frames 1–4 — sixteen bars of one chord.** E minor pedal with a single B in
   bar 4, four times, and the piece's only menu-level non-diatonic device (the phrygian ♭II) does not
   arrive until frame 9. The claimed second device, "secondary dominant B7 at `11:48`", is the primary
   dominant with a raised leading tone — standard minor-key practice and not on §9.3's menu — so the
   harmonic ambition floor is met once, not twice.

## cross-album issues

**1 · The §9.8 density ceiling is breached by both batch-A pieces and nowhere else, undeclared.**
`01 iron sunrise` exceeds 28 attacks per bar in **41 of 68 bars** (peak 38 at `6:0`); `02 glass ladder`
in **18 of 64** (peak 33 at `14:32`). Every other piece stays under, and `07 rust and neon` hits
exactly 28 and documents why it stopped there. Part of this is a genuine conflict — §4.1's briefed
16th triangle plus 16th hats is 26–32 attacks before a melody note exists — but §9.8 is the later
binding text and §2 makes an *undeclared* deviation a critic finding. Either declare it in
`extra.qa.notes` with the musical argument, or thin one lane. Note that the companion rule ("never
more than two lanes running 16ths at once") **is** respected everywhere.

**2 · "Suspension" and "appoggiatura" are used loosely in four of eight album pieces.** All three of
`02 glass ladder`'s cited dissonances (`7:16`, `8:48`, `9:48`) are chord tones; `08 long division`'s
`24:56` "appoggiatura" is E7's third; `07 rust and neon`'s `11:28` is an appoggiatura, not the prepared
suspension claimed; `01 iron sunrise`'s second is interrupted by a `---`. The four pieces that got it
right — `04` (`5:32`, `17:30`, `13:0`), `05` (`4:24`, `10:32`), `03` (`8:44`, `8:28`), `08` (`10:46`) —
all did it identically: a chord tone from the old harmony *sounding* across the change, then down by
step. This is a vocabulary problem rather than a craft ceiling, but §9.2's quota is a count of real
dissonances, so four pieces are formally short.

**3 · Three different `rmsRange` conventions, and batch C declares without measuring.** Batch B and
`12` declare snug ±1.8 dB windows around a stated measurement (`04` −22.79, `05` −22.82, `06` −22.57,
`11` −26.59, `12` −21.48 dBFS). Batch A declares ±3.5 dB windows around a stated measurement (`01`/`03`
−20.5, `02` −21.0). **Batch C declares `[-27,-19]` — an 8 dB window — with no measured value stated at
all in either `07` or `08`.** A loose window is exactly what makes that gate vacuous; both files should
state their measurement and tighten. The underlying spread is real too: `11 hammer shop` at −26.6 dBFS
sits ~6 dB below `01`/`03` at −20.5, so it will read as a hole in a straight-through listen at track 11.
The reason (drums and short stabs, no sustained lead) is honest and documented — this is a
*sequencing* note for the director, not a defect in the file.

**4 · §9.3's no-stock-loop rule is not being enforced anywhere.** `06 switch cutter` runs
Cm ‖ Cm ‖ Fm ‖ G7 for **24 consecutive bars** (frames 2–7) and 12 more at A″; `08 long division` runs
Am–F–Dm–E for 20 bars (frames 2–6), C–Am–F–G for 16 (frames 7–10) and B♭–E–Am–E for 16 (the coda);
`07 rust and neon`'s A is a 16-bar one-chord vamp. The mechanical bound is 8 bars. In every case what
*changes* over the loop is the surface — polymeter, duty automation, motif transformation — which is
why none of these pieces sounds static; but the prestige pass asked for harmonic motion as well as
rhythmic and timbral motion, and that is the one axis where it did not land. `02 glass ladder` (an
8-bar climbing unit), `03 midnight ferry` (two alternating 4-bar progressions plus a 6-bar descent)
and `04 paper lanterns` (a 6-link chromatic descent and a 5-link fifths sequence) show what the album
could have done throughout.

**5 · Bank cohesion is the album's strongest unifying asset.** Zero drift across twelve files: every
canonical instrument in every song resolves to byte-identical macro values. Six piece-specific
instruments exist and all six are correctly named `x-<songid>-<what>` — and, notably, five of them
(`glass`, `blade`, `edge`, `buzz`, `voice`, plus `anvil`) exist for the *same* correctly-diagnosed
engine reason: a duty macro overwrites `Vxx` from the next tick, so an instrument that wants `Vxx` to
speak must carry no duty macro. Three separate composers independently found and documented that fact.
Only `07` and `08` use the DPCM lane, as §2.6 requires; the other ten declare it unused and leave it
empty. The album sounds like one album.

**6 · Six of twelve pieces reach for the same polymetric cell.** The 6-row dotted-quarter cell is the
primary or secondary device in `05` (frames 1–3), `06` (8–11), `08` (2–4 and 9–10), `03` (10–13),
`09` (1–2, 5–6) and `10` (3–4). §9.1 calls it "the safest, most musical option" and it works every
time, but the two cells that actually sound *strange* are `04`'s 5-row and `12`'s 10-row. If any piece
gets a revision round, moving one of the 6-row pieces to c = 5 or c = 3 would buy real album variety
at no structural cost.

**7 · Only four of twelve carry a true phase carry.** `04` (5-row, entry 0/2/4/1 over 48-row frames),
`05` (5-row, entry 0/1/2/3/4 and 6-row, entry 0/2/4), `08` (6-row, entry 0/2/4), `11` (3-row, entry
0/2/1) and `12` (10-row, entry 0/6/2/8/4) compute §9.1's entry-row sequence and carry the cell across
frame boundaries. Batch A's three pieces all reset the cell's phase at every frame boundary — the
rotation inside each frame is real and audible, which is why they hold a 4, but none of them reaches
§9.5's "carrying its phase across ≥ 3 frames". That is a one-pattern-per-frame fix if the director
wants batch A at 5.

**8 · One declaration bug worth fixing regardless of verdict.** `11 hammer shop` declares
`bpmRange [148,152]` while its own `Fxx` events take it to 112.5 and 90 BPM. `09 first light` declares
`[148,182]` for exactly this reason and `08 long division` declares `[128,151]`. `11` should read
`[89,152]`.
