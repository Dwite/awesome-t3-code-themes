// Opens the catalog page (index.html) in headless Chrome over a local server and checks that it shows the catalog.
//   node tools/test/catalog-page.mjs            SHOT=file.png saves a picture
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withChrome } from '../lib/chrome.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), catalog = JSON.parse(readFileSync(resolve(root, 'catalog.json'), 'utf8'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  try { const path = decodeURIComponent(req.url.split('?')[0]), file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path)); if (!file.startsWith(root)) throw 0;
    const body = readFileSync(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let failed = 0; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed++; };
try { await withChrome(async ({ goto, run, sleep, screenshot, errors }) => {
  await goto(`http://127.0.0.1:${server.address().port}/`, 1500);
  check(await run('document.querySelectorAll("#grid .card").length') === catalog.themes.length, `one card per theme (${catalog.themes.length})`);
  check(await run('document.querySelectorAll("#links .link").length') === catalog.elsewhere.length, `one link per entry elsewhere (${catalog.elsewhere.length})`);
  const pictures = catalog.themes.flatMap(t => [t.preview, t.previewAlt].filter(Boolean));
  check(await run(`Promise.all(${JSON.stringify(pictures)}.map(src => fetch(src).then(r => r.ok && r.headers.get('content-type') === 'image/png'))).then(all => all.every(Boolean))`), `every preview picture is served (${pictures.length})`);
  check(await run('document.querySelector("#grid .shot img").naturalWidth') > 0, 'the first card shows its picture');
  if (process.env.SHOT) writeFileSync(process.env.SHOT, await screenshot());
  await run('document.querySelector("#q").value = "zzzz no such theme"; document.querySelector("#q").dispatchEvent(new Event("input"))');
  check(await run('document.querySelectorAll("#grid .card").length') === 0 && await run('!document.querySelector("#empty").hidden'), 'a search with no match shows the empty note');
  await run('document.querySelector("#q").value = ""; document.querySelector("#q").dispatchEvent(new Event("input"))');
  const first = catalog.themes[0];
  await run('document.querySelector("#grid .card .btn.primary").click()'); await sleep(200);
  check(await run('document.querySelector("#install").open') && (await run('document.querySelector("#i-unix").textContent')).includes(`/${first.file} -o ~/.t3/userdata/themes/${first.id}.json`), 'Install shows the command for the theme');
  check((await run('document.querySelector("#i-file").getAttribute("download")')) === first.id + '.json', 'the download link names the file by the theme id');
  if (process.env.SHOT) writeFileSync(process.env.SHOT.replace(/\.png$/, '-install.png'), await screenshot());
  check(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
}, { width: 1280, height: 900, scale: 1 }); } finally { server.close(); }
console.log(failed ? `${failed} check(s) failed` : 'catalog page: all checks passed'); process.exit(failed ? 1 : 0);
