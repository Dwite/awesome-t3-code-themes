// Opens studio.html in headless Chrome, changes settings through the page's own controls, and checks the theme follows.
import { writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withChrome } from '../../../tools/lib/chrome.mjs';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url)), page = process.argv[2] || resolve(here, '../studio.html');
// The save test needs a real folder handle. Chrome gives one (its private file store) only to pages loaded over http, so serve the folder for the length of the test.
const server = createServer((req, res) => { try { const f = resolve(dirname(page), '.' + decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(dirname(page))) throw 0; const body = readFileSync(f); res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(body); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/${page.split('/').pop()}`;
let failed = 0; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed++; };
try { await withChrome(async ({ goto, run, sleep, screenshot, send, errors }) => {
  await goto(url, 900);
  await run('localStorage.clear()'); await send('Page.reload'); await sleep(900);
  const n = await run('KoiPond.SETTINGS.length'), made = await run('document.querySelectorAll("#panels .item").length');
  check(n === made, `one control per setting (${made} of ${n})`);
  const size0 = await run('__studio.result.size');
  check(size0 > 5000 && size0 <= 20000, `default theme builds and fits (${size0} characters)`);
  await run('document.querySelector("#c-koiCount").value = 12; document.querySelector("#c-koiCount").dispatchEvent(new Event("input"))');
  check(await run('__studio.config.koiCount') === 12 && await run('__studio.result.size') > size0, 'the koi slider changes the theme');
  await run('[...document.querySelectorAll(".seg button")].find(b => b.textContent === "Blue lagoon").click()');
  check(await run('__studio.config.scene') === 'lagoon', 'the scene buttons change the scene');
  await run('document.querySelector("#c-rain").click()');
  check(await run('__studio.config.rain') === true && await run('__studio.result.css.includes("rr")'), 'the rain switch adds rain');
  const seed = await run('__studio.config.plantSeed'); await run('document.querySelector("#c-plantSeed").click()');
  check(await run('__studio.config.plantSeed') !== seed, 'Shuffle changes the plant layout');
  check(await run('KoiPond.readConfig(__studio.result.theme).koiCount') === 12, 'the theme file carries its settings');
  check(await run('getComputedStyle(document.querySelector("[data-workspace-area]"), "::before").backgroundImage.startsWith("url(")'), 'the preview shows the pond');
  await run('document.querySelector("[data-mode=light]").click()');
  check(await run('getComputedStyle(document.querySelector("[data-workspace-area]"), "::before").colorScheme') === 'light', 'Light mode switches the pond to its light colours');
  await sleep(500);
  if (process.env.SHOT) writeFileSync(process.env.SHOT, await screenshot());
  await run('document.querySelector("#reset").click()');
  check(await run('JSON.stringify(__studio.config) === JSON.stringify(KoiPond.defaults())'), 'Reset restores the defaults');
  check(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
}, { scale: 1 }); } finally { server.close(); }
console.log(failed ? `${failed} check(s) failed` : 'studio: all checks passed'); process.exit(failed ? 1 : 0);
