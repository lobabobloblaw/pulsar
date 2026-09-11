/** CLI for the OCTET port: `node tools/songs/octet/build.mjs <octet.json> <out.json>
 *  --song <module.mjs>`. Kept apart from convert.mjs because the song modules import that
 *  file: a CLI with a top-level await inside it would deadlock on the cycle. */
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { convert, loadOctet } from './convert.mjs'

const [input, output, flag, modulePath] = process.argv.slice(2)
if (!input || !output || flag !== '--song' || !modulePath) {
  console.error('usage: node tools/songs/octet/build.mjs <octet.json> <out.json> --song <module.mjs>')
  process.exit(2)
}
const song = await import(pathToFileURL(modulePath).href)
writeFileSync(output, convert(loadOctet(input), song))
console.log(`wrote ${output}`)
