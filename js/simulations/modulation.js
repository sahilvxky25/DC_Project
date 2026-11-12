/**
 * modulation: putting bits on a carrier wave
 *
 * modulate() builds sample arrays for ASK, FSK and PSK so the module can draw them. constellation() and
 * simulateNoise() model phase and amplitude shift keying (BPSK, QPSK, 16-QAM) with Gray-coded points, additive Gaussian
 * noise and a nearest-point receiver.
 *
 * Every constellation is scaled so the average symbol energy is 1. SNR is therefore Es/N0 in dB, per symbol.
 *
 * Imports:
 *   - ../core/utils.js (rng: seeded random numbers, so a noise picture can be replayed)
 *
 * Exports: MODS, SCHEMES_ANALOG, constellation, modulate, simulateNoise
 *
 * Used by: modules/link-layer/modulation.js, tests/physical.test.mjs
 */

import { rng } from '../core/utils.js';

export const SCHEMES_ANALOG = [
  { id: 'ask', name: 'ASK (amplitude)', what: 'the height of the wave' },
  { id: 'fsk', name: 'FSK (frequency)', what: 'how fast the wave wiggles' },
  { id: 'psk', name: 'PSK (phase)', what: 'where in its cycle the wave starts' },
];

export const MODS = {
  bpsk: { name: 'BPSK', bitsPerSym: 1 },
  qpsk: { name: 'QPSK', bitsPerSym: 2 },
  qam16: { name: '16-QAM', bitsPerSym: 4 },
};

/**
 * Builds the carrier samples for a bit string.
 *
 * ASK here is on-off keying (a 0 switches the carrier off). FSK keeps its phase continuous between bits. PSK flips the
 * wave by 180 degrees for a 0.
 *
 * @param {string} kind - 'ask' | 'fsk' | 'psk'.
 * @param {string} bits
 * @param {number} [spb] - samples per bit.
 * @returns {{samples:number[], spb:number, perBit:{bit:number, why:string}[]}}
 */
export function modulate(kind, bits, spb = 40) {
  const samples = [],
    perBit = [];
  let phase = 0;
  [...bits].forEach(ch => {
    const bit = Number(ch);
    for (let s = 0; s < spb; s++) {
      const t = s / spb;
      if (kind === 'ask') samples.push((bit ? 1 : 0) * Math.sin(2 * Math.PI * 3 * t));
      else if (kind === 'fsk') {
        phase += (2 * Math.PI * (bit ? 4 : 2)) / spb;
        samples.push(Math.sin(phase));
      } else samples.push(Math.sin(2 * Math.PI * 3 * t + (bit ? 0 : Math.PI)));
    }
    perBit.push({
      bit,
      why:
        kind === 'ask'
          ? bit
            ? '1 → carrier at full strength.'
            : '0 → carrier switched off (flat line).'
          : kind === 'fsk'
            ? bit
              ? '1 → fast wiggle (4 cycles in this bit).'
              : '0 → slow wiggle (2 cycles in this bit).'
            : bit
              ? '1 → wave starts upward as normal.'
              : '0 → wave is flipped (phase shifted by 180°).',
    });
  });
  return { samples, spb, perBit };
}

const GRAY2 = { '00': -3, '01': -1, '11': 1, '10': 3 };

/**
 * The allowed points of a constellation, Gray coded (neighbouring points differ by one bit).
 *
 * @returns {{bits:string,i:number,q:number}[]}
 */
export function constellation(kind) {
  if (kind === 'bpsk')
    return [
      { bits: '0', i: 1, q: 0 },
      { bits: '1', i: -1, q: 0 },
    ];
  if (kind === 'qpsk') {
    const s = Math.SQRT1_2;
    return ['00', '01', '11', '10'].map(b => ({ bits: b, i: b[0] === '0' ? s : -s, q: b[1] === '0' ? s : -s }));
  }
  const k = 1 / Math.sqrt(10),
    pts = [];
  for (const bi of ['00', '01', '11', '10']) for (const bq of ['00', '01', '11', '10']) pts.push({ bits: bi + bq, i: GRAY2[bi] * k, q: GRAY2[bq] * k });
  return pts;
}

const hamming = (a, b) => [...a].reduce((n, ch, k) => n + (ch !== b[k] ? 1 : 0), 0);

/**
 * Sends random symbols through a noisy channel and decides each one by the nearest allowed point.
 *
 * @param {string} kind - 'bpsk' | 'qpsk' | 'qam16'.
 * @param {number} n - number of symbols.
 * @param {number} snrDb - Es/N0 in dB.
 * @param {number} [seed]
 */
export function simulateNoise(kind, n, snrDb, seed = 1) {
  const pts = constellation(kind),
    r = rng(seed),
    sigma = Math.sqrt(1 / (2 * 10 ** (snrDb / 10)));
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const symbols = [];
  let symbolErrors = 0,
    bitErrors = 0;
  for (let k = 0; k < n; k++) {
    const idx = Math.floor(r() * pts.length),
      tx = pts[idx],
      rx = { i: tx.i + gauss() * sigma, q: tx.q + gauss() * sigma };
    let best = 0,
      bd = Infinity;
    pts.forEach((p, j) => {
      const d = (p.i - rx.i) ** 2 + (p.q - rx.q) ** 2;
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    const decided = pts[best],
      ok = best === idx,
      be = hamming(tx.bits, decided.bits);
    if (!ok) symbolErrors++;
    bitErrors += be;
    symbols.push({ idx, tx, rx, decided, ok, bitErr: be });
  }
  const bps = MODS[kind].bitsPerSym;
  return { kind, snrDb, n, symbols, symbolErrors, bitErrors, ser: n ? symbolErrors / n : 0, ber: n ? bitErrors / (n * bps) : 0, bitsPerSym: bps };
}
