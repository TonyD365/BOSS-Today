/**
 * Writes public/designer/icons.json for the site designer's icon picker:
 * every Tabler outline icon (MIT licence) as [name, search words, paths],
 * where a filled path is [d, 1]. Run before `next build`.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const dir = path.join(process.cwd(), 'node_modules/@tabler/icons')
const nodes = JSON.parse(await fs.readFile(path.join(dir, 'tabler-nodes-outline.json'), 'utf8'))
const info = JSON.parse(await fs.readFile(path.join(dir, 'icons.json'), 'utf8'))
const icons = Object.entries(nodes).map(([name, parts]) => [
  name,
  [info[name]?.category ?? '', ...(info[name]?.tags ?? [])].join(' ').toLowerCase(),
  parts
    .filter(([tag, attrs]) => tag === 'path' && attrs.d)
    .map(([, attrs]) => (attrs.fill === 'currentColor' ? [attrs.d, 1] : attrs.d)),
])
const out = path.join(process.cwd(), 'public/designer/icons.json')
await fs.mkdir(path.dirname(out), { recursive: true })
await fs.writeFile(out, JSON.stringify(icons))
console.log(`Wrote ${icons.length} icons to public/designer/icons.json`)
