// Start headless Chrome and drive one page over the DevTools protocol. No dependencies (Node 22 or later).
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PLACES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
export function findChrome() {
  const found = PLACES.find(p => p && existsSync(p));
  if (!found) throw new Error('Chrome not found. Set the CHROME environment variable to the path of Chrome or Chromium.');
  return found;
}

/** Runs fn with a page: { goto, run, screenshot, send, sleep, errors }. Chrome is closed afterwards, also on failure. */
export async function withChrome(fn, { width = 1500, height = 950, scale = 2 } = {}) {
  const port = 9400 + Math.floor(Math.random() * 400), profile = mkdtempSync(join(tmpdir(), 'chrome-check.'));
  const chrome = spawn(findChrome(), ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let socket, id = 0; const pending = new Map(), errors = [];
  try {
    for (let i = 0; i < 60 && !socket; i++) {
      try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); if (page) socket = new WebSocket(page.webSocketDebuggerUrl); } catch {}
      if (!socket) await sleep(200);
    }
    if (!socket) throw new Error('Chrome did not start.');
    await new Promise((res, rej) => { socket.onopen = res; socket.onerror = rej; });
    socket.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    };
    const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, m => res(m.result ?? m)); socket.send(JSON.stringify({ id: n, method, params })); });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    const run = async expression => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    return await fn({
      send, run, sleep, errors,
      goto: async (url, wait = 700) => { await send('Page.navigate', { url }); await sleep(wait); },
      screenshot: async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
    });
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill('SIGKILL'); await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}
