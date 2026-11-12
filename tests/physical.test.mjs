import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMES, FOUR_B_FIVE_B, encode, decode, driftSim, cleanBits } from '../js/simulations/line-coding.js';
import { modulate, constellation, simulateNoise, MODS } from '../js/simulations/modulation.js';
import { nyquist, shannon, levelsNeeded, snrNeeded, limits, fmtRate, fmtHz } from '../js/simulations/channel-capacity.js';
import { simulateMux, parseDemand, fdmPlan } from '../js/simulations/multiplexing.js';
import { compareSwitching, packetTimeline } from '../js/simulations/switching.js';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

/* ---------- line coding ---------- */
test('every scheme decodes back to the original bits', () => {
  for (const bits of ['0', '1', '01001110', '00000000', '11111111', '10101010', '0110100001100101']) {
    for (const s of SCHEMES) {
      const enc = encode(s.id, bits);
      const out = decode(s.id, enc.halves);
      const want = s.id === 'fourb5b' ? bits.padEnd(Math.ceil(bits.length / 4) * 4, '0') : bits;
      assert.equal(out, want, `${s.id} on ${bits}`);
    }
  }
});

test('NRZ-L, NRZ-I and Manchester follow their rules on a known input', () => {
  assert.deepEqual(encode('nrzl', '101').halves, [1, 1, -1, -1, 1, 1]);
  // NRZ-I starts LOW: a 1 flips to HIGH, a 0 stays, a 1 flips back to LOW.
  assert.deepEqual(encode('nrzi', '101').halves, [1, 1, 1, 1, -1, -1]);
  // Manchester here: 1 = low-to-high, 0 = high-to-low.
  assert.deepEqual(encode('manchester', '10').halves, [-1, 1, 1, -1]);
});

test('Differential Manchester always has a mid-bit edge and a start edge only for 0', () => {
  const e = encode('diffman', '0110');
  for (let k = 0; k < 4; k++) assert.notEqual(e.halves[2 * k], e.halves[2 * k + 1], 'mid-bit edge');
  let prev = -1;
  '0110'.split('').forEach((b, k) => {
    const startEdge = e.halves[2 * k] !== prev;
    assert.equal(startEdge, b === '0', `bit ${k}`);
    prev = e.halves[2 * k + 1];
  });
});

test('AMI alternates polarity on 1s and sends zero volts for 0s', () => {
  assert.deepEqual(encode('ami', '1101').halves, [1, 1, -1, -1, 0, 0, 1, 1]);
});

test('4B/5B table is complete, unique, and never has more than three zeros in a row', () => {
  const codes = Object.values(FOUR_B_FIVE_B);
  assert.equal(Object.keys(FOUR_B_FIVE_B).length, 16);
  assert.equal(new Set(codes).size, 16);
  for (const c of codes) {
    assert.equal(c.length, 5);
    assert.ok(!/0000/.test(c), c);
    assert.ok(!/^000|000$/.test(c), c); // no 3 leading or 3 trailing zeros, so joins stay short
  }
  const e = encode('fourb5b', '00000000');
  assert.equal(e.lineBits, '1111011110');
  assert.equal(e.stats.baud, 1.25);
  assert.equal(encode('fourb5b', '101').padded, 1);
});

test('long zero runs: NRZ-L has a long edge-free stretch, Manchester and 4B/5B do not', () => {
  const run = '00000000';
  assert.equal(encode('nrzl', run).stats.longestRunBits, 8);
  assert.equal(encode('manchester', run).stats.longestRunBits, 0.5); // an edge every half bit
  assert.ok(encode('fourb5b', run).stats.longestRunBits <= 4);
  assert.ok(encode('ami', run).stats.longestRunBits === 8, 'AMI zeros are silent, a known weakness');
});

test('DC component: Manchester is balanced, NRZ-L of all ones is not', () => {
  assert.equal(encode('manchester', '10110010').stats.dc, 0);
  assert.equal(encode('nrzl', '1111').stats.dc, 1);
  assert.equal(encode('ami', '1111').stats.dc, 0);
});

