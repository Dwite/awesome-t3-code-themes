/* Koi Pond: theme generator for T3 Code. One file; runs in Node (require) and in a browser (window.KoiPond).
 *
 * A T3 Code theme is CSS only, so the pond is one animated SVG image behind the chat:
 * - Each koi is a chain of body parts. Every part rides the same motion path, each a little later than the part
 *   in front of it, so the body bends through every turn. A second animation swings the parts sideways, more
 *   toward the tail.
 * - Only standard properties are animated (offset-distance, transform, rotate). Animated custom properties force a
 *   full style pass for every part on every tick; measured in the app that cost 61% of one core.
 * - All timing uses steps() on one tick grid (fps), so the image repaints fps times per second and no more.
 * - The art is smooth vector art. One SVG filter on the layer turns it into pixel art on a fixed grid.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KoiPond = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIMIT = 20000; // T3 Code refuses theme CSS longer than this

  // ---------- settings: one table drives defaults, checks, the command line and the settings page ----------
  const SETTINGS = [
    { key: 'scene', group: 'Scenes', label: 'Scene', type: 'choice', options: ['lotus', 'lagoon', 'grove', 'maple'], names: { lotus: 'Lotus pond', lagoon: 'Blue lagoon', grove: 'Lily grove', maple: 'Autumn maple' }, default: 'lotus',
      hints: { lotus: 'Lily pads, lotus flowers and duckweed.', lagoon: 'Giant ribbed lilies in clear blue water.', grove: 'Many pads and round raised leaves over sand.', maple: 'Turning pads, floating maple leaves, stones.' } },
    { key: 'plantSeed', group: 'Plants', label: 'Layout', type: 'seed', min: 1, max: 9999, step: 1, default: 1, hint: 'Shuffle moves the plants.' },
    { key: 'plantCover', group: 'Plants', label: 'Plant cover', type: 'range', min: 0, max: 100, step: 5, unit: '%', default: 40 },
    { key: 'koiCount', group: 'Koi & visitors', label: 'Number of koi', type: 'range', min: 0, max: 14, step: 1, default: 6, hint: 'Each koi costs CPU.' },
    { key: 'mood', group: 'Koi & visitors', label: 'Mood', type: 'choice', options: ['calm', 'playful'], names: { calm: 'Calm', playful: 'Playful' }, default: 'calm', hint: 'Playful koi swim faster and beat the tail harder.' },
    { key: 'graze', group: 'Koi & visitors', label: 'Graze on duckweed', type: 'toggle', default: true, hint: 'A small koi swims between two duckweed patches and nibbles there. Needs 5 koi.' },
    { key: 'feeding', group: 'Koi & visitors', label: 'Visit your feeding spot', type: 'toggle', default: false, hint: 'Small koi circle the spot you place, with ripples. Needs 6 koi.' },
    { key: 'feedX', group: 'Koi & visitors', label: 'Feeding spot, left to right', type: 'range', min: 0, max: 100, step: 5, unit: '%', default: 75 },
    { key: 'feedY', group: 'Koi & visitors', label: 'Feeding spot, top to bottom', type: 'range', min: 0, max: 100, step: 5, unit: '%', default: 30 },
    { key: 'ball', group: 'Koi & visitors', label: 'Ball', type: 'toggle', default: false, hint: 'A koi pushes a striped ball round the pond. Needs 2 koi; with fewer the ball drifts.' },
    { key: 'goose', group: 'Koi & visitors', label: 'Goose', type: 'toggle', default: false, hint: 'Switch on to invite the goose. It starts across the pond when the theme loads.' },
    { key: 'gooseEvery', group: 'Koi & visitors', label: 'Goose comes back every', type: 'range', min: 40, max: 300, step: 10, unit: 's', default: 110 },
    { key: 'wind', group: 'Waves', label: 'Wind waves', type: 'toggle', default: true },
    { key: 'windStrength', group: 'Waves', label: 'Strength', type: 'range', min: 0, max: 100, step: 5, unit: '%', default: 55 },
    { key: 'waveShort', group: 'Waves', label: 'Shortest wave', type: 'range', min: 8, max: 40, step: 2, unit: 'px', default: 12 },
    { key: 'waveLong', group: 'Waves', label: 'Longest wave', type: 'range', min: 12, max: 80, step: 2, unit: 'px', default: 40 },
    { key: 'crest', group: 'Waves', label: 'Crest sharpness', type: 'range', min: 5, max: 30, step: 1, default: 15, hint: '15 is a soft arc; 30 is a steep one.' },
    { key: 'spread', group: 'Waves', label: 'Spread', type: 'range', min: 0, max: 100, step: 5, unit: '%', default: 70, hint: 'How far single waves turn away from the wind.' },
    { key: 'waveSpeed', group: 'Waves', label: 'Speed', type: 'range', min: 4, max: 40, step: 2, unit: 'px/s', default: 14 },
    { key: 'windDirection', group: 'Waves', label: 'Direction', type: 'range', min: 0, max: 355, step: 5, unit: '°', default: 20 },
    { key: 'gustSize', group: 'Waves', label: 'Gust size', type: 'range', min: 120, max: 520, step: 20, unit: 'px', default: 260 },
    { key: 'gustSpeed', group: 'Waves', label: 'Gust speed', type: 'range', min: 10, max: 120, step: 5, unit: 'px/s', default: 45, hint: 'How fast a patch of waves crosses the pond.' },
    { key: 'calm', group: 'Waves', label: 'Calm between gusts', type: 'range', min: 0, max: 90, step: 5, unit: '%', default: 60 },
    { key: 'bedLight', group: 'Waves', label: 'Light net on the bed', type: 'toggle', default: true, hint: 'Two nets of light drift over each other.' },
    { key: 'bedLightBrightness', group: 'Waves', label: 'Light net brightness', type: 'range', min: 10, max: 100, step: 5, unit: '%', default: 60 },
    { key: 'lightTime', group: 'Time & weather', label: 'Time of day in light mode', type: 'choice', options: ['dawn', 'day', 'golden'], names: { dawn: 'Dawn', day: 'Day', golden: 'Golden' }, default: 'day' },
    { key: 'darkTime', group: 'Time & weather', label: 'Time of day in dark mode', type: 'choice', options: ['dusk', 'night', 'deep'], names: { dusk: 'Dusk', night: 'Night', deep: 'Deep clear' }, default: 'night', hint: 'The app picks light or dark; the pond follows.' },
    { key: 'rain', group: 'Time & weather', label: 'Rain', type: 'toggle', default: false },
    { key: 'fireflies', group: 'Time & weather', label: 'Fireflies', type: 'toggle', default: true, hint: 'Dark mode only.' },
    { key: 'clouds', group: 'Time & weather', label: 'Cloud shadows', type: 'toggle', default: true },
    { key: 'pixel', group: 'Display', label: 'Pixel size', type: 'range', min: 0, max: 8, step: 1, unit: 'px', default: 5, hint: '0 turns the pixel look off.' },
    { key: 'fps', group: 'Display', label: 'Motion steps per second', type: 'range', min: 8, max: 30, step: 1, default: 15 },
    { key: 'strength', group: 'Display', label: 'Pond strength behind the chat', type: 'range', min: 30, max: 100, step: 5, unit: '%', default: 85 },
  ];
  const defaults = () => Object.fromEntries(SETTINGS.map(s => [s.key, s.default]));
  function normalize(config) {
    const out = defaults();
    for (const s of SETTINGS) {
      let v = config && config[s.key];
      if (v === undefined || v === null) continue;
      if (s.type === 'range' || s.type === 'seed') { v = Number(v); if (!Number.isFinite(v)) continue; v = Math.min(s.max, Math.max(s.min, Math.round(v / s.step) * s.step)); }
      else if (s.type === 'choice') { if (!s.options.includes(v)) continue; }
      else if (s.type === 'toggle') v = !!v;
      out[s.key] = v;
    }
    return out;
  }

  // ---------- small helpers ----------
  const TAU = Math.PI * 2;
  function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rgba = (h, o) => `rgba(${rgb(h).join(',')},${num(o)})`;
  /** Keyframes on the tick grid: frames = [[tick, declarations], ...]. Each interval steps once per tick, so every change lands on a tick. */
  function kf(name, frames) {
    const total = frames[frames.length - 1][0];
    return `@keyframes ${name}{` + frames.map(([t, decl], i) => { const dt = i + 1 < frames.length ? frames[i + 1][0] - t : 0; return `${num(100 * t / total, 3)}%{${decl}${dt > 0 ? `;animation-timing-function:steps(${dt})` : ''}}`; }).join('') + '}';
  }
  /** Seconds for a whole number of ticks. Seven decimals: with fewer, 1/15 s and 1/30 s round, and animations drift off the shared grid within minutes. */
  const secs = (ticks, fps) => num(ticks / fps, 7) + 's';
  /** A number as short text: at most nd decimals, no trailing zeros after the point, no leading zero. */
  function num(v, nd = 2) {
    let s = (+v).toFixed(nd);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0' || s === '') s = '0';
    return s.replace(/^(-?)0\./, '$1.');
  }

  // ---------- swim paths: closed smooth loops, pond centre = 0,0 ----------
  function loopPath(base, seed, wobble, js) {
    let best = null;
    for (let tries = 0; tries < 40; tries++) {
      const r = rng(seed + tries * 101);
      const H = js.map(j => [j, (r() * 2 - 1) * wobble / j, r() * TAU, (r() * 2 - 1) * wobble / j, r() * TAU]);
      const P = th => { let [x, y] = base(th); for (const [j, ax, px, ay, py] of H) { x += ax * Math.cos(j * th + px); y += ay * Math.sin(j * th + py); } return [x, y]; };
      const M = 22, pts = []; for (let i = 0; i < M; i++) { const [x, y] = P(TAU * i / M); pts.push([Math.round(x), Math.round(y)]); }
      const at = i => pts[(i + M) % M];
      let d = `M${pts[0][0]} ${pts[0][1]}`; const segs = [];
      for (let i = 0; i < M; i++) {
        const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        segs.push([p1, c1, c2, p2]);
        d += (i === 0 ? `C${Math.round(c1[0])} ${Math.round(c1[1])} ` : 'S') + `${Math.round(c2[0])} ${Math.round(c2[1])} ${p2[0]} ${p2[1]}`;
      }
      d = d.replace(/ -/g, '-') + 'z';
      // length and tightest turn, from the same curve the browser draws
      let L = 0, rmin = 1e9, prev = null, prev2 = null;
      for (const [a, b, c, e] of segs) for (let s = 0; s < 24; s++) {
        const t = s / 24, u = 1 - t;
        const q = [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1]];
        if (prev) L += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
        if (prev2) { const cr = Math.abs((prev[0] - prev2[0]) * (q[1] - prev2[1]) - (prev[1] - prev2[1]) * (q[0] - prev2[0])); if (cr > 1e-9) rmin = Math.min(rmin, Math.hypot(prev[0] - prev2[0], prev[1] - prev2[1]) * Math.hypot(q[0] - prev[0], q[1] - prev[1]) * Math.hypot(q[0] - prev2[0], q[1] - prev2[1]) / (2 * cr)); }
        prev2 = prev; prev = q;
      }
      const cand = { d, L, rmin };
      if (!best || cand.rmin > best.rmin) best = cand;
      if (rmin >= 120) break;
    }
    return best;
  }
  const GRAZE = [-330, 170], WEED = [[GRAZE[0] - 106, GRAZE[1]], [GRAZE[0] + 106, GRAZE[1]]]; // pond centre = 0,0; the two duckweed patches
  const feedAt = c => [Math.round((c.feedX - 50) * 12), Math.round((c.feedY - 50) * 6.8)];
  const PATHS = {
    a: () => loopPath(th => [640 * Math.cos(th), 360 * Math.sin(th)], 11, 220, [2, 3, 4]),          // wide loop round the pond
    b: () => loopPath(th => [520 * Math.sin(th), 300 * Math.sin(2 * th)], 23, 150, [3, 4]),          // figure of eight
    c: () => loopPath(th => [380 * Math.cos(th) + 120, 250 * Math.sin(th) - 40], 37, 160, [2, 3]),   // inner loop
    g: () => loopPath(th => [GRAZE[0] + 190 * Math.sin(th), GRAZE[1] + 78 * Math.sin(2 * th)], 5, 0, []),   // figure of eight round the two duckweed patches
    f: c => { const [x, y] = feedAt(c); return loopPath(th => [x + 80 * Math.cos(th), y + 70 * Math.sin(th)], 9, 24, [2]); }, // round the feeding spot
  };

  // ---------- koi ----------
  // Body half widths from head to tail root (px at size 1), sampled along the body. A koi has few parts on purpose:
  // every animated part costs CPU on every frame (measured in the app: about 1.3% of one core per 13-part koi).
  const HW = [11, 17, 20, 20, 19, 17, 14, 11, 8, 5], BODY = 117;
  const hwAt = t => { const x = t * (HW.length - 1), i = Math.min(HW.length - 2, Math.floor(x)); return HW[i] + (HW[i + 1] - HW[i]) * (x - i); };
  function koiTemplate(id, s, nb, detail) {
    const f = v => num(v * s, 1), gap = BODY / (nb - 1);
    const swing = k => Math.pow(k / nb, 1.7);            // sideways swing of part k as a share of the tail's swing
    const part = (k, inner, cls) => `<g class='${cls || (swing(k) * 20 * s < 1.5 ? 'h' : 's')}' style='--k:${k};font-size:${num(swing(k), 3)}em'>${inner}</g>`;
    const fin = side => `<path class='e' d='M${f(14)} ${f(14 * side)}Q${f(6)} ${f(34 * side)} ${f(-14)} ${f(38 * side)}Q${f(-8)} ${f(22 * side)} ${f(2)} ${f(13 * side)}z'/>`;
    const pelvic = side => `<path class='e' d='M${f(6)} ${f(9 * side)}Q${f(-2)} ${f(18 * side)} ${f(-11)} ${f(20 * side)}Q${f(-6)} ${f(12 * side)} 0 ${f(7 * side)}z'/>`;
    const spots = { 0: `<ellipse class='q1' cx='${f(-4)}' rx='${f(9)}' ry='${f(9)}'/>`, 2: `<ellipse class='q2' cx='${f(2)}' cy='${f(5)}' rx='${f(13)}' ry='${f(12)}'/>`, 3: `<ellipse class='q3' cx='${f(-3)}' cy='${f(-5)}' rx='${f(11)}' ry='${f(10)}'/>`, [nb > 5 ? nb - 2 : nb - 1]: `<ellipse class='q4' cx='${f(-2)}' rx='${f(8)}' ry='${f(nb > 5 ? 6 : 4.5)}'/>` };
    let out = part(nb, `<path class='e' d='M${f(8)} 0Q${f(-10)} ${f(-7)} ${f(-36)} ${f(-17)}Q${f(-27)} 0 ${f(-36)} ${f(17)}Q${f(-10)} ${f(7)} ${f(8)} 0z'/>`, 's t');
    for (let k = nb - 1; k >= 0; k--) {
      let inner = (k === 2 ? fin(-1) + fin(1) : '') + (detail && k === nb - 3 ? pelvic(-1) + pelvic(1) : '')
        + `<ellipse class='b' rx='${f(k === 0 ? 13 : gap * 1.1)}' ry='${f(hwAt(k / (nb - 1)))}'/>` + (spots[k] || '');
      if (k === 0) inner += `<circle class='y' cx='${f(4)}' cy='${f(-7.5)}' r='${f(3.2)}'/><circle class='y' cx='${f(4)}' cy='${f(7.5)}' r='${f(3.2)}'/>`;
      out += part(k, inner);
    }
    return `<g id='${id}'>${out}</g>`;
  }

  const CREAM = '#e6e0cc', RED = '#c4432e', ORANGE = '#dd7f2c', GOLD = '#e2bb55', INK = '#20292e', FIN = '#c9d2ca';
  // colour sets: body, fins, then patches (head, shoulder, back, tail root)
  const COATS = [
    { b: CREAM, e: FIN, q2: RED, q3: RED, q4: RED },                 // kohaku
    { b: ORANGE, e: '#efb476', q3: '#b85d1a' },                      // orange
    { b: CREAM, e: FIN, q1: RED },                                   // tancho
    { b: INK, e: '#5d6c72', q1: CREAM, q3: CREAM, q4: RED },         // showa
    { b: GOLD, e: '#f0dc9a' },                                       // gold
    { b: CREAM, e: FIN, q1: INK, q2: RED, q4: INK },                 // sanke
    { b: '#f3efe2', e: '#dfe5df' },                                  // platinum
  ];
  // (path, start as a share of a lap, mirror x, mirror y, size) for up to 14 koi
  const SCHOOL = [
    ['a', .00, 1, 1, 1], ['b', .30, 1, 1, 1], ['a', .52, -1, 1, 1], ['b', .74, -1, -1, 1], ['c', .15, 1, 1, .62], ['c', .60, -1, 1, .62],
    ['a', .27, 1, -1, .62], ['b', .05, 1, -1, 1], ['c', .85, 1, -1, .62], ['a', .78, -1, -1, 1], ['b', .52, -1, 1, .62], ['c', .38, -1, -1, 1], ['a', .90, 1, 1, .62], ['b', .88, 1, 1, .62],
  ];
  const BALL = `<circle r='17' fill='#d24a34'/><path d='M-17 0H17M0-17V17M-12-12L12 12M-12 12L12-12' stroke='#f0c95a' stroke-width='4'/><circle r='5' fill='#2e6e8a'/>`;
  const partsFor = size => size >= 1 ? 7 : 5;

  function koiLayer(c) {
    const fps = c.fps, playful = c.mood === 'playful', r = rng(7);
    const paths = {}; let css = '', defs = '', out = '';
    const sizes = [...new Set(SCHOOL.slice(0, c.koiCount).map(f => f[4]))];
    sizes.forEach(s => { defs += koiTemplate('k' + Math.round(s * 100), s, partsFor(s), s >= 1 && c.koiCount <= 8); });
    SCHOOL.slice(0, c.koiCount).forEach(([p, start, mx, my, size], i) => {
      if (c.graze && i === 4) { p = 'g'; mx = my = 1; }
      if (c.feeding && (i === 5 || i === 8)) { p = 'f'; mx = my = 1; }
      if (!paths[p]) { paths[p] = PATHS[p](c); css += `.p${p}{--p:path('${paths[p].d}')}`; }
      const L = paths[p].L, gap = BODY * size / (partsFor(size) - 1), speed = (playful ? 62 : 38) * (.85 + .3 * r()) * (size < 1 ? 1.15 : 1);
      const beatS = (playful ? 1.0 : 1.7) * (.85 + .3 * r()) * (size < 1 ? .8 : 1);       // seconds per tail beat
      const coat = COATS[i % COATS.length], amp = num((playful ? 26 : 20) * size, 1), er = r();
      const st = Math.round(L / speed * fps), v = L * fps / st;                         // ticks per lap; every time below is a whole number of ticks
      const q = Math.max(1, Math.round(gap / v * fps));                                 // ticks between neighbouring parts
      const beat = Math.max(2, Math.round(beatS * fps / 8)), z = Math.max(1, Math.round(beat * 8 * .09));
      let style = `--T:${secs(st, fps)};--st:${st};--d:${secs(-Math.round(start * st) - 9 * q - st, fps)};--q:${secs(q, fps)};--W:${secs(beat * 8, fps)};--ws:${beat};--z:${secs(z, fps)};--a:${amp}px;--ed:${-Math.round(er * 12)}s`;
      style += Object.entries(coat).map(([k, col]) => `;--${k}:${col}`).join('');
      // the ball rides the same path two parts ahead of this koi's head, so the koi pushes it along
      const use = `<use href='#k${Math.round(size * 100)}'/>` + (c.ball && i === 1 ? `<g class='bp'>${BALL}</g>` : '');
      out += `<g class='f p${p}' style='${style}'>${mx === 1 && my === 1 ? use : `<g style='scale:${mx} ${my}'>${use}</g>`}</g>`;
    });
    css += '.s,.h{offset-path:var(--p);offset-rotate:auto;animation:m var(--T) steps(var(--st)) infinite;animation-delay:calc(var(--d) + var(--k)*var(--q))}'
        + '.s{animation-name:m,w;animation-duration:var(--T),var(--W);animation-timing-function:steps(var(--st)),steps(var(--ws));animation-delay:calc(var(--d) + var(--k)*var(--q)),calc(var(--k)*var(--z))}'
        + '.t{animation-name:m,wt}'
        + '@keyframes m{to{offset-distance:100%}}'
        // the swing as a sine in eight straight pieces; em = that part's own swing size
        + '@keyframes w{0%,50%,to{transform:translateY(0)}12.5%,37.5%{transform:translateY(.71em)}25%{transform:translateY(1em)}62.5%,87.5%{transform:translateY(-.71em)}75%{transform:translateY(-1em)}}'
        + '@keyframes wt{0%,to{transform:translateY(0) rotate(24deg)}12.5%{transform:translateY(.71em) rotate(17deg)}25%{transform:translateY(1em) rotate(0deg)}37.5%{transform:translateY(.71em) rotate(-17deg)}50%{transform:translateY(0) rotate(-24deg)}62.5%{transform:translateY(-.71em) rotate(-17deg)}75%{transform:translateY(-1em) rotate(0deg)}87.5%{transform:translateY(-.71em) rotate(17deg)}}'
        // effort: the swing grows for 12 s and fades for 12 s, in steps of 1 s, so a koi beats hard and then coasts
        + '.f{font-size:var(--a);animation:ef 12s steps(12) infinite alternate;animation-delay:var(--ed);filter:drop-shadow(14px 22px 0 rgba(0,6,10,var(--ks)))}@keyframes ef{from{font-size:calc(var(--a)*.35)}}';
    if (c.ball && c.koiCount >= 2) { const ns = Math.max(1, Math.round(6 * fps)); css += `.bp{offset-path:var(--p);offset-rotate:auto;animation:m var(--T) steps(var(--st)) infinite,bs ${secs(ns, fps)} steps(${ns}) infinite;animation-delay:calc(var(--d) - 2*var(--q)),0s}@keyframes bs{to{transform:rotate(360deg)}}`; }
    css += `.b{fill:var(--b)}.e{fill:var(--e);opacity:.85}.y{fill:#0b1215}` + [1, 2, 3, 4].map(i => `.q${i}{fill:var(--q${i},none)}`).join('');
    return { css, defs, body: out };
  }

  // ---------- plants ----------
  function star(n, R, r, rot = 0) {
    let d = '';
    for (let i = 0; i < n * 2; i++) { const a = rot + Math.PI * i / n, q = i % 2 ? r : R; d += (i ? 'L' : 'M') + num(q * Math.cos(a), 0) + ' ' + num(q * Math.sin(a), 0); }
    return d.replace(/ -/g, '-') + 'z';
  }
  const ribs = (n, r) => Array.from({ length: n }, (_, i) => `M0 0L${num(r * Math.cos(TAU * i / n), 0)} ${num(r * Math.sin(TAU * i / n), 0)}`).join('').replace(/ -/g, '-');
  // plant shapes; radius 50, scaled per plant. Colours come from variables so one shape serves every scene and both modes.
  const SHAPES = {
    pd: `<path class='pr' d='M0 0L49-9A50 50 0 1 0 49 9z'/><path class='pl' d='M0 0L43-7A44 44 0 1 0 43 7z'/><path class='pv' d='M-38 0H0M-19-33L0 0L-19 33M19-33L0 0L19 33'/>`,
    gl: `<circle class='gr' r='50'/><circle class='pl' r='43'/><path class='pv' d='${ribs(12, 42)}'/>`,
    rl: `<circle class='pr' r='50'/><circle class='pl' r='46'/><path class='pv' d='${ribs(9, 44)}'/><circle class='gr' r='8'/>`,
    lo: `<path class='f1' d='${star(8, 30, 12)}'/><path class='f2' d='${star(8, 21, 9, Math.PI / 8)}'/><circle class='f3' r='6'/>`,
    ml: `<path d='${(() => { let d = ''; for (let i = 0; i < 20; i++) { const a = TAU * i / 20 - Math.PI / 2, q = 17 * (.34 + .66 * Math.pow(Math.abs(Math.cos(2.5 * (a + Math.PI / 2))), .7)); d += (i ? 'L' : 'M') + num(q * Math.cos(a), 0) + ' ' + num(q * Math.sin(a), 0); } return d.replace(/ -/g, '-') + 'zM0 4v15h3v-15'; })()}'/>`,
    st: `<ellipse rx='36' ry='27' fill='#566364'/><ellipse cx='-6' cy='-6' rx='23' ry='15' fill='#788687'/>`,
    dw: `<path class='dw' d='${(() => { const r = rng(3); let d = ''; for (let i = 0; i < 13; i++) d += `M${Math.round(r() * 60 - 30)} ${Math.round(r() * 46 - 23)}h0`; return d.replace(/ -/g, '-'); })()}'/>`,
  };
  // per scene: most plants at 100% cover, water tint, plant colours in dark and light mode, flower colours
  const SCENES = {
    lotus: { max: 16, kinds: [['pd', 1, .7, 2.2]], flower: .4, weed: .5, dark: ['#0e3027', '#17503a', '#1f6a4a'], light: ['#2c7a52', '#48a06a', '#6dbf8c'], fl: ['#b8527a', '#e58fae', '#e2bb55'] },
    lagoon: { max: 9, tint: ['#1f6fb0', .3], kinds: [['gl', 3, 2.0, 3.6], ['pd', 1, .7, 1.3]], flower: .25, weed: 0, dark: ['#1d5a4a', '#226a45', '#2c8052'], light: ['#3f9a66', '#5cb877', '#84d196'], fl: ['#d9d4c2', '#f6f3e8', '#e2bb55'] },
    grove: { max: 22, tint: ['#a58f5f', .16], kinds: [['pd', 2, .7, 1.7], ['rl', 1, 1.0, 2.1]], flower: .3, weed: .2, dark: ['#103528', '#1c5a3d', '#2a7550'], light: ['#2f8055', '#4fa871', '#79c796'], fl: ['#b8527a', '#eaa0b8', '#e2bb55'] },
    maple: { max: 12, tint: ['#0d3b40', .25], kinds: [['pd', 1, .7, 1.8]], flower: 0, weed: 0, leaves: 2.2, stones: true, turning: .45, dark: ['#0e3027', '#1a4f3a', '#256a4c'], light: ['#2c7a52', '#48a06a', '#6dbf8c'], fl: ['#b8527a', '#e58fae', '#e2bb55'] },
  };
  function plants(c) {
    const S = SCENES[c.scene], r = rng(977 + c.plantSeed * 7919), n = Math.round(S.max * c.plantCover / 100);
    const band = 9 + c.plantCover * .2, placed = [], used = new Set(); let out = '', guard = 0;
    const tot = S.kinds.reduce((t, k) => t + k[1], 0);
    while (placed.length < n && guard++ < 900) {
      const x = r() * 106 - 3, y = r() * 106 - 3, dx = Math.min(x, 100 - x), dy = Math.min(y, 100 - y);
      if (!(dx < band || (dy < band * .5 && dx < 36))) continue;
      let pick = r() * tot, kind = S.kinds[0]; for (const k of S.kinds) { if ((pick -= k[1]) <= 0) { kind = k; break; } }
      const sc = kind[2] + (kind[3] - kind[2]) * r() * r(), rad = 50 * sc;                          // most plants small, a few large
      if (placed.some(p => Math.hypot((p.x - x) * 12, (p.y - y) * 8) < (p.rad + rad) * .8)) continue;
      placed.push({ x, y, rad, sc, kind: kind[0], rot: Math.round(r() * 360), t: r(), u: r(), w: r() });
    }
    placed.sort((p, q) => q.rad - p.rad);
    const at = (p, ox = 0, oy = 0) => `translate:${ox ? `calc(${num(p.x, 1)}vw + ${ox}px)` : num(p.x, 1) + 'vw'} ${oy ? `calc(${num(p.y, 1)}vh + ${oy}px)` : num(p.y, 1) + 'vh'}`;
    const use = (id, style) => { used.add(id); return `<use href='#${id}' style='${style}'/>`; };
    for (const p of placed) {
      const turn = S.turning && p.t < S.turning ? `;--pl:${p.t < S.turning / 2 ? '#b8862f' : '#8a8f3a'};--pr:#6b5a22` : '';
      out += use(p.kind, `${at(p)};scale:${num(p.sc)};rotate:${p.rot}deg${turn}`);
    }
    for (const p of placed) {                                                                         // flowers and duckweed sit on top of every pad
      if (p.u < S.flower) out += use('lo', `${at(p, Math.round(p.rad * .3), Math.round(-p.rad * .2))};scale:${num(.7 + p.w * .5)};rotate:${p.rot}deg`);
      if (p.w < S.weed) out += use('dw', `${at(p, Math.round(p.rad * (p.x < 50 ? 1 : -1)), Math.round(p.rad * .5))};rotate:${p.rot}deg`);
    }
    if (S.stones && n) [[2, 96], [5, 101], [97, 3], [101, 8]].forEach(([x, y], i) => { out += use('st', `translate:${x}vw ${y}vh;scale:${num(1.5 + (i % 2) * .7)};rotate:${i * 50}deg`); });
    if (S.leaves) for (let i = 0, m = Math.round(n * S.leaves); i < m; i++) out += use('ml', `translate:${num(r() * 100, 1)}vw ${num(r() * 100, 1)}vh;rotate:${Math.round(r() * 360)}deg;fill:${['#c8452f', '#e08a2e', '#e2bb55', '#a8402e'][i % 4]}`);
    const css = `.pg{filter:drop-shadow(7px 11px 0 rgba(0,8,10,var(--so)))}.pr{fill:var(--pr)}.pl{fill:var(--pl)}.gr{fill:var(--pv)}.pv{fill:none;stroke:var(--pv);stroke-width:2.5}`
      + `.f1{fill:${S.fl[0]}}.f2{fill:${S.fl[1]}}.f3{fill:${S.fl[2]}}.dw{fill:none;stroke:var(--dw);stroke-width:7;stroke-linecap:round}`;
    const vars = m => `--pr:${S[m][0]};--pl:${S[m][1]};--pv:${S[m][2]};--dw:${m === 'dark' ? '#3d8a48' : '#58a85a'}`;
    return { css: out ? css : '', used, body: out ? `<g class='pg'>${out}</g>` : '', dark: vars('dark'), light: vars('light') };
  }

  // ---------- water surface: bed light, wind waves, ripples, rain ----------
  function surface(c, T) {
    const r = rng(41), fps = c.fps; let css = '', defs = '', under = '', over = '';
    if (c.bedLight) {                                                                                 // a warped net of light on the pond bed; one tile, repeated
      const cw = 220, nx = 4, ny = 3, P = [];
      for (let j = 0; j <= ny; j++) { P.push([]); for (let i = 0; i <= nx; i++) P[j].push([i * cw + (i % nx ? Math.round(r() * 160 - 80) : 0), j * cw + (j % ny ? Math.round(r() * 160 - 80) : 0)]); }
      for (let i = 0; i <= nx; i++) P[ny][i][0] = P[0][i][0];
      for (let j = 0; j <= ny; j++) P[j][nx][1] = P[j][0][1];
      const mid = (p, q) => [Math.round((p[0] + q[0]) / 2), Math.round((p[1] + q[1]) / 2)];
      const curve = pts => { let o = 'M' + pts[0].join(' '); for (let i = 1; i < pts.length - 1; i++) o += 'Q' + pts[i].join(' ') + ' ' + mid(pts[i], pts[i + 1]).join(' '); return o + 'L' + pts[pts.length - 1].join(' '); };
      let d = '';
      for (let j = 0; j < ny; j++) d += curve(P[j]);
      for (let i = 0; i < nx; i++) d += curve(P.map(row => row[i]));
      d = d.replace(/ -/g, '-');
      defs += `<path id='bl' class='bl' d='${d}'/>`;
      const nd = T(26);
      css += `.bl{fill:none;stroke:var(--bc);stroke-width:6;stroke-linejoin:round;opacity:calc(var(--bo)*${num(c.bedLightBrightness / 160)})}`
        + `.bn{animation:bn ${secs(nd, fps)} steps(${nd}) infinite alternate}.b2{animation-direction:alternate-reverse}@keyframes bn{from{translate:-50px -22px}to{translate:50px 22px}}`;
      let tiles = ''; for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) tiles += `<use href='#bl' x='${i * cw * nx - 160}' y='${j * cw * ny - 130}'/>`;
      defs += `<g id='bg'>${tiles}</g>`;
      under += `<use href='#bg' class='bn'/><use href='#bg' class='bn b2' x='110' y='90'/>`;
    }
    // slow ripples, always there
    const ring = (cls, x, y, delay) => `<circle class='${cls}' cx='${x}' cy='${y}' style='animation-delay:${secs(-Math.round(delay * fps), fps)}'/>`;
    css += `.rp{fill:none;stroke:var(--rc);stroke-width:3;opacity:0}`;
    const rip = (name, period, life, size, peak) => { const nt = T(period), na = Math.min(nt - 1, T(life)); css += `.${name}{animation:${name} ${secs(nt, fps)} infinite}` + kf(name, [[0, `r:3px;opacity:${peak}`], [na, `r:${size}px;opacity:0`], [nt, `r:${size}px;opacity:0`]]); };
    rip('ra', 17, 3.2, 70, .4);
    if (c.feeding && c.koiCount >= 6) rip('rf', 5, 2.4, 60, .45);
    if (c.graze && c.koiCount >= 5) rip('rn', 7, 1.5, 20, .5);
    [[30, 26, 2], [68, 72, 9], [54, 44, 14]].forEach(([x, y, d]) => { over += ring('rp ra', x + '%', y + '%', d) + ring('rp ra', x + '%', y + '%', d - .7); });
    if (c.rain) {
      rip('rr', 2.6, 1.2, 26, .55); rip('rs', 3.4, 1.4, 32, .5);
      for (let i = 0; i < 16; i++) over += ring('rp ' + (i % 2 ? 'rr' : 'rs'), Math.round(r() * 100) + '%', Math.round(r() * 100) + '%', r() * 3.4);
    }
    if (c.wind && c.windStrength > 0) {
      // A gust is a round window that crosses the pond at gust speed. Inside it, a field of wavelets moves at wave speed.
      const FW = 720, FH = 440, lo = Math.min(c.waveShort, c.waveLong), hi = Math.max(c.waveShort, c.waveLong), th = c.windDirection * Math.PI / 180; let d = '';
      for (let i = 0; i < 34; i++) {                                                                 // each wavelet lies across the wind, turned a little by the spread
        const len = lo + (hi - lo) * r(), a = th + Math.PI / 2 + (r() - .5) * c.spread / 100 * 1.4, rise = len * c.crest / 60;
        const ex = len * Math.cos(a), ey = len * Math.sin(a), cx = ex / 2 + rise * Math.cos(th), cy = ey / 2 + rise * Math.sin(th);
        d += `M${Math.round(r() * FW)} ${Math.round(r() * FH)}q${num(cx, 0)} ${num(cy, 0)} ${num(ex, 0)} ${num(ey, 0)}`;
      }
      defs += `<path id='wv' d='${d.replace(/ -/g, '-')}'/>`;
      const act = 10, nt = T(act / (1 - c.calm / 100)), na = Math.min(nt - 2, T(act)), fade = Math.max(1, T(2)), peak = num(.08 + .4 * c.windStrength / 100);
      const wx = Math.round(Math.cos(th) * c.waveSpeed * act), wy = Math.round(Math.sin(th) * c.waveSpeed * act);       // how far the wavelets go in one gust
      const gx = Math.round(Math.cos(th) * c.gustSpeed * act), gy = Math.round(Math.sin(th) * c.gustSpeed * act);       // how far the window goes
      const ox = Math.round((gx - wx) / 2 - FW / 2), oy = Math.round((gy - wy) / 2 - FH / 2);                           // the field starts where the window will stay inside it
      const win = (x, y) => `clip-path:circle(${Math.round(c.gustSize / 2)}px at calc(var(--x) + ${x}px) calc(var(--y) + ${y}px)) view-box`;
      css += `.gu{fill:none;stroke:var(--wc);stroke-width:3;stroke-linecap:round;opacity:0;animation:gc ${secs(nt, fps)} infinite,go ${secs(nt, fps)} infinite}.gw{animation:gt ${secs(nt, fps)} infinite;animation-delay:inherit}`
        + kf('gc', [[0, win(0, 0)], [na, win(gx, gy)], [nt, win(gx, gy)]])
        + kf('gt', [[0, `translate:calc(var(--x) + ${ox}px) calc(var(--y) + ${oy}px)`], [na, `translate:calc(var(--x) + ${ox + wx}px) calc(var(--y) + ${oy + wy}px)`], [nt, `translate:calc(var(--x) + ${ox + wx}px) calc(var(--y) + ${oy + wy}px)`]])
        + kf('go', [[0, 'opacity:0'], [fade, `opacity:${peak}`], [na - fade, `opacity:${peak}`], [na, 'opacity:0'], [nt, 'opacity:0']]);
      for (let i = 0; i < 3; i++) over += `<g class='gu' style='--x:${Math.round(5 + r() * 60)}vw;--y:${Math.round(8 + r() * 60)}vh;animation-delay:${secs(-Math.round(i * nt / 3), fps)}'><use href='#wv' class='gw'/></g>`;
    }
    return { css, defs, under, over };
  }

  // ---------- things above the water: visitors, cloud shadows, fireflies ----------
  function above(c, T) {
    const r = rng(77), fps = c.fps; let css = '', defs = '', pond = '', top = '';
    const sh = 'filter:drop-shadow(10px 16px 0 rgba(0,6,10,var(--ks)))';
    if (c.ball && c.koiCount < 2) {
      const nt = T(90), ns = T(24);
      css += `.ba{offset-path:path('M150 60C290 10 380 170 250 230S60 170 150 60z');offset-rotate:0deg;${sh};animation:bm ${secs(nt, fps)} steps(${nt}) infinite,bs ${secs(ns, fps)} steps(${ns}) infinite}@keyframes bm{to{offset-distance:100%}}@keyframes bs{to{transform:rotate(360deg)}}`;
      pond += `<g class='ba'>${BALL}</g>`;
    }
    if (c.goose) {
      const nt = T(c.gooseEvery), na = Math.min(nt - 1, T(Math.min(46, c.gooseEvery * .7))), nw = T(1.6);
      css += `.gs{offset-path:path('M-1150-190C-520-340 320 230 1150 70');offset-rotate:auto;${sh};animation:gm ${secs(nt, fps)} infinite,gw ${secs(nw, fps)} steps(${nw}) infinite alternate}`
        + kf('gm', [[0, 'offset-distance:0%'], [na, 'offset-distance:100%'], [nt, 'offset-distance:100%']]) + '@keyframes gw{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}';
      pond += `<g class='gs'><path d='M-36-9L-100-50M-36 9L-100 50' stroke='var(--rc)' stroke-width='4' opacity='.3'/><path d='M-28-7L-43 0L-28 7z' fill='#dcd8cc'/><ellipse rx='31' ry='20' fill='#f1eee6'/><path d='M-18-9Q0-17 16-9M-18 9Q0 17 16 9' stroke='#c9c4b6' fill='none' stroke-width='3'/><ellipse cx='30' rx='15' ry='7' fill='#f1eee6'/><circle cx='45' r='8.5' fill='#f8f6f0'/><path d='M51-4L62 0L51 4z' fill='#e8912d'/><path d='M46-5h0M46 5h0' stroke='#141a1c' stroke-width='5' stroke-linecap='round'/></g>`;
    }
    if (c.clouds) {
      const nt = T(150);
      css += `.cl{fill:#04202a;opacity:var(--co);animation:cm ${secs(nt, fps)} steps(${nt}) infinite}@keyframes cm{from{translate:-760px var(--y)}to{translate:calc(100vw + 760px) var(--y)}}`;
      [[22, 0], [64, .55]].forEach(([y, d]) => { top += `<g class='cl' style='--y:${y}vh;animation-delay:${secs(-Math.round(d * nt), fps)}'><ellipse rx='430' ry='230'/><ellipse cx='260' cy='120' rx='300' ry='190'/><ellipse cx='-280' cy='90' rx='260' ry='150'/></g>`; });
    }
    if (c.fireflies) {
      defs += `<g id='fy'><circle r='9' fill='#cfe86a' opacity='.22'/><circle r='3.2' fill='#f1fba6'/></g>`;
      const nb = T(3.6);                                                                               // one blink length for all; each firefly starts it at its own tick
      css += `.ff{translate:var(--x) var(--y);animation:fd var(--t) steps(var(--s)) infinite alternate,fb ${secs(nb, fps)} infinite}@keyframes fd{to{translate:calc(var(--x) + var(--dx)) calc(var(--y) + var(--dy))}}`
        + kf('fb', [[0, 'opacity:1'], [T(.6), 'opacity:.9'], [T(1.2), 'opacity:.12'], [T(1.9), 'opacity:.12'], [T(2.5), 'opacity:1'], [nb, 'opacity:1']]) + '@media (prefers-color-scheme:light){.ff{display:none}}';
      for (let i = 0; i < 7; i++) { const nt = T(16 + r() * 14);
        top += `<use href='#fy' class='ff' style='--x:${Math.round(6 + r() * 88)}vw;--y:${Math.round(6 + r() * 82)}vh;--dx:${Math.round(r() * 260 - 130)}px;--dy:${Math.round(r() * 200 - 100)}px;--t:${secs(nt, fps)};--s:${nt};animation-delay:${secs(-Math.round(r() * nt), fps)},${secs(-Math.round(r() * nb), fps)}'/>`; }
    }
    return { css, defs, pond, top };
  }

  // ---------- the SVG image ----------
  function pondSvg(c, pause) {
    const T = sec => Math.max(1, Math.round(sec * c.fps));                                           // seconds to whole ticks
    const koi = koiLayer(c), pl = plants(c), su = surface(c, T), ab = above(c, T);
    let pond = koi.body;
    if (c.graze && c.koiCount >= 5) {
      pl.used.add('dw');
      WEED.forEach(([x, y], n) => { pond += [[0, 0, 0], [24, 16, 70], [-20, 14, 200]].map(([dx, dy, a]) => `<use href='#dw' style='translate:${x + dx}px ${y + dy}px;rotate:${a + n * 40}deg'/>`).join('') + `<circle class='rp rn' cx='${x}' cy='${y - 30}' style='animation-delay:${secs(-T(3.5) * n, c.fps)}'/>`; });
    }
    if (c.feeding && c.koiCount >= 6) { const [x, y] = feedAt(c); pond += `<circle class='rp rf' cx='${x}' cy='${y}'/>`; }
    const defs = koi.defs + su.defs + ab.defs + [...pl.used].map(id => `<g id='${id}'>${SHAPES[id]}</g>`).join('');
    const dwcss = pl.css ? '' : '.dw{fill:none;stroke:var(--dw);stroke-width:7;stroke-linecap:round}';
    const style = `svg{--ks:.45;--so:.34;--rc:#bfe9e4;--wc:#cdeee9;--bc:#8fdcd2;--bo:.1;--co:.08;${pl.dark}}`
      + `@media (prefers-color-scheme:light){svg{--ks:.2;--so:.16;--rc:#3f8f96;--wc:#4f9aa0;--bc:#fff;--bo:.34;--co:.07;${pl.light}}}`
      + koi.css + pl.css + dwcss + su.css + ab.css
      + '@media (prefers-reduced-motion:reduce){*{animation-play-state:paused!important}}'
      + (pause ? '*{animation-play-state:paused!important}' : '');
    const s = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><style>${style}</style><defs>${defs}</defs>${su.under}`
      + `<g style='translate:50vw 50vh'>${pond}</g>${su.over}${pl.body}${ab.pond ? `<g style='translate:50vw 50vh'>${ab.pond}</g>` : ''}${ab.top}</svg>`;
    if (s.includes('"') || s.includes('\\')) throw new Error('quote or backslash inside the SVG');
    const esc = s.replace(/#/g, '%23');
    const bad = (esc.match(/%[0-9a-fA-F]{2}/g) || []).filter(m => m !== '%23');
    if (bad.length) throw new Error('percent sign would be read as an escape: ' + bad[0]);
    return esc;
  }
  function pixelFilter(p) {
    if (!p) return '';
    const h = Math.floor(p / 2);
    return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><filter id='p' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feFlood x='${h}' y='${h}' width='1' height='1'/><feComposite width='${p}' height='${p}'/><feTile result='a'/><feComposite in='SourceGraphic' in2='a' operator='in'/><feMorphology operator='dilate' radius='${h}'/></filter></svg>#p")`;
  }

  // ---------- water colours by time of day ----------
  // top, middle, bottom of the water, a soft light near the top left, glass behind the composer, accent
  const TIMES = {
    dawn: { w: ['#f4e4e2', '#dbe9e6', '#bddbd6'], glow: ['#ffbfa8', .4], glass: 'rgba(255,255,255,.78)', accent: '#1f8f86' },
    day: { w: ['#daf2e9', '#c0e7dd', '#a0d4cc'], glow: ['#ffffff', .5], glass: 'rgba(255,255,255,.78)', accent: '#1f8f86' },
    golden: { w: ['#f7e8c9', '#e6e0c2', '#c5d3b7'], glow: ['#ffc878', .45], glass: 'rgba(255,253,246,.8)', accent: '#a8651a' },
    dusk: { w: ['#2b2f55', '#17223a', '#0a1222'], glow: ['#c87896', .2], glass: 'rgba(10,14,28,.84)', accent: '#e8a3b8' },
    night: { w: ['#0d2c33', '#08191f', '#040d12'], glow: ['#287878', .2], glass: 'rgba(5,16,20,.84)', accent: '#5ee0c8' },
    deep: { w: ['#0b2b47', '#071a2f', '#030b18'], glow: ['#3c8cc8', .2], glass: 'rgba(4,12,24,.84)', accent: '#7cc4f5' },
  };
  function water(c, name, darkMode) {
    const t = TIMES[name], tint = SCENES[c.scene].tint;
    let w = t.w.slice();
    if (tint) w = w.map(col => mix(col, darkMode ? tint[0] : mix(tint[0], '#ffffff', .62), tint[1]));
    if (c.rain) w = w.map(col => mix(col, darkMode ? '#4d5b60' : '#c3cbcb', .4));
    return { w, glass: t.glass, accent: t.accent, css: `radial-gradient(90% 70% at 22% 8%,${rgba(t.glow[0], t.glow[1] * (c.rain ? .4 : 1))},transparent 70%),radial-gradient(120% 90% at 50% 0%,${w[0]} 0%,${w[1]} 55%,${w[2]} 100%)` };
  }

  // ---------- the theme ----------
  const A = '[data-workspace-area="conversation"]', L = ':root:not(.dark)';
  function buildCss(c, opts = {}) {
    const dk = water(c, c.darkTime, true), lt = water(c, c.lightTime, false), filter = pixelFilter(c.pixel);
    const stop = (sel, col) => `${sel} [data-chat-composer-form] button[aria-label^="Stop"]{background:${rgba(col, .12)}!important;color:${col}!important;box-shadow:inset 0 0 0 1.5px ${rgba(col, .75)}!important}`;
    return `${A}{position:relative;isolation:isolate;overflow:clip}`
      + `${A}::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:url("data:image/svg+xml,${pondSvg(c, opts.pause)}") 0 0/100% 100% no-repeat;opacity:${num(c.strength / 100)}${filter ? ';filter:' + filter : ''}}`
      + `.dark ${A}{background-image:${dk.css}!important}.dark ${A}::before{color-scheme:dark}`
      + `${L} ${A}{background-image:${lt.css}!important}${L} ${A}::before{color-scheme:light}`
      + `.messages-timeline-scroll{background:transparent!important}`
      + `.dark [data-slot="composer-host"],.dark [data-user-message-bubble]{background:${dk.glass}!important}`
      + `${L} [data-slot="composer-host"],${L} [data-user-message-bubble]{background:${lt.glass}!important}`
      + `.dark .chat-markdown{text-shadow:0 1px 2px rgba(0,0,0,.75)}${L} .chat-markdown{text-shadow:0 0 3px rgba(255,255,255,.9)}`
      + stop('.dark', '#5ee0c8') + stop(L, '#1f8f86');
  }
  // what to give up, in order, when the CSS is over the app's limit
  const TRIMS = [
    ['the light net on the bed', c => c.bedLight && (c.bedLight = false, true)],
    ['some plants', c => c.plantCover > 20 && (c.plantCover -= 20, true)],
    ['cloud shadows', c => c.clouds && (c.clouds = false, true)],
    ['fireflies', c => c.fireflies && (c.fireflies = false, true)],
    ['wind waves', c => c.wind && (c.wind = false, true)],
    ['some koi', c => c.koiCount > 4 && (c.koiCount -= 2, true)],
  ];
  // The settings travel inside the theme file, as a comment at the start of its CSS, so a shared file can be opened and changed again.
  // Format 1 is every value in the order of ORDER_1, comma separated. When settings change, add ORDER_2 and keep ORDER_1 so old files still open.
  const TAG = '/*koi-pond ', ORDER_1 = SETTINGS.map(s => s.key);
  function stamp(c) { return `${TAG}1 ${ORDER_1.map(k => c[k] === true ? 1 : c[k] === false ? 0 : c[k]).join(',')}*/`; }
  function readConfig(theme) {
    const css = typeof theme === 'string' ? theme : (theme && theme.css) || '';
    if (!css.startsWith(TAG + '1 ')) return null;
    const values = css.slice(TAG.length + 2, css.indexOf('*/')).split(','), out = {};
    if (values.length !== ORDER_1.length) return null;
    ORDER_1.forEach((k, i) => { const s = SETTINGS.find(x => x.key === k); if (s) out[k] = s.type === 'toggle' ? values[i] === '1' : values[i]; });
    return normalize(out);
  }
  /** Hour of the day (0-23) to the two time settings: the pond in light mode and in dark mode. */
  function timesFor(hour) {
    return { lightTime: hour < 9 ? 'dawn' : hour < 16 ? 'day' : 'golden', darkTime: hour >= 16 && hour < 21 ? 'dusk' : 'night' };
  }
  function build(config, opts) {
    const asked = normalize(config), c = { ...asked }, trimmed = [], make = () => stamp(asked) + buildCss(c, opts);
    let css = make();
    for (let i = 0; css.length > LIMIT && i < 40; i++) {
      const t = TRIMS.find(([, cut]) => cut(c)); if (!t) break;
      if (!trimmed.includes(t[0])) trimmed.push(t[0]);
      css = make();
    }
    const dk = water(c, c.darkTime, true), lt = water(c, c.lightTime, false);
    const theme = { version: 1, name: 'Koi Pond', appearance: 'dark', canvas: mix(dk.w[1], dk.w[2], .5), accent: dk.accent,
      colors: { messageAction: dk.accent, messageActionForeground: '#04121a', messageActionHover: mix(dk.accent, '#ffffff', .3) },
      variants: { light: { canvas: mix(lt.w[0], '#ffffff', .35), accent: lt.accent, messageAction: lt.accent, messageActionForeground: '#ffffff', messageActionHover: mix(lt.accent, '#000000', .15) } }, css };
    return { theme, css, config: asked, used: c, trimmed, size: css.length, limit: LIMIT, fits: css.length <= LIMIT };
  }
  return { SETTINGS, LIMIT, defaults, normalize, build, readConfig, timesFor, num };
});
