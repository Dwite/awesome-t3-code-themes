#!/usr/bin/env node
// Check every theme in themes/ against the rules T3 Code enforces. T3 Code drops a bad theme file without a message,
// so this is the check to run before a pull request. No dependencies:  node tools/validate.mjs
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTheme, BUILT_IN, LIMITS } from './lib/rules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'themes'), readme = readFileSync(join(root, 'README.md'), 'utf8');
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
  if (!readme.includes(`themes/${id}`)) bad.push('the top README does not link to themes/' + id);
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${id}${bad.map(b => '\n       - ' + b).join('')}`);
  if (bad.length) failed++;
}
console.log(failed ? `${failed} of ${count} themes failed` : `validate: all ${count} themes passed`);
process.exit(failed ? 1 : 0);
