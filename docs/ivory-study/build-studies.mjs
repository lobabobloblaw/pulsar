import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const dir = import.meta.dirname;
const source = resolve(dir, '../..'); // this repository
const songDir = resolve(source, 'src/assets/songs');
const songs = await Promise.all((await readdir(songDir)).filter(f => f.endsWith('.json')).sort().map(async f => JSON.parse(await readFile(resolve(songDir, f), 'utf8'))));
const template = await readFile(resolve(dir, 'study-template.html'), 'utf8');
for (const [id, name, letter, initial] of [['ivory','Ivory','A','live'], ['obsidian','Obsidian','B','tracker']]) {
  const html = template.replaceAll('INTERACTIVE STUDY', 'INTERACTIVE DESIGN PREVIEW').replaceAll('PULSAR / STUDY LETTER', 'PULSAR / DESIGN LETTER').replaceAll('STUDYNAME', name).replaceAll('STUDY', id).replaceAll('LETTER', letter).replaceAll('INITIALMODE', initial).replace('SONGDATA', JSON.stringify(songs).replaceAll('<', '\\u003c'));
  await writeFile(resolve(dir, `pulsar-${id}.html`), html);
  console.log(`${id}: ${Buffer.byteLength(html)} bytes`);
}
