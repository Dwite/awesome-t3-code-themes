#!/usr/bin/env node
// Check every theme in themes/ against the rules T3 Code enforces. T3 Code drops a bad theme file without a message,
// so this is the check to run before a pull request. No dependencies:  node tools/validate.mjs
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTheme, BUILT_IN, LIMITS } from './lib/rules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'themes');
let failed = 0, count = 0;
for (const id of readdirSync(dir).filter(n => statSync(join(dir, n)).isDirectory()).sort()) {
  const bad = [], folder = join(dir, id), file = join(folder, 'theme.json');
  count++;
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) bad.push('the folder name must be lower-case letters, digits and hyphens');
  if (BUILT_IN.has(id)) bad.push('this id belongs to a built-in theme');
  if (!existsSync(file)) bad.push('theme.json is missing');
  else {
    const raw = readFileSync(file);
    try { bad.push(...checkTheme(JSON.parse(raw.toString('utf8')), raw.length)); } catch (e) { bad.push('theme.json is not valid JSON: ' + e.message); }
  }
  if (!existsSync(join(folder, 'README.md'))) bad.push('README.md is missing');
  const preview = join(folder, 'preview.png');
  if (!existsSync(preview)) bad.push('preview.png is missing (make it with: node tools/preview.mjs ' + id + ')');
  else {
    const png = readFileSync(preview);
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') bad.push('preview.png is not a PNG file');
    if (png.length > LIMITS.preview) bad.push(`preview.png is ${png.length} bytes; keep it under ${LIMITS.preview}`);
  }
  const metaFile = join(folder, 'meta.json');
  if (!existsSync(metaFile)) bad.push('meta.json is missing (author, description, tags; see CONTRIBUTING.md)');
  else try {
    const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
    if (typeof meta.author !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(meta.author)) bad.push('meta.json: author must be a GitHub user name');
    if (typeof meta.description !== 'string' || meta.description.length < 20 || meta.description.length > 200) bad.push('meta.json: description must be 20 to 200 characters');
    if (meta.tags !== undefined && !(Array.isArray(meta.tags) && meta.tags.length <= 5 && meta.tags.every(t => typeof t === 'string' && /^[a-z0-9][a-z0-9-]{1,20}$/.test(t)))) bad.push('meta.json: tags must be at most 5 lower-case words, such as "animated"');
    for (const [label, href] of Object.entries(meta.links ?? {})) if (typeof href !== 'string' || !(/^https:\/\//.test(href) || existsSync(join(root, href)))) bad.push(`meta.json: link "${label}" must be an https address or a file in this repository`);
  } catch (e) { bad.push('meta.json is not valid JSON: ' + e.message); }
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${id}${bad.map(b => '\n       - ' + b).join('')}`);
  if (bad.length) failed++;
}
// links to themes in other repositories
try {
  const bad = [];
  for (const [i, e] of JSON.parse(readFileSync(join(root, 'elsewhere.json'), 'utf8')).entries()) {
    const where = `entry ${i + 1}${e && e.name ? ` (${e.name})` : ''}`;
    if (typeof e.name !== 'string' || !e.name.trim() || e.name.length > 40) bad.push(`${where}: name must be 1 to 40 characters`);
    if (e.repo !== undefined && !/^[\w.-]+\/[\w.-]+$/.test(e.repo)) bad.push(`${where}: repo must be owner/name`);
    if (e.url !== undefined && !/^https:\/\//.test(e.url)) bad.push(`${where}: url must start with https://`);
    if (e.repo === undefined && e.url === undefined) bad.push(`${where}: give repo or url`);
    if (!['theme', 'collection', 'gallery', 'tool'].includes(e.kind)) bad.push(`${where}: kind must be theme, collection, gallery or tool`);
    if (typeof e.description !== 'string' || e.description.length < 5 || e.description.length > 160) bad.push(`${where}: description must be 5 to 160 characters`);
  }
  console.log(`${bad.length ? 'FAIL' : 'ok  '} elsewhere.json${bad.map(b => '\n       - ' + b).join('')}`);
  if (bad.length) failed++;
} catch (e) { console.log('FAIL elsewhere.json\n       - not valid JSON: ' + e.message); failed++; }
console.log(failed ? `validate: ${failed} problem group(s)` : `validate: all ${count} themes passed`);
process.exit(failed ? 1 : 0);
