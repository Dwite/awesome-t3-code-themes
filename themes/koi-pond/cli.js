#!/usr/bin/env node
/* Koi Pond command line. Builds the T3 Code theme from settings and can install it.
 *
 *   node cli.js --install                       build from config.json and install into T3 Code on this machine
 *   node cli.js --out theme.json                build the theme file that this repository publishes
 *   node cli.js --set koiCount=8 --set rain=true --install
 *   node cli.js sync                            keep the installed theme's own settings, set the time of day from the clock, install
 *   node cli.js schedule | unschedule           macOS: follow the clock by itself (runs sync every 15 minutes) | stop that
 *   node cli.js --list                          show every setting
 *   node cli.js --studio                        write koi-pond-studio.html: the settings page as one file, to share
 */
const fs = require('fs'), path = require('path'), os = require('os');
const Pond = require('./pond.js');
const THEME = path.join(process.env.T3_HOME || path.join(os.homedir(), '.t3'), 'userdata', 'themes', 'koi-pond.json');
const args = process.argv.slice(2), has = f => args.includes(f), after = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

// The time-of-day job: macOS runs `node cli.js sync` every 15 minutes. `schedule --dry-run` prints the job and installs nothing.
const AGENT = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.koi-pond.sync.plist');
if (has('schedule') || has('unschedule')) {
  if (process.platform !== 'darwin') { console.error('schedule works on macOS only. On other systems, run "node cli.js sync" from your own scheduler.'); process.exit(1); }
  const { execFileSync } = require('child_process'), quiet = a => { try { execFileSync('launchctl', a, { stdio: 'ignore' }); } catch (e) {} };
  const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>com.koi-pond.sync</string>\n<key>ProgramArguments</key><array><string>${process.execPath}</string><string>${path.join(__dirname, 'cli.js')}</string><string>sync</string></array>\n<key>StartInterval</key><integer>900</integer>\n<key>RunAtLoad</key><true/>\n</dict></plist>\n`;
  if (has('--dry-run')) { console.log(AGENT + '\n' + plist); process.exit(0); }
  quiet(['unload', AGENT]);
  if (has('unschedule')) { if (fs.existsSync(AGENT)) fs.unlinkSync(AGENT); console.log('Removed the time-of-day job.'); process.exit(0); }
  fs.mkdirSync(path.dirname(AGENT), { recursive: true }); fs.writeFileSync(AGENT, plist); quiet(['load', AGENT]);
  console.log('The pond now follows the clock: macOS runs "node cli.js sync" every 15 minutes. Undo with: node cli.js unschedule'); process.exit(0);
}
if (has('--list')) {
  for (const s of Pond.SETTINGS) console.log(`${s.key.padEnd(20)} ${String(s.default).padEnd(8)} ${s.type === 'choice' ? s.options.join(' | ') : s.type === 'toggle' ? 'true | false' : `${s.min}..${s.max}${s.unit || ''}`}   ${s.group}: ${s.label}`);
  process.exit(0);
}
if (has('--studio')) {
  const page = fs.readFileSync(path.join(__dirname, 'studio.html'), 'utf8').replace('<script src="pond.js"></script>', () => '<script>' + fs.readFileSync(path.join(__dirname, 'pond.js'), 'utf8').replace(/<\/script/g, '<\\/script') + '</script>');
  fs.writeFileSync(path.join(__dirname, 'koi-pond-studio.html'), page); console.log('wrote koi-pond-studio.html', page.length, 'bytes'); process.exit(0);
}

let config = {};
const die = msg => { console.error(msg); process.exit(1); };
const sync = has('sync');
const file = after('--config') || path.join(__dirname, 'config.json');
if (sync) {
  if (!fs.existsSync(THEME)) die('No installed Koi Pond theme at ' + THEME);
  config = Pond.readConfig(JSON.parse(fs.readFileSync(THEME, 'utf8')));
  if (!config) die('The installed theme file holds no settings (it is from an older build). Run: node cli.js --install');
  Object.assign(config, Pond.timesFor(new Date().getHours()));
} else if (fs.existsSync(file)) config = JSON.parse(fs.readFileSync(file, 'utf8'));
if (has('--time') && after('--time') === 'auto') Object.assign(config, Pond.timesFor(new Date().getHours()));
args.forEach((a, i) => {
  if (a !== '--set') return;
  const pair = args[i + 1] || '', at = pair.indexOf('=');
  if (at < 1) die(`--set needs key=value, got "${pair}".`);
  const raw = pair.slice(at + 1); config[pair.slice(0, at)] = raw === 'true' ? true : raw === 'false' ? false : raw;
});
// a value the settings table refuses must stop the build; normalize() alone would quietly fall back to the default
for (const [k, v] of Object.entries(config)) {
  const s = Pond.SETTINGS.find(x => x.key === k);
  if (!s) die(`Unknown setting: ${k}. Run with --list.`);
  const ok = s.type === 'toggle' ? typeof v === 'boolean' : s.type === 'choice' ? s.options.includes(v) : v !== '' && Number.isFinite(Number(v)) && Number(v) >= s.min && Number(v) <= s.max;
  if (!ok) die(`Bad value for ${k}: "${v}". Allowed: ${s.type === 'toggle' ? 'true | false' : s.type === 'choice' ? s.options.join(' | ') : s.min + '..' + s.max}.`);
}
if (has('--out') && (!after('--out') || after('--out').startsWith('--'))) die('--out needs a file path.');

const r = Pond.build(config);
if (!r.fits) { console.error(`The theme is ${r.size} characters; T3 Code allows ${r.limit}. Lower the koi count or the plant cover.`); process.exit(1); }
if (r.trimmed.length) console.log('Left out to stay under the size limit: ' + r.trimmed.join(', '));
const json = JSON.stringify(r.theme);
if (has('--out')) fs.writeFileSync(after('--out'), json);
if (has('--install') || sync) { fs.mkdirSync(path.dirname(THEME), { recursive: true }); fs.writeFileSync(THEME, json); }
console.log(`Koi Pond: ${r.size} of ${r.limit} characters${has('--install') || sync ? ', installed at ' + THEME : ''}${sync ? ` (${r.config.lightTime} / ${r.config.darkTime})` : ''}`);
