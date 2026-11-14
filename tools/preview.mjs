#!/usr/bin/env node
// Render a theme in a copy of the T3 Code chat area and save a picture. Also reports what T3 Code's CSS check would remove.
//
//   node tools/preview.mjs koi-pond                 writes themes/koi-pond/preview.png, in the theme's own mode
//   node tools/preview.mjs koi-pond --mode light    the other mode: writes themes/koi-pond/preview-light.png (or preview-dark.png)
//   node tools/preview.mjs --all                    every theme, every mode it has
//   node tools/preview.mjs path/to/theme.json --out shot.png --wait 5
//   node tools/preview.mjs koi-pond --check         no picture; fails when the CSS check would remove something
//
// Needs Chrome or Chromium. Set CHROME to its path if it is not found.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withChrome } from './lib/chrome.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), flag = f => args.includes(f), value = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const target = args.find(a => !a.startsWith('--') && ![value('--out'), value('--wait'), value('--mode')].includes(a));
if (!target && !flag('--all')) { console.error('Usage: node tools/preview.mjs <theme id | theme.json | --all> [--mode light|dark] [--wait seconds] [--out file.png] [--check]'); process.exit(2); }
const fileOf = t => existsSync(t) && t.endsWith('.json') ? resolve(t) : join(root, 'themes', t, 'theme.json');
// one job per picture: the theme's own mode, and with --all also its other mode
const jobs = [];
for (const t of flag('--all') ? readdirSync(join(root, 'themes')).filter(n => existsSync(join(root, 'themes', n, 'theme.json'))).sort() : [target]) {
  const file = fileOf(t);
  if (!existsSync(file)) { console.error('No theme file at ' + file); process.exit(2); }
  const theme = JSON.parse(readFileSync(file, 'utf8')), other = theme.appearance === 'dark' ? 'light' : 'dark';
  const modes = flag('--all') ? [theme.appearance, ...(theme.variants?.[other] ? [other] : [])] : [value('--mode') || (flag('--light') ? 'light' : theme.appearance)];
  for (const mode of modes) jobs.push({ theme, mode, out: value('--out') || join(dirname(file), mode === theme.appearance ? 'preview.png' : `preview-${mode}.png`), name: t });
}

const removed = await withChrome(async page => {
  const gone = [];
  for (const { theme, mode, out, name } of jobs) {
    await page.goto(pathToFileURL(join(root, 'tools', 'mock.html')).href + (mode === 'light' ? '?light' : ''), 300);
    await page.run(`applyColors(${JSON.stringify(theme)}, ${JSON.stringify(mode)})`);
    const lost = await page.run(`applyTheme(${JSON.stringify(theme.css || '')})`);
    if (lost.length) gone.push(`${name}: ${[...new Set(lost)].join(', ')}`);
    // a theme with CSS may animate: wait so the picture shows it in motion
    if (!flag('--check')) { await page.sleep(Number(value('--wait') ?? (theme.css ? 3 : .2)) * 1000); writeFileSync(out, await page.screenshot()); console.log('wrote ' + out); }
  }
  return gone;
}, { width: 1280, height: 800, scale: 1 });
if (removed.length) { console.error(`T3 Code's CSS check would remove: ${removed.join('; ')}`); process.exit(1); }
console.log('CSS check: nothing removed');
