/**
 * channel capacity: Nyquist and Shannon
 *
 * Nyquist: a noiseless channel of bandwidth B carries at most 2B symbols per second, so with L signal levels the bit
 * rate is 2 * B * log2(L). Shannon: with noise, no coding can beat C = B * log2(1 + SNR), whatever the number of levels.
 * The usable rate is the smaller of the two for the chosen L.
 *
 * Imports: (none)
 *
 * Exports: PRESETS, dbToLinear, fmtHz, fmtRate, levelsNeeded, limits, nyquist, shannon, snrNeeded
 *
 * Used by: modules/link-layer/channel-capacity.js, tests/physical.test.mjs
 */

/** Example channels. Rates are theoretical upper bounds, not what a real product delivers. */
export const PRESETS = [
  { id: 'phone', name: 'Old telephone line (3.1 kHz, 30 dB)', bw: 3100, snrDb: 30, levels: 16 },
  { id: 'cable', name: 'One cable-TV channel (6 MHz, 40 dB)', bw: 6e6, snrDb: 40, levels: 256 },
  { id: 'wifi', name: 'Wi-Fi 20 MHz channel (25 dB)', bw: 20e6, snrDb: 25, levels: 64 },
];

export const dbToLinear = db => 10 ** (db / 10);

/** Noiseless limit in bit/s: 2 * B * log2(L). */
export const nyquist = (bw, levels) => 2 * bw * Math.log2(levels);

/** Noisy limit in bit/s: B * log2(1 + SNR). */
export const shannon = (bw, snrDb) => bw * Math.log2(1 + dbToLinear(snrDb));

/** How many levels Nyquist needs to reach a target rate. */
export const levelsNeeded = (bw, rate) => 2 ** (rate / (2 * bw));

/** SNR in dB that Shannon requires to reach a target rate. */
export const snrNeeded = (bw, rate) => 10 * Math.log10(2 ** (rate / bw) - 1);

/**
 * Combines both limits.
 *
 * @returns {{nyq:number, shan:number, rate:number, limitedBy:'noise'|'levels', usableLevels:number}}
 *   usableLevels = sqrt(1 + SNR): the number of levels the noise still lets a receiver tell apart.
 */
export function limits(bw, snrDb, levels) {
  const nyq = nyquist(bw, levels),
    shan = shannon(bw, snrDb);
  return {
    nyq,
    shan,
    rate: Math.min(nyq, shan),
    limitedBy: shan < nyq ? 'noise' : 'levels',
    usableLevels: Math.sqrt(1 + dbToLinear(snrDb)),
  };
}

/** Formats a bit rate, e.g. 30898 → "30.9 kbit/s". */
export function fmtRate(bps) {
  const u = [
    [1e9, 'Gbit/s'],
    [1e6, 'Mbit/s'],
    [1e3, 'kbit/s'],
  ].find(([v]) => bps >= v);
  return u ? `${(bps / u[0]).toFixed(bps / u[0] >= 100 ? 0 : 1)} ${u[1]}` : `${Math.round(bps)} bit/s`;
}

/** Formats a bandwidth, e.g. 6000000 → "6 MHz". */
export function fmtHz(hz) {
  if (hz >= 1e9) return `${+(hz / 1e9).toFixed(2)} GHz`;
  if (hz >= 1e6) return `${+(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1e3) return `${+(hz / 1e3).toFixed(2)} kHz`;
  return `${+hz.toFixed(1)} Hz`;
}
