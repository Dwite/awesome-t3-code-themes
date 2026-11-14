#!/usr/bin/env node
// Copy a theme from this repository into T3 Code on this machine.
//   node tools/install.mjs koi-pond
// T3 Code picks the file up by itself. Then choose the theme in T3 Code (or ask the agent to switch to it).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const id = process.argv[2], root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = id && join(root, 'themes', id, 'theme.json');
if (!id || !existsSync(from)) { console.error(id ? `No theme "${id}" in themes/.` : 'Usage: node tools/install.mjs <theme id>'); process.exit(1); }
const folder = join(process.env.T3_HOME || join(homedir(), '.t3'), 'userdata', 'themes');
mkdirSync(folder, { recursive: true });
copyFileSync(from, join(folder, id + '.json'));
console.log(`Installed ${id} at ${join(folder, id + '.json')}`);
