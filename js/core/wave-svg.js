/**
 * waveform and constellation SVG builders
 *
 * Pure functions that return SVG strings for the physical-layer modules. They rely on the lk- classes injected by
 * learn-kit.js (call kitStyles() before showing the result). New segments animate with the lk-draw class, which draws a
 * path from start to end (the path uses pathLength="1" so one CSS rule fits every length).
 *
 * Imports:
 *   - ./utils.js: esc
 *
 * Exports: analogWave, barsSvg, constellationSvg, levelWave
 *
 * Used by: link-layer line-coding, modulation, channel-capacity and mux-switching modules
 */

import { esc } from './utils.js';

const f1 = n => Math.round(n * 10) / 10;

/**
 * Digital (stepped) waveform.
 *
 * @param {Object} o
 * @param {number[]} o.halves - two levels per bit, each -1, 0 or +1.
 * @param {string[]} [o.labels] - one short label per bit, shown above the wave.
 * @param {number} [o.upTo] - draw only this many bits (the rest of the grid stays visible but empty).
 * @param {number} [o.hot] - index of a bit to highlight and animate.
 */
export function levelWave({ halves, labels = [], upTo = Infinity, hot = -1, w = 720, h = 150, name = 'Signal' }) {
  const n = Math.floor(halves.length / 2);
  const shown = Math.max(0, Math.min(n, upTo));
  const padL = 34,
    padR = 12,
    top = 30,
    bot = 16;
  const bw = (w - padL - padR) / n,
    hw = bw / 2;
  const yOf = v => top + (1 - (v + 1) / 2) * (h - top - bot);
  const P = [];
  for (let j = 0; j < shown * 2; j++) {
    const x0 = padL + j * hw;
    P.push([f1(x0), f1(yOf(halves[j]))], [f1(x0 + hw), f1(yOf(halves[j]))]);
  }
  const d = pts => 'M' + pts.map(p => p.join(' ')).join(' L');
  let s = `<svg class="lk-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)} waveform, ${n} bits">`;
  for (let b = 0; b <= n; b++) {
    const x = f1(padL + b * bw);
    s += `<line class="lk-grid" x1="${x}" y1="${top - 6}" x2="${x}" y2="${h - bot + 4}"/>`;
  }
  const hasZero = halves.some(v => v === 0);
  s += `<line class="lk-axis" x1="${padL}" y1="${f1(yOf(0))}" x2="${w - padR}" y2="${f1(yOf(0))}" opacity=".5"/>`;
  s += `<text class="lk-sub" x="8" y="${f1(yOf(1) + 4)}">+</text><text class="lk-sub" x="8" y="${f1(yOf(-1) + 4)}">−</text>`;
  if (hasZero) s += `<text class="lk-sub" x="8" y="${f1(yOf(0) + 4)}">0</text>`;
  for (let b = 0; b < n; b++) {
    if (labels[b] !== undefined)
      s += `<text class="lk-lbl${b >= shown ? ' dim' : ''}" x="${f1(padL + b * bw + bw / 2)}" y="${top - 12}">${esc(labels[b])}</text>`;
  }
  if (P.length) {
    const cut = hot >= 0 && hot < shown ? Math.max(0, 4 * hot - 1) : P.length;
    s += `<path class="lk-wave" d="${d(P.slice(0, Math.max(2, cut + 1)))}"/>`;
    if (hot >= 0 && hot < shown)
      s += `<path class="lk-wave hot lk-draw" pathLength="1" d="${d(P.slice(Math.max(0, 4 * hot - 1), 4 * hot + 4))}"/>`;
  }
  return s + '</svg>';
}

/**
 * Analogue (carrier) waveform.
 *
 * @param {Object} o
 * @param {number[]} o.samples - amplitude samples in [-1, 1].
 * @param {number} o.spb - samples per bit.
 * @param {string[]} [o.labels] - one label per bit.
 * @param {number} [o.upTo] - bits to draw.
 * @param {number} [o.hot] - bit to highlight.
 */
