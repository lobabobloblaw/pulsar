/** the preset registry (design §5.4, preset-suite §7.4).
 *
 *  **A composer registers a song by ADDING A FILE.** There is no list to edit, no
 *  import to add, no shared file to serialize on — `import.meta.glob` is the registry,
 *  and song files have no shared registration list. Drop `NN-name.json` in this
 *  directory and it is in the app, in the preset
 *  bar, and in every gate in `tests/unit/presets.test.ts`.
 *
 *  `{ eager: true }` includes the documents in the module graph. Tests run
 *  `parseSong()` on every file; the build alone only validates JSON syntax.
 *  Nothing is fetched at runtime, so there
 *  is no loading state, no 404 path and no COEP interaction.
 *
 *  **Play order is the two-digit filename prefix.** `07-slow-orbit.json` plays
 *  seventh. Unprefixed files sort after numbered ones, alphabetically. The prefix
 *  is stripped from the id, so the id stays `slow-orbit` wherever a human reads it —
 *  preview filenames, gate failures, the chip's `data-song`.
 *
 *  The song is exported RAW (`unknown`). Parsing belongs to the caller, because the
 *  caller is the one that has to decide what to do with the diagnostics: the preset bar
 *  surfaces them, the gate asserts on them, and neither wants the other's policy baked
 *  in here.
 */

export interface PresetEntry {
  /** `slow-orbit` — the filename with its `NN-` prefix and `.json` removed. */
  readonly id: string
  /** Play order from the filename prefix; `Number.MAX_SAFE_INTEGER` when unprefixed. */
  readonly order: number
  /** `src/assets/songs/07-slow-orbit.json`, for diagnostics that name a file. */
  readonly file: string
  /** `meta.name` if the document has one, else the id. Read without parsing: the bar
   *  must be able to draw a chip for a song the validator would reject. */
  readonly title: string
  /** The parsed-JSON document, exactly as it sits on disk. */
  readonly song: unknown
}

const MODULES = import.meta.glob('./*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>

const PREFIXED = /^(\d{2})-(.+)$/

function entryOf(path: string, module: { default: unknown }): PresetEntry {
  const base = (path.split('/').pop() ?? path).replace(/\.json$/, '')
  const match = PREFIXED.exec(base)
  const id = match === null ? base : (match[2] as string)
  const order = match === null ? Number.MAX_SAFE_INTEGER : Number(match[1])
  const song = module.default
  const meta = (song as { meta?: { name?: unknown } } | null)?.meta
  const title = typeof meta?.name === 'string' && meta.name.length > 0 ? meta.name : id
  return { id, order, file: `src/assets/songs/${base}.json`, title, song }
}

/** Every registered song, in play order. Empty is a legal state — it is what the repo
 *  looks like before the first composer lands. */
export const PRESETS: readonly PresetEntry[] = Object.entries(MODULES)
  .map(([path, module]) => entryOf(path, module))
  .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id)))

export function presetById(id: string): PresetEntry | undefined {
  return PRESETS.find((p) => p.id === id)
}
