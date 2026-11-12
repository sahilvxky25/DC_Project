/**
 * line coding: how bits become voltage levels
 *
 * Encoders (and matching decoders) for six classic schemes. A signal is described as "halves": two voltage levels per
 * bit time (the first and second half of the bit), each -1, 0 or +1. That is enough to draw every scheme and to count
 * transitions, and it keeps the maths free of any DOM.
 *
 * Conventions used here (textbooks differ, so the on-screen text says so):
 *   NRZ-L: 1 = high, 0 = low.            NRZ-I: 1 = flip at the start of the bit, 0 = stay.
 *   Manchester: 1 = low-to-high in the middle, 0 = high-to-low.   (IEEE 802.3 and G. E. Thomas use opposite rules.)
 *   Differential Manchester: always a mid-bit transition; 0 = also a transition at the start, 1 = none at the start.
 *   Bipolar AMI: 0 = zero volts, 1 = alternating +/- pulses.
 * The line is assumed idle LOW before the first bit.
 *
 * Imports: (none)
 *
 * Exports: FOUR_B_FIVE_B, SCHEMES, cleanBits, decode, driftSim, encode, levelName
 *
 * Used by: modules/link-layer/line-coding.js, tests/physical.test.mjs
 */

/** The standard 4B/5B table: every 4-bit group gets a 5-bit code with at most three zeros in a row. */
export const FOUR_B_FIVE_B = {
  '0000': '11110',
  '0001': '01001',
  '0010': '10100',
  '0011': '10101',
  '0100': '01010',
  '0101': '01011',
  '0110': '01110',
  '0111': '01111',
  '1000': '10010',
  '1001': '10011',
  '1010': '10110',
  '1011': '10111',
  '1100': '11010',
  '1101': '11011',
  '1110': '11100',
  '1111': '11101',
};
const FIVE_TO_FOUR = Object.fromEntries(Object.entries(FOUR_B_FIVE_B).map(([k, v]) => [v, k]));

/** Scheme list: baud = signal elements per data bit (how fast the line must change for a given bit rate). */
export const SCHEMES = [
  { id: 'nrzl', name: 'NRZ-L', baud: 1, tag: 'The level is the bit' },
  { id: 'nrzi', name: 'NRZ-I', baud: 1, tag: 'A 1 flips the level' },
  { id: 'manchester', name: 'Manchester', baud: 2, tag: 'Every bit has a mid-bit edge' },
  { id: 'diffman', name: 'Differential Manchester', baud: 2, tag: 'Mid-bit edge always; start edge carries the bit' },
  { id: 'ami', name: 'Bipolar AMI', baud: 1, tag: 'Three levels; 1s alternate +/-' },
  { id: 'fourb5b', name: '4B/5B + NRZ-I', baud: 1.25, tag: 'Block code that breaks long zero runs' },
];

/** Keeps only 0 and 1 characters, up to max of them. */
export const cleanBits = (s, max = 24) => String(s).replace(/[^01]/g, '').slice(0, max);

export const levelName = v => (v > 0 ? 'HIGH' : v < 0 ? 'LOW' : 'ZERO');

const rep = v => [v, v];

/* NRZ-I over a bit string; used by NRZ-I itself and by 4B/5B. Returns the halves and the per-bit explanations. */
function nrziRun(bits, groupOf = null) {
  const halves = [],
    perBit = [];
  let prev = -1;
  [...bits].forEach((ch, k) => {
    const bit = Number(ch),
      level = bit ? -prev : prev;
    perBit.push({
      bit,
      first: level,
      second: level,
      group: groupOf ? groupOf(k) : undefined,
      why: bit
        ? `1 → flip at the start of the bit (${levelName(prev)} → ${levelName(level)}), then hold.`
        : `0 → no change, stay ${levelName(level)}.`,
    });
    halves.push(...rep(level));
    prev = level;
  });
  return { halves, perBit };
}

/**
 * Encodes bits with one scheme.
 *
 * @param {string} id - a SCHEMES id.
 * @param {string} bitStr - the data bits.
 * @returns {{id:string,name:string,input:string,lineBits:string,halves:number[],perBit:Object[],groups?:Object[],padded?:number,stats:Object}}
 */