test('cleanBits strips junk and respects the limit', () => {
  assert.equal(cleanBits('a1 0b1', 24), '101');
  assert.equal(cleanBits('1111111111', 4), '1111');
});

test('clock drift: a 5% slow clock slips at the 11th identical bit; a perfect clock never does', () => {
  assert.equal(driftSim(30, 5).firstSlip, 10);
  assert.equal(driftSim(30, 0).firstSlip, null);
  assert.equal(driftSim(30, -5).firstSlip !== null, true);
  assert.equal(driftSim(5, 5).firstSlip, null);
});

/* ---------- modulation ---------- */
test('modulate: ASK zero is flat, PSK zero is the inverse of PSK one, FSK is faster for 1', () => {
  const ask = modulate('ask', '01', 40);
  assert.ok(ask.samples.slice(0, 40).every(v => v === 0));
  assert.ok(ask.samples.slice(40).some(v => Math.abs(v) > 0.9));
  const psk1 = modulate('psk', '1', 40).samples,
    psk0 = modulate('psk', '0', 40).samples;
  psk1.forEach((v, k) => near(v, -psk0[k], 1e-9));
  const crossings = a => a.reduce((n, v, k) => n + (k && Math.sign(v) !== Math.sign(a[k - 1]) && v !== 0 ? 1 : 0), 0);
  assert.ok(crossings(modulate('fsk', '1', 40).samples) > crossings(modulate('fsk', '0', 40).samples));
  assert.equal(modulate('psk', '1011', 40).samples.length, 160);
});

test('constellations have unit average energy and Gray-coded neighbours', () => {
  for (const kind of Object.keys(MODS)) {
    const pts = constellation(kind);
    assert.equal(pts.length, 2 ** MODS[kind].bitsPerSym);
    near(pts.reduce((s, p) => s + p.i ** 2 + p.q ** 2, 0) / pts.length, 1, 1e-9);
    // nearest neighbours (smallest distance) must differ by exactly one bit
    pts.forEach(p => {
      const others = pts.filter(o => o !== p).map(o => ({ o, d: Math.hypot(o.i - p.i, o.q - p.q) }));
      const dmin = Math.min(...others.map(x => x.d));
      others
        .filter(x => Math.abs(x.d - dmin) < 1e-9)
        .forEach(({ o }) => assert.equal([...p.bits].filter((c, k) => c !== o.bits[k]).length, 1, `${kind} ${p.bits}/${o.bits}`));
    });
  }
});

test('noise: no errors at high SNR, many at low SNR, denser constellations fail first, seeds repeat', () => {
  assert.equal(simulateNoise('qam16', 2000, 35, 7).symbolErrors, 0);
  const lowB = simulateNoise('bpsk', 4000, 0, 3);
  assert.ok(lowB.ber > 0.05 && lowB.ber < 0.11, `BPSK BER at 0 dB was ${lowB.ber}`); // theory: Q(sqrt 2) ≈ 0.079
  const at = k => simulateNoise(k, 4000, 6, 5).ser;
  assert.ok(at('bpsk') < at('qpsk') && at('qpsk') < at('qam16'));
  assert.deepEqual(simulateNoise('qpsk', 50, 8, 9).symbols.map(s => s.ok), simulateNoise('qpsk', 50, 8, 9).symbols.map(s => s.ok));
});

/* ---------- capacity ---------- */
test('Shannon and Nyquist match textbook numbers', () => {
  near(shannon(3100, 30), 3100 * Math.log2(1001), 1e-6); // ≈ 30.9 kbit/s
  assert.equal(Math.round(shannon(3100, 30)), 30898);
  assert.equal(nyquist(3000, 2), 6000);
  assert.equal(nyquist(3000, 4), 12000);
  near(levelsNeeded(3000, 12000), 4, 1e-9);
  near(snrNeeded(1000, 1000), 10 * Math.log10(1), 1e-9); // 1 bit/s/Hz needs 0 dB
  near(snrNeeded(1, 3), 10 * Math.log10(7), 1e-9);
});

