#!/usr/bin/env node
// Bring a theme from another repository into themes/<id>/, with its credit. Only for work whose license allows it.
//
//   node tools/import.mjs --file path/to/theme.json --id dracula --author dracula --repo dracula/t3code \
//        --commit 9094377 --path Dracula.json --license MIT --description "The Dracula dark theme." [--tags a,b] [--converted "how"]
//
// The file must be a T3 Code theme (version, name, appearance, colors). Gallery-only fields are dropped.
// The license text of the source must be in third-party/<owner>-<repo>/LICENSE first.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTheme } from './lib/rules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const arg = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const need = name => { const v = arg(name); if (!v) { console.error(`--${name} is missing. See the top of tools/import.mjs.`); process.exit(2); } return v; };
const [file, id, author, repo, commit, path, license, description] = ['file', 'id', 'author', 'repo', 'commit', 'path', 'license', 'description'].map(need);
const slug = repo.replace('/', '-'), notice = join(root, 'third-party', slug, 'LICENSE');
if (!existsSync(notice)) { console.error(`Put the source's license text at third-party/${slug}/LICENSE first.`); process.exit(1); }

const src = JSON.parse(readFileSync(file, 'utf8'));
const theme = { version: 1, name: src.name, appearance: src.appearance, ...(src.canvas ? { canvas: src.canvas } : {}), ...(src.accent ? { accent: src.accent } : {}),
  colors: src.colors, ...(src.variants ? { variants: src.variants } : {}), ...(src.css ? { css: src.css } : {}) };
const text = JSON.stringify(theme, null, 2) + '\n', bad = checkTheme(theme, Buffer.byteLength(text));
if (bad.length) { console.error(`${id}: T3 Code would refuse this theme:\n  - ${bad.join('\n  - ')}`); process.exit(1); }

const folder = join(root, 'themes', id), converted = arg('converted'), tags = (arg('tags') || '').split(',').filter(Boolean);
mkdirSync(folder, { recursive: true });
writeFileSync(join(folder, 'theme.json'), text);
writeFileSync(join(folder, 'meta.json'), JSON.stringify({ author, description, ...(tags.length ? { tags } : {}), source: { repo, commit, path, license, ...(converted ? { converted } : {}) } }, null, 2) + '\n');
const other = theme.appearance === 'dark' ? 'light' : 'dark', hasOther = !!theme.variants?.[other];
writeFileSync(join(folder, 'README.md'), `# ${theme.name}

${description}

![${theme.name}](preview.png)
${hasOther ? `\n![${theme.name}, ${other} mode](preview-${other}.png)\n` : ''}
## Credit

By [${author}](https://github.com/${author}). Imported from [${repo}](https://github.com/${repo}) at commit \`${commit.slice(0, 10)}\`, file \`${path}\`, under the ${license} license. The license text is in [third-party/${slug}](../../third-party/${slug}).

${converted ? `Changed here: ${converted}` : 'Changed here: the gallery-only fields (id, author, description, collection) moved to `meta.json`. The colours are as the author wrote them.'}

## Install

\`node tools/install.mjs ${id}\` from the repository root, or copy \`theme.json\` to \`~/.t3/userdata/themes/${id}.json\`. Then choose "${theme.name}" in T3 Code.
`);
console.log(`imported ${id} (${theme.name}, ${theme.appearance}${hasOther ? ' + ' + other : ''}) from ${repo}`);
