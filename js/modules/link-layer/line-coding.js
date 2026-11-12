/**
 * learning module: Line coding
 *
 * Type bits, pick a scheme (NRZ-L, NRZ-I, Manchester, Differential Manchester, Bipolar AMI, 4B/5B) and watch the voltage
 * waveform being drawn bit by bit. Compare every scheme on the same data, and see why a receiver needs edges to keep its
 * clock. Layered explanations (with an everyday analogy) and an animated "show the working" player are included.
 *
 * Imports:
 *   - ../../core/ui-helpers.js: hn, on, panel, sel, statRow, vd
 *   - ../../core/utils.js: $, esc
 *   - ../../core/learn-kit.js: kitStyles, layers, showWorking
 *   - ../../core/wave-svg.js: levelWave
 *   - ../../simulations/line-coding.js: SCHEMES, cleanBits, decode, driftSim, encode, levelName
 *   - ../registry.js: regMod
 *   - ../../app/progress.js: flag
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { hn, panel, sel, statRow, vd } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { kitStyles, layers, showWorking } from '../../core/learn-kit.js';
import { levelWave } from '../../core/wave-svg.js';
import { SCHEMES, cleanBits, decode, driftSim, encode, levelName } from '../../simulations/line-coding.js';
import { regMod } from '../registry.js';
import { flag } from '../../app/progress.js';

const RULES = {
  nrzl: 'The voltage level <b>is</b> the bit: HIGH for 1, LOW for 0. Nothing else is added.',
  nrzi: 'A <b>1</b> flips the level at the start of the bit; a <b>0</b> leaves it alone. The line starts LOW.',
  manchester:
    'Every bit has an edge in the middle. In this lesson a <b>1</b> goes low-to-high and a <b>0</b> goes high-to-low. (Standards disagree on which way round; see “Under the hood”.)',
  diffman:
    'Every bit has an edge in the middle. The data is carried by the start of the bit: a <b>0</b> has an extra edge there, a <b>1</b> does not.',
  ami: 'A <b>0</b> is zero volts. A <b>1</b> is a pulse whose sign alternates: +, −, +, − …, so the average stays near zero.',
  fourb5b:
    'First every group of 4 data bits is swapped for a 5-bit code word that never has a long run of zeros. Then the 5-bit stream is sent with NRZ-I.',
};

const PRESETS = [
  ['', 'Choose an example…'],
  ['01001110', 'Mixed bits'],
  ['00000000', 'Long run of 0s'],
  ['11111111', 'Long run of 1s'],
  ['10101010', 'Alternating 1010…'],
  ['01001000', 'The letter H in ASCII'],
];

const EXPLAIN = {
  analogy: {
    emoji: '🔦',
    title: 'Signalling across a valley with a torch',
    text: 'You and a friend agree: <b>torch on means 1, torch off means 0</b>. It works until you send a hundred 0s in a row. All your friend sees is darkness, and they lose count of how long it lasted. Line coding is the set of tricks that keep the “light” changing often enough that nobody loses count.',
  },
  plain: `<p>Computers think in 0s and 1s, but a cable can only carry voltages. <b>Line coding</b> is the agreement about which voltage pattern means which bit.</p>
    <p>The obvious plan (high voltage = 1, low = 0) has two problems. A long run of the same bit looks like a flat line, so the receiver loses its place. And the average voltage can drift away from zero, which some cables and transformers cannot carry.</p>
    <p>Cleverer schemes put a change <i>inside</i> every bit, or flip the voltage when a 1 arrives. Try <code>00000000</code> below and compare: only some schemes keep “ticking”.</p>`,
  how: `<p>Each scheme is a different answer to three questions:</p>
    <ul><li><b>Can the receiver find the bit boundaries?</b> It needs voltage changes (edges) to keep its clock in step.</li>
    <li><b>Does the average voltage stay near zero?</b> (“DC balance”.)</li>
    <li><b>How fast must the line change?</b> More changes per bit means more bandwidth.</li></ul>
    <ol><li><b>NRZ-L</b>: the level is the bit. Simplest, but a long run is a flat line.</li>
    <li><b>NRZ-I</b>: a 1 flips the level. Runs of 1s now toggle, but runs of 0s still go flat.</li>
    <li><b>Manchester</b>: an edge in the middle of every bit, so there is always something to lock onto. Costs twice the signal changes.</li>
    <li><b>Differential Manchester</b>: also an edge in every bit, but the data is whether there is an edge at the <i>start</i>. Swapping the two wires does not change the meaning.</li>
    <li><b>Bipolar AMI</b>: three levels; 1s alternate + and −, so the average is zero. Long runs of 0 are silent, though.</li>
    <li><b>4B/5B + NRZ-I</b>: re-code each 4 data bits as a 5-bit word with no long run of zeros, then send with NRZ-I. Costs 25% more signal changes.</li></ol>`,
  deep: `<p><b>Bit rate vs baud.</b> Manchester needs two signal elements per bit, so 10 Mbit/s Ethernet (10BASE-T) switches at 20 million times a second. 4B/5B sends 5 elements for every 4 bits, so Fast Ethernet over fibre and FDDI, which use 4B/5B with NRZ-I, run a 100 Mbit/s data rate at 125 Mbaud.</p>
    <p><b>Clock recovery.</b> The receiver’s clock is never exactly the sender’s. If it is off by a fraction <i>d</i> of a bit, then <i>k</i> bits after the last edge it is off by <i>k·d</i>. Once that reaches half a bit it samples the wrong bit. The drift panel below shows this directly: a 5% error slips after 10 identical bits.</p>
    <p><b>DC balance.</b> Transformers and capacitors block a steady voltage, so a long run of 1s in NRZ-L makes the signal “droop” and decode wrongly. Manchester and AMI average to zero.</p>
    <p><b>AMI’s weakness.</b> A long run of zeros is silent, so real systems add substitution rules (B8ZS on T1, HDB3 on E1) that insert deliberate pulse violations.</p>
    <p><b>4B/5B.</b> Of the 32 possible 5-bit words, 16 carry data and the rest are used for control symbols such as idle and start-of-frame. The data words are chosen so that no more than three 0s ever appear in a row, even where two words join.</p>
    <p><b>Conventions differ.</b> NRZ-L polarity varies between textbooks, and two opposite Manchester conventions exist (G. E. Thomas and IEEE 802.3 map 0 and 1 to opposite edges). This lesson uses: NRZ-L 1 = high; Manchester 1 = low-to-high. Check which convention your course uses before an exam.</p>`,
  map: [
    ['Torch on / torch off', 'High / low voltage'],
    ['Counting seconds between flashes', 'The receiver’s clock, sampling in the middle of each bit'],
    ['A long dark stretch', 'A long run of identical bits with no edge'],
    ['A “tick” flash before every message flash', 'Manchester: an edge in every single bit'],
    ['Agreeing “flip the torch for a 1”', 'NRZ-I and the differential schemes'],
  ],
};

regMod({
  id: 'linecoding',
  group: 'link',
  title: 'Line coding: bits to voltages',
  desc: 'See how NRZ, Manchester, AMI and 4B/5B turn bits into a voltage waveform, and why the receiver needs the signal to keep changing.',
  obj: [
    'Draw the waveform for a bit string under each line-coding scheme.',
    'Explain why long runs of identical bits cause clock-recovery trouble.',
    'Compare edges, average level and signal rate between schemes.',
  ],
  mount(root) {
    kitStyles();
    root.innerHTML =
      panel('Learn it at your level', '<div id="lc-layers"></div>') +
      panel(
        'Choose bits and a scheme',
        `<div class="controls"><div class="field grow"><label for="lc-bits">Data bits (up to 24)</label><input id="lc-bits" value="01001110" maxlength="24" inputmode="numeric" autocomplete="off" spellcheck="false"></div>
        <div class="field"><label for="lc-pre">Try an example</label>${sel('lc-pre', PRESETS, '')}</div>
        <div class="field"><label for="lc-scheme">Scheme</label>${sel('lc-scheme', SCHEMES.map(s => [s.id, s.name]), 'manchester')}</div></div>
        <p class="hint" id="lc-rule"></p>`
      ) +
      panel('The signal', '<div id="lc-wave"></div><div id="lc-stats"></div><div id="lc-note"></div>') +
      panel('Show the working', '<div id="lc-work"></div>', 'Step through how each bit becomes a voltage, with the waveform drawn as you go.') +
      panel('Compare every scheme on the same bits', '<div id="lc-cmp"></div>') +
      panel(
        'Why edges matter: receiver clock drift',
        `<p class="hint">After the last edge the receiver has only its own clock to count with. If that clock is a little off, it eventually samples the wrong bit. Red ticks are wrong samples.</p>
        <div class="controls"><div class="field"><label for="lc-run">Identical bits in a row</label><input id="lc-run" type="number" min="2" max="30" value="14"></div>
        <div class="field"><label for="lc-drift">Receiver clock error</label>${sel('lc-drift', [[1, '1% slow'], [2, '2% slow'], [5, '5% slow'], [10, '10% slow'], [-5, '5% fast']], 5)}</div></div>
        <div id="lc-drift-out"></div>`
      );
    const cleanups = [layers($('#lc-layers', root), EXPLAIN)];
    const work = showWorking($('#lc-work', root), { onOpen: () => flag('lc_working') });
    cleanups.push(() => work.destroy());

    const bitsNow = () => cleanBits($('#lc-bits', root).value);
    const schemeNow = () => $('#lc-scheme', root).value;
    const labelsOf = enc => enc.lineBits.split('');

    function buildSteps(enc) {
      if (!enc.lineBits) return [];
      const steps = [];
      if (enc.id === 'fourb5b') {
        steps.push({
          title: 'The rule',
          text: RULES.fourb5b,
          html: `<div class="lk-in">${enc.groups.slice(0, 4).map(g => `<span class="lk-chip c0">${g.nibble}</span><span class="lk-op"> → </span><span class="lk-chip c2">${g.code}</span><br>`).join('')}${enc.groups.length > 4 ? '<p class="hint">…and so on for each group of 4 bits.</p>' : ''}</div>`,
        });
        enc.groups.slice(0, 4).forEach((g, k) => {
          const last = k === enc.groups.length - 1 && enc.padded;
          steps.push({
            title: `Group ${k + 1}: ${g.nibble} → ${g.code}`,
            text: `Look the 4 bits up in the 4B/5B table and send the 5-bit word instead.${last ? ` (${enc.padded} zero bit${enc.padded > 1 ? 's were' : ' was'} added to fill the group.)` : ''}`,
            html: `<div class="lk-row"><span class="lk-chip c0 lk-pop">${g.nibble}</span><span class="lk-op lk-in" style="--d:.3s">→</span><span class="lk-chip c2 lk-pop" style="--d:.5s">${g.code}</span></div><p class="hint">Stream so far: <code>${esc(enc.groups.slice(0, k + 1).map(x => x.code).join(' '))}</code></p>`,
          });
        });
      } else {
        const [z, o] = [encode(enc.id, '0'), encode(enc.id, '1')];
        steps.push({
          title: 'The rule',
          text: RULES[enc.id],
          html: `<div class="lk-row"><div class="lk-in" style="flex:1;min-width:200px"><b>a 0</b>${levelWave({ halves: z.halves, labels: ['0'], w: 300, h: 100, name: 'Zero' })}</div><div class="lk-in" style="--d:.3s;flex:1;min-width:200px"><b>a 1</b>${levelWave({ halves: o.halves, labels: ['1'], w: 300, h: 100, name: 'One' })}</div></div><p class="hint">The line is idle LOW before the first bit.</p>`,
        });
      }
      const cap = Math.min(enc.perBit.length, 16);
      const labels = labelsOf(enc);
      for (let k = 0; k < cap; k++) {
        const p = enc.perBit[k];
        steps.push({
          title: `${enc.id === 'fourb5b' ? 'Line bit' : 'Bit'} ${k + 1} is ${p.bit}`,
          text:
            p.why +
            (p.group !== undefined ? ` (Part of code word ${p.group + 1}: <code>${enc.groups[p.group].code}</code>.)` : ''),
          html: () =>
            levelWave({ halves: enc.halves, labels, upTo: k + 1, hot: k, name: enc.name }) +
            `<p class="hint">First half <b>${levelName(p.first)}</b>, second half <b>${levelName(p.second)}</b>.</p>`,
        });
      }
      const s = enc.stats;
      steps.push({
        title: 'Summary',
        text: `${enc.perBit.length > cap ? `Showed the first ${cap} of ${enc.perBit.length} bits. ` : ''}Three numbers describe how good the waveform is for the receiver.`,
        html: () =>
          levelWave({ halves: enc.halves, labels, name: enc.name }) +
          statRow([
            [s.transitions, 'edges in total'],
            [s.longestRunBits, 'longest edge-free stretch (bits)'],
            [s.dc, 'average level (0 is balanced)'],
            [s.baud, 'signal elements per data bit'],
          ]),
      });
      return steps;
    }

    function refreshMain() {
      const bits = bitsNow(),
        id = schemeNow(),
        scheme = SCHEMES.find(s => s.id === id);
      $('#lc-rule', root).innerHTML = `<b>${esc(scheme.name)}.</b> ${RULES[id]}`;
      if (!bits) {
        $('#lc-wave', root).innerHTML = vd('warn', 'Enter some bits.', 'Type 0s and 1s, or pick an example.');
        $('#lc-stats', root).innerHTML = $('#lc-note', root).innerHTML = '';
        $('#lc-cmp', root).innerHTML = '';
        work.setSteps([]);
        return;
      }
      const enc = encode(id, bits),
        s = enc.stats;
      $('#lc-wave', root).innerHTML =
        levelWave({ halves: enc.halves, labels: labelsOf(enc), name: enc.name }) +
        (id === 'fourb5b' ? hn(`The wave shows the ${enc.lineBits.length} line bits that are really sent: <code>${esc(enc.lineBits)}</code>${enc.padded ? ` (${enc.padded} zero bit${enc.padded > 1 ? 's' : ''} added to fill the last group of 4)` : ''}.`) : '');
      $('#lc-stats', root).innerHTML = statRow([
        [s.transitions, 'edges'],
        [s.longestRunBits, 'longest edge-free stretch (bits)'],
        [s.dc, 'average level'],
        [s.baud, 'signal elements per bit'],
      ]);
      const back = decode(id, enc.halves),
        want = id === 'fourb5b' ? bits.padEnd(enc.groups.length * 4, '0') : bits;
      $('#lc-note', root).innerHTML =
        (s.longestRunBits >= 4
          ? vd('warn', 'Long stretch with no edge.', `${s.longestRunBits} bit-times pass with no change, so a receiver that relies on edges could lose its place here.`)
          : vd('ok', 'Edges are frequent.', 'The receiver gets regular chances to re-align its clock.')) +
        (Math.abs(s.dc) > 0.5
          ? vd('warn', 'The average level is far from zero.', 'Cables and transformers that block steady (DC) voltage would distort this signal.')
          : '') +
        (back === want
          ? vd('ok', 'The receiver decodes the same bits.', `<code>${esc(back)}</code>`)
          : vd('bad', 'Decoding failed.', 'The receiver could not recover the data.'));
      work.setSteps(buildSteps(enc));
      renderCompare(bits);
    }

    function renderCompare(bits) {
      $('#lc-cmp', root).innerHTML =
        '<p class="hint">The same data under every scheme. Look at which signals keep changing and which stay flat.</p>' +
        SCHEMES.map(sc => {
          const e = encode(sc.id, bits);
          return `<div class="lk-in"><h4>${esc(sc.name)} <small class="hint">${esc(sc.tag)}</small></h4>${levelWave({ halves: e.halves, labels: e.lineBits.split(''), h: 104, name: sc.name })}<p class="hint">${e.stats.transitions} edges · longest edge-free stretch ${e.stats.longestRunBits} bits · average level ${e.stats.dc}</p></div>`;
        }).join('');
    }

    function refreshDrift() {
      const run = Math.max(2, Math.min(30, Math.floor(+$('#lc-run', root).value) || 2)),
        pct = Number($('#lc-drift', root).value),
        sim = driftSim(run, pct);
      const w = 720,
        pad = 14,
        top = 26;
      const total = Math.max(run, Math.ceil(sim.samples[sim.samples.length - 1].t) + 1),
        bw = (w - 2 * pad) / total;
      let svg = `<svg class="lk-svg" viewBox="0 0 ${w} 120" role="img" aria-label="Receiver sampling ticks against bit slots">`;
      for (let k = 0; k < run; k++) svg += `<rect class="lk-slot" x="${(pad + k * bw).toFixed(1)}" y="${top}" width="${bw.toFixed(1)}" height="50"/><text class="lk-lbl" x="${(pad + (k + 0.5) * bw).toFixed(1)}" y="${top + 68}">${k + 1}</text>`;
      svg += `<line class="lk-flat" x1="${pad}" y1="${top + 25}" x2="${(pad + run * bw).toFixed(1)}" y2="${top + 25}"/>`;
      sim.samples.forEach(s => {
        const x = (pad + s.t * bw).toFixed(1);
        svg += `<line class="${s.ok ? 'lk-tok' : 'lk-tbad'} lk-pop" style="--d:${(s.k * 0.06).toFixed(2)}s" x1="${x}" y1="${top - 6}" x2="${x}" y2="${top + 56}"/>`;
      });
      svg += `<text class="lk-sub" x="${pad}" y="14">Bit slots (numbered) and the receiver’s sampling ticks</text></svg>`;
      $('#lc-drift-out', root).innerHTML =
        svg +
        (sim.firstSlip === null
          ? vd('ok', `The receiver stays in step for all ${run} bits.`, 'Try a longer run or a larger clock error.')
          : vd('warn', `The receiver slips at bit ${sim.firstSlip + 1}.`, `With a ${Math.abs(pct)}% ${pct > 0 ? 'slow' : 'fast'} clock, ${sim.firstSlip} identical bits in a row is the most it can count safely. A scheme with an edge in every bit (Manchester) never lets the gap grow that long.`));
    }

    $('#lc-bits', root).oninput = refreshMain;
    $('#lc-bits', root).onchange = e => {
      e.target.value = bitsNow();
    };
    $('#lc-pre', root).onchange = e => {
      if (e.target.value) {
        $('#lc-bits', root).value = e.target.value;
        refreshMain();
      }
    };
    $('#lc-scheme', root).onchange = () => {
      flag('lc_scheme');
      refreshMain();
    };
    $('#lc-run', root).oninput = refreshDrift;
    $('#lc-drift', root).onchange = refreshDrift;
    refreshMain();
    refreshDrift();
    return () => cleanups.forEach(f => f());
  },
});