test('limits() reports which bound bites', () => {
  const noisy = limits(3100, 10, 256);
  assert.equal(noisy.limitedBy, 'noise');
  assert.equal(noisy.rate, noisy.shan);
  const coarse = limits(3100, 60, 2);
  assert.equal(coarse.limitedBy, 'levels');
  near(limits(1000, 20, 8).usableLevels, Math.sqrt(101), 1e-9);
});

test('formatters', () => {
  assert.equal(fmtRate(30898), '30.9 kbit/s');
  assert.equal(fmtRate(79.7e6), '79.7 Mbit/s');
  assert.equal(fmtRate(500), '500 bit/s');
  assert.equal(fmtHz(6e6), '6 MHz');
  assert.equal(fmtHz(3100), '3.1 kHz');
});

/* ---------- multiplexing ---------- */
test('sync TDM wastes slots that statistical TDM can reuse', () => {
  const demand = ['100100', '010010', '001001', '000000'].map(s => parseDemand(s, 6));
  const sync = simulateMux(demand, 'sync', 0),
    stat = simulateMux(demand, 'stat', 2);
  assert.equal(sync.sent, 6);
  assert.equal(sync.slotsTotal, 24);
  assert.equal(sync.wasted, 18);
  assert.equal(sync.avgDelay, 0);
  assert.equal(stat.sent, 6);
  assert.equal(stat.slotsTotal, 12);
  assert.ok(stat.util > sync.util);
});

test('statistical TDM queues data when demand exceeds capacity', () => {
  const demand = ['111', '111', '111'].map(s => parseDemand(s, 3));
  const stat = simulateMux(demand, 'stat', 1);
  assert.equal(stat.sent, 3);
  assert.equal(stat.leftover, 6);
  assert.ok(stat.maxQueue >= 6);
});

test('FDM plan adds guard bands only between channels', () => {
  const p = fdmPlan(4, 100, 10);
  assert.equal(p.total, 430);
  assert.deepEqual(p.bands[1], { lo: 110, hi: 210 });
  assert.equal(fdmPlan(0, 100, 10).total, 0);
});

/* ---------- switching ---------- */
test('store-and-forward delays match the classic results', () => {
  // 8 Mbit over 3 hops at 1 Mbit/s: message switching is 3x8 = 24 s.
  const c = compareSwitching({ bits: 8e6, rate: 1e6, hops: 3, prop: 0, setup: 0, payload: 8000, header: 0 });
  near(c.message, 24, 1e-9);
  // 1000 packets of 8000 bits: (1000 + 3 - 1) * 8 ms = 8.016 s.
  near(c.packet, 8.016, 1e-9);
  assert.equal(c.n, 1000);
  near(c.circuit, 8, 1e-9);
  assert.ok(c.packet < c.message);
});

test('headers add overhead and propagation adds hops*prop', () => {
  const c = compareSwitching({ bits: 8000, rate: 1e6, hops: 2, prop: 0.01, setup: 0.05, payload: 4000, header: 400 });
  assert.equal(c.n, 2);
  assert.equal(c.overheadBits, 800);
  near(c.circuit, 0.05 + 0.008 + 0.02, 1e-9);
  near(c.packet, (2 + 2 - 1) * (4400 / 1e6) + 0.02, 1e-9);
});

test('packet timeline pipelines packets across links', () => {
  const t = packetTimeline(3, 2, 1);
  assert.equal(t.length, 6);
  assert.deepEqual(t.find(x => x.packet === 2 && x.link === 1), { link: 1, packet: 2, start: 3, end: 4 });
  assert.equal(Math.max(...t.map(x => x.end)), 4); // (3 + 2 - 1) * 1
});
