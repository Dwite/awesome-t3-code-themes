#!/usr/bin/env node
// Build the catalog from the theme folders: catalog.json (read by the catalog page, index.html) and the two lists in README.md.
//   node tools/catalog.mjs           write both
//   node tools/catalog.mjs --check   write nothing; fail when either is out of date
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), read = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
const ids = readdirSync(join(root, 'themes')).filter(n => statSync(join(root, 'themes', n)).isDirectory()).sort();

const themes = ids.map(id => {
  const theme = read('themes', id, 'theme.json'), meta = read('themes', id, 'meta.json'), other = theme.appearance === 'dark' ? 'light' : 'dark';
  const colours = map => ({ canvas: map.canvas, accent: map.accent });
  const modes = { [theme.appearance]: colours({ canvas: theme.canvas ?? theme.colors?.canvas, accent: theme.accent ?? theme.colors?.accent }) };
  if (theme.variants?.[other]) modes[other] = colours(theme.variants[other]);
  return {
    id, name: theme.name, author: meta.author, description: meta.description, tags: meta.tags ?? [], modes,
    preview: `themes/${id}/preview.png`, ...(existsSync(join(root, 'themes', id, `preview-${other}.png`)) ? { previewAlt: `themes/${id}/preview-${other}.png` } : {}),
    ...(meta.source ? { source: { repo: meta.source.repo, license: meta.source.license } } : {}),
    file: `themes/${id}/theme.json`, folder: `themes/${id}`, links: meta.links ?? {},
  };
});
const elsewhere = read('elsewhere.json').map(e => ({ ...e, url: e.url ?? `https://github.com/${e.repo}` }));
const catalog = JSON.stringify({ themes, elsewhere }, null, 2) + '\n';

// README lists, between markers
const table = '| Theme | By | Modes | What it is |\n|---|---|---|---|\n' + themes.map(t =>
  `| [${t.name}](${t.folder}) | ${t.author}${t.source ? `, from [${t.source.repo}](https://github.com/${t.source.repo}) (${t.source.license})` : ''} | ${Object.keys(t.modes).join(' + ')} | ${t.description}${Object.entries(t.links).map(([label, href]) => ` [${label}](${/^https:/.test(href) ? href : 'https://dwite.github.io/awesome-t3-code-themes/' + href}).`).join('')} |`).join('\n');
const list = elsewhere.map(e => `- [${e.name}](${e.url})${e.repo && !e.url.includes(e.repo) ? ` ([${e.repo}](https://github.com/${e.repo}))` : ''}: ${e.description}`).join('\n');
function fill(text, name, body) {
  const open = `<!-- catalog:${name} -->`, close = `<!-- /catalog:${name} -->`, a = text.indexOf(open), b = text.indexOf(close);
  if (a < 0 || b < a) throw new Error(`README.md has no ${open} ... ${close} markers`);
  return text.slice(0, a + open.length) + '\n' + body + '\n' + text.slice(b);
}
const readmeNow = readFileSync(join(root, 'README.md'), 'utf8'), readme = fill(fill(readmeNow, 'themes', table), 'elsewhere', list);
const catalogNow = existsSync(join(root, 'catalog.json')) ? readFileSync(join(root, 'catalog.json'), 'utf8') : '';

if (process.argv.includes('--check')) {
  const stale = [catalogNow !== catalog && 'catalog.json', readmeNow !== readme && 'README.md'].filter(Boolean);
  if (stale.length) { console.error(`Out of date: ${stale.join(', ')}. Run: node tools/catalog.mjs`); process.exit(1); }
  console.log(`catalog: up to date (${themes.length} themes, ${elsewhere.length} links)`);
} else {
  writeFileSync(join(root, 'catalog.json'), catalog); writeFileSync(join(root, 'README.md'), readme);
  console.log(`catalog: wrote catalog.json and README.md (${themes.length} themes, ${elsewhere.length} links)`);
}