export function analogWave({ samples, spb, labels = [], upTo = Infinity, hot = -1, w = 720, h = 170, name = 'Carrier' }) {
  const n = Math.floor(samples.length / spb);
  const shown = Math.max(0, Math.min(n, upTo));
  const padL = 12,
    padR = 12,
    top = 30,
    bot = 14;
  const dx = (w - padL - padR) / samples.length;
  const mid = top + (h - top - bot) / 2,
    amp = (h - top - bot) * 0.44;
  const pt = k => `${f1(padL + k * dx)} ${f1(mid - samples[k] * amp)}`;
  const run = (a, b) => {
    let out = 'M' + pt(a);
    for (let k = a + 1; k <= b; k++) out += ' L' + pt(k);
    return out;
  };
  let s = `<svg class="lk-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)} wave, ${n} bits">`;
  for (let b = 0; b <= n; b++) {
    const x = f1(padL + b * spb * dx);
    s += `<line class="lk-grid" x1="${x}" y1="${top - 6}" x2="${x}" y2="${h - bot + 4}"/>`;
  }
  s += `<line class="lk-axis" x1="${padL}" y1="${f1(mid)}" x2="${w - padR}" y2="${f1(mid)}" opacity=".5"/>`;
  for (let b = 0; b < n; b++)
    if (labels[b] !== undefined)
      s += `<text class="lk-lbl${b >= shown ? ' dim' : ''}" x="${f1(padL + (b + 0.5) * spb * dx)}" y="${top - 12}">${esc(labels[b])}</text>`;
  const end = Math.min(samples.length - 1, shown * spb);
  if (shown > 0) {
    const cut = hot >= 0 && hot < shown ? hot * spb : end;
    if (cut > 0) s += `<path class="lk-wave" d="${run(0, cut)}"/>`;
    if (hot >= 0 && hot < shown)
      s += `<path class="lk-wave hot lk-draw" pathLength="1" d="${run(hot * spb, Math.min(samples.length - 1, (hot + 1) * spb))}"/>`;
  }
  return s + '</svg>';
}

/**
 * Constellation diagram: ideal points as rings, received symbols as dots.
 *
 * @param {Object} o
 * @param {Array<{i:number,q:number,bits:string}>} o.ideal - the allowed points.
 * @param {Array<{rx:{i:number,q:number}, decided:{i:number,q:number}, ok:boolean}>} [o.symbols] - received symbols.
 * @param {boolean} [o.lines] - join each received dot to the point the receiver chose.
 * @param {boolean} [o.labels] - print the bit pattern on each ideal point.
 * @param {boolean} [o.neutral] - draw every received dot in one colour (do not reveal right and wrong yet).
 */
export function constellationSvg({ ideal, symbols = [], lines = false, labels = true, neutral = false, size = 340, range = 1.4 }) {
  const c = size / 2,
    m = 22;
  const X = v => f1(c + (v / range) * (c - m)),
    Y = v => f1(c - (v / range) * (c - m));
  let s = `<svg class="lk-svg" viewBox="0 0 ${size} ${size}" style="max-width:${size}px" role="img" aria-label="Constellation diagram with ${ideal.length} points">`;
  s += `<line class="lk-axis" x1="${m / 2}" y1="${c}" x2="${size - m / 2}" y2="${c}"/><line class="lk-axis" x1="${c}" y1="${m / 2}" x2="${c}" y2="${size - m / 2}"/>`;
  s += `<text class="lk-sub" x="${size - 14}" y="${c - 6}">I</text><text class="lk-sub" x="${c + 6}" y="${m - 8}">Q</text>`;
  symbols.slice(0, 600).forEach(y => {
    if (lines && y.decided)
      s += `<line class="lk-link" x1="${X(y.rx.i)}" y1="${Y(y.rx.q)}" x2="${X(y.decided.i)}" y2="${Y(y.decided.q)}"/>`;
  });
  ideal.forEach(p => {
    s += `<circle class="lk-pt" cx="${X(p.i)}" cy="${Y(p.q)}" r="9"/>`;
    if (labels) s += `<text class="lk-ptl" x="${X(p.i)}" y="${f1(Y(p.q) - 13)}">${esc(p.bits)}</text>`;
  });
  symbols.slice(0, 600).forEach((y, k) => {
    s += `<circle class="${neutral ? 'lk-rxdot' : y.ok ? 'lk-ok' : 'lk-bad'} lk-pop" style="--d:${Math.min(k * 0.012, 1.2).toFixed(2)}s" cx="${X(y.rx.i)}" cy="${Y(y.rx.q)}" r="2.6"/>`;
  });
  return s + '</svg>';
}

/**
 * Simple horizontal bar chart as SVG (used where HTML meters would not line up).
 *
 * @param {Array<{label:string, value:number, text:string, cls?:string}>} rows
 */
export function barsSvg(rows, w = 640) {
  const max = Math.max(...rows.map(r => r.value), 1e-9);
  const rh = 34,
    labW = 170,
    h = rows.length * rh + 8;
  let s = `<svg class="lk-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Bar chart">`;
  rows.forEach((r, k) => {
    const y = 4 + k * rh,
      bw = Math.max(2, ((w - labW - 120) * r.value) / max);
    s += `<text class="lk-sub" x="${labW - 8}" y="${y + 19}" text-anchor="end">${esc(r.label)}</text>`;
    s += `<rect class="lk-bx ${r.cls || ''} lk-in" style="--d:${(k * 0.15).toFixed(2)}s" x="${labW}" y="${y + 4}" width="${f1(bw)}" height="${rh - 12}" rx="5"/>`;
    s += `<text class="lk-sub lk-in" style="--d:${(k * 0.15 + 0.3).toFixed(2)}s" x="${f1(labW + bw + 8)}" y="${y + 19}">${esc(r.text)}</text>`;
  });
  return s + '</svg>';
}