export function encode(id, bitStr) {
  const input = cleanBits(bitStr, 64);
  const scheme = SCHEMES.find(s => s.id === id) || SCHEMES[0];
  let halves = [],
    perBit = [],
    lineBits = input,
    groups,
    padded = 0;
  if (id === 'nrzl') {
    [...input].forEach(ch => {
      const bit = Number(ch),
        v = bit ? 1 : -1;
      perBit.push({ bit, first: v, second: v, why: bit ? '1 → HIGH for the whole bit.' : '0 → LOW for the whole bit.' });
      halves.push(...rep(v));
    });
  } else if (id === 'nrzi') {
    ({ halves, perBit } = nrziRun(input));
  } else if (id === 'manchester') {
    [...input].forEach(ch => {
      const bit = Number(ch),
        a = bit ? -1 : 1;
      perBit.push({
        bit,
        first: a,
        second: -a,
        why: bit ? '1 → low-to-high edge in the middle of the bit.' : '0 → high-to-low edge in the middle of the bit.',
      });
      halves.push(a, -a);
    });
  } else if (id === 'diffman') {
    let prev = -1;
    [...input].forEach(ch => {
      const bit = Number(ch),
        a = bit ? prev : -prev;
      perBit.push({
        bit,
        first: a,
        second: -a,
        why: bit
          ? `1 → no edge at the start (stay ${levelName(a)}), then an edge in the middle.`
          : `0 → an edge at the start (${levelName(prev)} → ${levelName(a)}), then another in the middle.`,
      });
      halves.push(a, -a);
      prev = -a;
    });
  } else if (id === 'ami') {
    let pulse = -1;
    [...input].forEach(ch => {
      const bit = Number(ch);
      if (bit) {
        pulse = -pulse;
        perBit.push({ bit, first: pulse, second: pulse, why: `1 → a ${pulse > 0 ? 'positive' : 'negative'} pulse (1s alternate polarity).` });
        halves.push(...rep(pulse));
      } else {
        perBit.push({ bit, first: 0, second: 0, why: '0 → zero volts.' });
        halves.push(0, 0);
      }
    });
  } else if (id === 'fourb5b') {
    padded = (4 - (input.length % 4)) % 4;
    const data = input + '0'.repeat(padded);
    groups = [];
    for (let k = 0; k < data.length; k += 4) {
      const nibble = data.slice(k, k + 4);
      groups.push({ nibble, code: FOUR_B_FIVE_B[nibble] });
    }
    lineBits = groups.map(g => g.code).join('');
    ({ halves, perBit } = nrziRun(lineBits, k => Math.floor(k / 5)));
  }
  return { id, name: scheme.name, input, lineBits, halves, perBit, groups, padded, stats: lineStats(halves, input.length, scheme.baud) };
}

/**
 * Measures a waveform: edges, the longest stretch with no edge, and the average level (the "DC" part).
 */
export function lineStats(halves, dataBits, baud = 1) {
  let transitions = 0,
    run = 1,
    longest = halves.length ? 1 : 0;
  for (let j = 1; j < halves.length; j++) {
    if (halves[j] !== halves[j - 1]) {
      transitions++;
      run = 1;
    } else {
      run++;
      if (run > longest) longest = run;
    }
  }
  const dc = halves.length ? halves.reduce((a, b) => a + b, 0) / halves.length : 0;
  return {
    transitions,
    longestRunBits: longest / 2,
    dc: Math.round(dc * 1000) / 1000,
    baud,
    dataBits,
  };
}

/**
 * Decodes halves back to bits (the receiver's job). For 4B/5B the result includes any padding zeros.
 *
 * @returns {string} the bits, or '' when a 4B/5B code word is not valid.
 */
export function decode(id, halves) {
  const n = Math.floor(halves.length / 2);
  let out = '';
  if (id === 'nrzl') for (let k = 0; k < n; k++) out += halves[2 * k] > 0 ? '1' : '0';
  else if (id === 'nrzi' || id === 'fourb5b') {
    let prev = -1,
      bits = '';
    for (let k = 0; k < n; k++) {
      bits += halves[2 * k] !== prev ? '1' : '0';
      prev = halves[2 * k];
    }
    if (id === 'nrzi') return bits;
    for (let k = 0; k + 5 <= bits.length; k += 5) {
      const nib = FIVE_TO_FOUR[bits.slice(k, k + 5)];
      if (!nib) return '';
      out += nib;
    }
  } else if (id === 'manchester') for (let k = 0; k < n; k++) out += halves[2 * k] < halves[2 * k + 1] ? '1' : '0';
  else if (id === 'diffman') {
    let prev = -1;
    for (let k = 0; k < n; k++) {
      out += halves[2 * k] === prev ? '1' : '0';
      prev = halves[2 * k + 1];
    }
  } else if (id === 'ami') for (let k = 0; k < n; k++) out += halves[2 * k] !== 0 ? '1' : '0';
  return out;
}

/**
 * Receiver clock drift. After the last edge the receiver samples at its own pace; if its clock runs fast or slow it
 * eventually samples the wrong bit. Edges re-synchronise it, so long runs without edges are the danger.
 *
 * @param {number} run - number of identical bits in a row with no edge.
 * @param {number} driftPct - receiver clock error in percent (positive = slow clock, negative = fast).
 * @returns {{samples:{k:number,t:number,idx:number,ok:boolean}[], firstSlip:(number|null)}}
 */
export function driftSim(run, driftPct) {
  const tr = 1 + driftPct / 100,
    samples = [];
  let firstSlip = null;
  for (let k = 0; k < run; k++) {
    const t = tr * (k + 0.5),
      idx = Math.floor(t),
      ok = idx === k;
    samples.push({ k, t, idx, ok });
    if (!ok && firstSlip === null) firstSlip = k;
  }
  return { samples, firstSlip };
}
