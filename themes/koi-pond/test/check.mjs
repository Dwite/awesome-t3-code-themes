// The gate for Koi Pond: every mix of settings must build a theme that T3 Code accepts.
//   node themes/koi-pond/test/check.mjs      (needs Chrome for the CSS check; set CHROME if it is not found)
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withChrome } from '../../../tools/lib/chrome.mjs';
import { checkTheme } from '../../../tools/lib/rules.mjs';

const here = dirname(fileURLToPath(import.meta.url)), Pond = createRequire(import.meta.url)('../pond.js');
const MIXES = [
  {},
  { scene: 'lagoon', darkTime: 'deep', lightTime: 'dawn' },
  { scene: 'grove', darkTime: 'dusk', lightTime: 'golden', plantCover: 100 },
  { scene: 'maple', rain: true, goose: true, ball: true, feeding: true },
  { koiCount: 14, mood: 'playful' },
  { koiCount: 14, plantCover: 100, scene: 'grove', rain: true, goose: true, ball: true, feeding: true },
  { koiCount: 0, plantCover: 0, wind: false, bedLight: false, clouds: false, fireflies: false },
  { pixel: 0, fps: 30, strength: 100, windDirection: 200, waveShort: 40, waveLong: 80, crest: 30, spread: 100, gustSize: 520, gustSpeed: 120, calm: 0 },
  { pixel: 8, fps: 8, koiCount: 1, calm: 90, windStrength: 100, ball: true, feedX: 0, feedY: 100 },
];

function problems(r) {
  const bad = checkTheme(r.theme, Buffer.byteLength(JSON.stringify(r.theme)));
  if (!r.fits) bad.push('over the size limit even after leaving parts out');
  if (JSON.stringify(Pond.readConfig(r.theme)) !== JSON.stringify(r.config)) bad.push('the settings do not survive the round trip through the file');
  // every time in the image must be a whole number of ticks, or animations drift apart and the image repaints more often
  const off = (r.css.match(/-?[\d.]+s(?=[;,)}' ])/g) || []).filter(t => { const x = parseFloat(t) * r.used.fps; return Math.abs(x - Math.round(x)) > 1e-4; });
  if (off.length) bad.push('times off the tick grid: ' + [...new Set(off)].slice(0, 4).join(' '));
  const paths = (r.css.match(/ d='[^']*'/g) || []).filter(d => /-(?![\d.])/.test(d));
  if (paths.length) bad.push(paths.length + ' path(s) with a broken number');
  return bad;
}

let failed = 0;
// every setting must be in the stamp order, and a file from the first published version (33 values) must still open
const stampKeys = Pond.build({}).css.slice(0, 400).match(/^\/\*koi-pond 1 ([^*]*)\*\//)[1].split(',').length;
if (stampKeys !== Pond.SETTINGS.length) { failed++; console.log(`FAIL the settings stamp holds ${stampKeys} values for ${Pond.SETTINGS.length} settings: add the new setting at the end of STAMP_ORDER`); }
const old = Pond.readConfig('/*koi-pond 1 lagoon,7,40,9,calm,1,0,75,30,0,0,110,1,55,12,40,15,70,14,20,260,45,60,1,60,day,night,0,1,1,5,15,85*/x');
if (!old || old.scene !== 'lagoon' || old.koiCount !== 9 || old.strength !== 85 || old.scrim !== Pond.defaults().scrim) { failed++; console.log('FAIL a theme file from the first published version no longer opens with its settings'); }
const wrong = [[20, 0, '20'], [-0.4, 0, '0'], [100, 2, '100'], [0.5, 2, '.5'], [-0.25, 2, '-.25'], [12.30, 2, '12.3']].filter(([v, nd, want]) => Pond.num(v, nd) !== want);
if (wrong.length) { failed++; console.log('FAIL num() is wrong for ' + wrong.map(w => w[0]).join(', ')); }

await withChrome(async page => {
  await page.goto(pathToFileURL(resolve(here, '../../../tools/mock.html')).href);
  for (const mix of MIXES) {
    const r = Pond.build(mix), bad = problems(r);
    const removed = await page.run(`applyTheme(${JSON.stringify(r.css)})`);
    if (removed.length) bad.push("T3 Code's CSS check would remove: " + [...new Set(removed)].join(', '));
    if (bad.length) failed++;
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${JSON.stringify(mix)} -> ${r.size} characters${r.trimmed.length ? ', left out: ' + r.trimmed.join('; ') : ''}${bad.map(b => '\n       - ' + b).join('')}`);
  }
}, { width: 900, height: 600, scale: 1 });
console.log(failed ? `check: ${failed} failed` : 'check: all passed');
process.exit(failed ? 1 : 0);
