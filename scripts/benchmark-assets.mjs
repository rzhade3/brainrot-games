import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const root = resolve('dist');
const manifestPath = join(root, '.vite/manifest.json');
if (!existsSync(manifestPath)) throw new Error('Run npm run build -- --manifest first.');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(root, join(dir, entry.name))]); }
const files = walk(root).filter(file => !file.startsWith('.vite/'));
const sizes = new Map(files.map(file => {
  const bytes = readFileSync(join(root, file));
  return [file, { raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length, brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }).length }];
}));
function sum(paths) {
  return [...new Set(paths)].reduce((total, path) => {
    const size = sizes.get(path); if (!size) throw new Error(`Missing built asset: ${path}`);
    for (const key of Object.keys(total)) total[key] += size[key];
    return total;
  }, { raw: 0, gzip: 0, brotli: 0 });
}
function resources(entries) {
  const assets = new Set(), visited = new Set();
  function scan(path) {
    if (!sizes.has(path) || assets.has(path)) return;
    assets.add(path);
    if (!/\.(html|css|js)$/.test(path)) return;
    const text = readFileSync(join(root, path), 'utf8');
    // Public media and Vite worker URLs are outside Rollup's import graph.
    for (const match of text.matchAll(/(?:["'`(])((?:\/|\.\.?\/)[\w./-]+\.(?:js|css|woff2|webp|png|svg|webmanifest))/g)) {
      const target = match[1].startsWith('/') ? match[1].slice(1) : join(dirname(path), match[1]);
      scan(target);
    }
    // Homepage previews are constructed from catalog metadata; include the
    // entire thumbnail set, even though lazy loading defers offscreen images.
    if (text.includes('/assets/arcade/')) files.filter(file => file.startsWith('assets/arcade/') && file.endsWith('.svg')).forEach(scan);
  }
  function visit(key) {
    if (visited.has(key)) return; visited.add(key);
    const entry = manifest[key];
    if (!entry) throw new Error(`Unknown manifest entry: ${key}`);
    scan(entry.file);
    (entry.css ?? []).forEach(scan);
    [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])].forEach(visit);
  }
  for (const entry of entries) { scan(entry); visit(entry); }
  return [...assets].sort();
}
const pages = Object.keys(manifest).filter(key => manifest[key].isEntry && key.endsWith('.html')).sort();
const entries = pages.map(page => { const assets = resources([page]); return { page, files: assets.length, bytes: sum(assets), assets }; });
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const precache = [...sw.matchAll(/\{url:"([^"]+)"/g)].map(match => match[1]);
if (!precache.length) throw new Error('Could not read the Workbox precache manifest; inspect sw.js format.');
const workerSupport = files.filter(file => file === 'sw.js' || /^workbox-.*\.js$/.test(file));
const offlineFiles = [...new Set([...precache, ...workerSupport])];
const duplicateGroups = new Map();
for (const file of files) {
  const key = readFileSync(join(root, file)).toString('base64');
  const group = duplicateGroups.get(key) ?? []; group.push(file); duplicateGroups.set(key, group);
}
const duplicates = [...duplicateGroups.values()].filter(group => group.length > 1).map(group => ({ files: group, removable: sum(group.slice(1)) }));
const report = {
  method: 'Production Vite dependency closure plus public media, worker URLs and declared icons. Includes all homepage previews and both dynamic-import branches. Cold bytes, not timing or measured HTTP traffic. Gzip level 9 / Brotli quality 6 estimates; actual hosting compression varies. PWA install precaches every listed asset in addition to service-worker support. Warm visits reuse cached assets.',
  entries,
  allPagesUnique: sum(entries.flatMap(entry => entry.assets)),
  precache: { manifestEntries: precache.length, files: new Set(precache).size, bytes: sum(precache) },
  offlinePack: { files: offlineFiles.length, bytes: sum(offlineFiles) },
  largest: files.map(file => ({ file, ...sizes.get(file) })).sort((a, b) => b.raw - a.raw).slice(0, 15),
  duplicates,
};
const kib = value => (value / 1024).toFixed(1);
console.table(entries.map(entry => ({ page: entry.page, files: entry.files, 'raw KiB': kib(entry.bytes.raw), 'gzip KiB': kib(entry.bytes.gzip), 'Brotli KiB': kib(entry.bytes.brotli) })));
console.log('Offline pack incl. service worker:', report.offlinePack);
console.table(report.largest.map(item => ({ file: item.file, 'raw KiB': kib(item.raw), 'gzip KiB': kib(item.gzip), 'Brotli KiB': kib(item.brotli) })));
console.log('Byte-identical duplicates:', duplicates);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
