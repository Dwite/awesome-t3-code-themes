#!/usr/bin/env node
// Render a theme in a copy of the T3 Code chat area and save a picture. Also reports what T3 Code's CSS check would remove.
//
//   node tools/preview.mjs koi-pond                 writes themes/koi-pond/preview.png (dark mode)
//   node tools/preview.mjs koi-pond --light         writes themes/koi-pond/preview-light.png
//   node tools/preview.mjs path/to/theme.json --out shot.png --wait 5
//   node tools/preview.mjs koi-pond --check         no picture; fails when the CSS check would remove something
//
// Needs Chrome or Chromium. Set CHROME to its path if it is not found.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withChrome } from './lib/chrome.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), flag = f => args.includes(f), value = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const target = args.find(a => !a.startsWith('--') && a !== value('--out') && a !== value('--wait'));
if (!target) { console.error('Usage: node tools/preview.mjs <theme id | theme.json> [--light] [--wait seconds] [--out file.png] [--check]'); process.exit(2); }
const file = existsSync(target) && target.endsWith('.json') ? resolve(target) : join(root, 'themes', target, 'theme.json');
if (!existsSync(file)) { console.error('No theme file at ' + file); process.exit(2); }
const theme = JSON.parse(readFileSync(file, 'utf8')), light = flag('--light');
const out = value('--out') || join(dirname(file), light ? 'preview-light.png' : 'preview.png');

const removed = await withChrome(async page => {
  await page.goto(pathToFileURL(join(root, 'tools', 'mock.html')).href + (light ? '?light' : ''));
  const gone = await page.run(`applyTheme(${JSON.stringify(theme.css || '')})`);
  if (!flag('--check')) { await page.sleep(Number(value('--wait') || 3) * 1000); writeFileSync(out, await page.screenshot()); console.log('wrote ' + out); }
  return gone;
}, { width: 1280, height: 800, scale: 1 });
if (removed.length) { console.error(`T3 Code's CSS check would remove: ${[...new Set(removed)].join(', ')}`); process.exit(1); }
console.log('CSS check: nothing removed');
