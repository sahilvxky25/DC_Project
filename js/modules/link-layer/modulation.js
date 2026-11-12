/**
 * learning module: Modulation
 *
 * Put bits on a carrier wave with ASK, FSK and PSK and watch the wave being drawn bit by bit, then explore constellations
 * (BPSK, QPSK, 16-QAM) and what noise does to them. Layered explanations and animated "show the working" players are
 * included for both halves.
 *
 * Imports:
 *   - ../../core/ui-helpers.js: hn, panel, sel, statRow, tbl, vd
 *   - ../../core/utils.js: $, esc
 *   - ../../core/learn-kit.js: kitStyles, layers, showWorking
 *   - ../../core/wave-svg.js: analogWave, constellationSvg
 *   - ../../simulations/modulation.js: MODS, SCHEMES_ANALOG, constellation, modulate, simulateNoise
 *   - ../../simulations/line-coding.js: cleanBits
 *   - ../registry.js: regMod
 *   - ../../app/progress.js: flag
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { hn, panel, sel, statRow, tbl, vd } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { kitStyles, layers, showWorking } from '../../core/learn-kit.js';
import { analogWave, constellationSvg } from '../../core/wave-svg.js';
import { MODS, SCHEMES_ANALOG, constellation, modulate, simulateNoise } from '../../simulations/modulation.js';
import { cleanBits } from '../../simulations/line-coding.js';
import { regMod } from '../registry.js';
import { flag } from '../../app/progress.js';

const SPB = 40;

const EXPLAIN = {
  analogy: {
    emoji: '🎵',
    title: 'Humming a message across a field',
    text: 'You and a friend agree on a code. <b>Hum loudly for 1, quietly for 0</b>: that is ASK. <b>Hum a high note for 1, a low note for 0</b>: that is FSK. <b>Start your hum at a slightly different moment</b> for 1 and 0: that is PSK. The steady hum is the carrier; the way you change it is the message.',
  },
  plain: `<p>Radio, fibre and long cables cannot carry sharp on/off pulses well. They carry a smooth, repeating wave instead, called the <b>carrier</b>.</p>
    <p><b>Modulation</b> means changing one thing about that wave on purpose so it carries bits: how tall it is, how fast it wiggles, or where in its cycle it starts.</p>
    <p>To go faster, send more than one bit per change. Pick from four or sixteen different wave shapes instead of two. The catch: the more shapes there are, the more alike they look, so noise is more likely to make the receiver pick the wrong one.</p>`,
  how: `<ul><li><b>ASK</b> (amplitude): a 1 is a strong wave, a 0 is silence or a weak wave. Easy, but noise changes loudness easily.</li>
    <li><b>FSK</b> (frequency): a 1 wiggles fast, a 0 wiggles slowly. Hard for noise to disguise.</li>
    <li><b>PSK</b> (phase): a 1 starts the wave normally, a 0 flips it upside down. Efficient and widely used.</li></ul>
    <p>A <b>symbol</b> is one distinct wave shape. With M shapes, each symbol carries log₂(M) bits. A <b>constellation diagram</b> plots every allowed shape as a point: distance from the middle is amplitude, angle is phase.</p>
    <p>The receiver measures where the received symbol landed (blurred by noise) and picks the <b>nearest</b> allowed point. <b>Gray coding</b> gives neighbouring points bit patterns that differ in just one bit, so the most likely mistake costs only one wrong bit.</p>`,
  deep: `<p><b>Rate.</b> Bit rate = symbol rate × log₂(M). BPSK sends 1 bit per symbol, QPSK 2, 16-QAM 4, 256-QAM 8.</p>
    <p><b>Scaling.</b> Here every constellation is scaled to average energy 1, and the SNR slider is Es/N₀ (energy per symbol over noise density) in dB. Noise is Gaussian on each axis with variance 1/(2·SNR).</p>
    <p><b>Error rates.</b> For BPSK the bit error probability is Q(√(2·Es/N₀)). At 0 dB that is about 7.9%, which the simulator reproduces. Denser constellations need roughly 3 dB more SNR for every extra bit per symbol, which is why Wi-Fi and 5G step down from 256-QAM to QPSK as the signal weakens (adaptive modulation).</p>
    <p><b>In real life.</b> Simple remote controls use ASK (on-off keying), early modems and Bluetooth use FSK variants, Wi-Fi and satellite links use PSK and QAM. A real PSK receiver also has to recover the carrier’s phase; differential PSK avoids that by comparing neighbouring symbols.</p>
    <p><b>Where the analogy stops.</b> Humming has no clean “phase”, and a real receiver does not hear a hum; it correlates the incoming wave against reference waves. The idea is the same: three knobs on a steady wave.</p>`,
  map: [
    ['Steady hum', 'The carrier wave'],
    ['Loud / quiet hum', 'ASK: amplitude changes'],
    ['High / low note', 'FSK: frequency changes'],
    ['Starting the hum at a different moment', 'PSK: phase changes'],
    ['Noisy field making your friend unsure', 'Channel noise blurring the received point'],
  ],
};

regMod({
  id: 'modulation',
  group: 'link',
  title: 'Modulation: bits on a carrier wave',
  desc: 'Change a carrier’s height, speed or phase to carry bits, then see how noise breaks dense constellations such as 16-QAM first.',
  obj: [
    'Describe how ASK, FSK and PSK each encode a bit.',
    'Read a constellation diagram and explain nearest-point decoding.',
    'Explain the trade-off between bits per symbol and noise tolerance.',
  ],
  mount(root) {
    kitStyles();
    root.innerHTML =
      panel('Learn it at your level', '<div id="md-layers"></div>') +
      panel(
        'Modulate bits onto a carrier',
        `<div class="controls"><div class="field grow"><label for="md-bits">Data bits (up to 12)</label><input id="md-bits" value="10110010" maxlength="12" inputmode="numeric" autocomplete="off" spellcheck="false"></div>
        <div class="field"><label for="md-kind">Technique</label>${sel('md-kind', SCHEMES_ANALOG.map(s => [s.id, s.name]), 'psk')}</div></div>
        <p class="hint" id="md-what"></p><div id="md-wave"></div>`
      ) +
      panel('Show the working: the wave, bit by bit', '<div id="md-work"></div>') +
      panel(
        'Constellations and noise',
        `<div class="controls"><div class="field"><label for="md-mod">Modulation</label>${sel('md-mod', Object.entries(MODS).map(([k, v]) => [k, `${v.name} (${v.bitsPerSym} bit${v.bitsPerSym > 1 ? 's' : ''}/symbol)`]), 'qpsk')}</div>
        <div class="field grow"><label for="md-snr">Signal-to-noise ratio: <output id="md-snrv">12 dB</output></label><input id="md-snr" type="range" min="0" max="30" value="12" step="1"></div>
        <div class="btnrow"><button class="btn sm" id="md-new" type="button">New noise</button></div></div>
        <div id="md-const"></div><div id="md-stats"></div><div id="md-cmp"></div>`
      ) +
      panel('Show the working: one symbol at a time', '<div id="md-work2"></div>', 'Follow eight symbols from bits to decisions.');
    const cleanups = [layers($('#md-layers', root), EXPLAIN)];
    const work = showWorking($('#md-work', root), { onOpen: () => flag('md_working') });
    const work2 = showWorking($('#md-work2', root), { label: 'Show the working for constellations', onOpen: () => flag('md_working') });
    cleanups.push(() => work.destroy(), () => work2.destroy());
    let seed = 11;

    const bitsNow = () => cleanBits($('#md-bits', root).value, 12);

    function wave() {
      const bits = bitsNow(),
        kind = $('#md-kind', root).value,
        info = SCHEMES_ANALOG.find(s => s.id === kind);
      $('#md-what', root).innerHTML = `<b>${esc(info.name)}</b> changes ${info.what} to carry each bit.`;
      if (!bits) {
        $('#md-wave', root).innerHTML = vd('warn', 'Enter some bits.');
        work.setSteps([]);
        return;
      }
      const m = modulate(kind, bits, SPB),
        labels = bits.split('');
      $('#md-wave', root).innerHTML = analogWave({ samples: m.samples, spb: SPB, labels, name: info.name });
      const carrier = modulate('psk', '111', SPB);
      const steps = [
        {
          title: 'Start with a steady carrier',
          text: 'Before any data, the transmitter sends one smooth, repeating wave. Modulation will change one property of it for each bit.',
          html: analogWave({ samples: carrier.samples, spb: SPB, labels: ['', '', ''], name: 'Carrier' }),
        },
      ];
      m.perBit.forEach((p, k) =>
        steps.push({
          title: `Bit ${k + 1} is ${p.bit}`,
          text: p.why,
          html: () => analogWave({ samples: m.samples, spb: SPB, labels, upTo: k + 1, hot: k, name: info.name }),
        })
      );
      steps.push({
        title: 'The receiver reads it back',
        text: `For each bit slot the receiver measures ${info.what} and picks the closest match to a 0 or a 1, which gives back <code>${esc(bits)}</code>.`,
        html: () => analogWave({ samples: m.samples, spb: SPB, labels, name: info.name }),
      });
      work.setSteps(steps);
    }

    function constel() {
      const kind = $('#md-mod', root).value,
        snr = Number($('#md-snr', root).value),
        ideal = constellation(kind);
      $('#md-snrv', root).textContent = `${snr} dB`;
      const sim = simulateNoise(kind, 600, snr, seed);
      $('#md-const', root).innerHTML = constellationSvg({ ideal, symbols: sim.symbols });
      $('#md-stats', root).innerHTML =
        statRow([
          [`${(sim.ser * 100).toFixed(1)}%`, 'symbols decoded wrongly'],
          [`${(sim.ber * 100).toFixed(2)}%`, 'bits wrong (bit error rate)'],
          [sim.bitsPerSym, 'bits per symbol'],
        ]) +
        (sim.symbolErrors === 0
          ? vd('ok', 'Every symbol landed closest to the right point.', 'Slide the SNR down to make the dots spread out.')
          : vd('warn', `${sim.symbolErrors} of ${sim.n} symbols were decided wrongly.`, 'Red dots landed nearer to a different point than the one that was sent.'));
      const rows = Object.entries(MODS).map(([k, v]) => {
        const r = simulateNoise(k, 2000, snr, seed);
        return [v.name, v.bitsPerSym, `${(r.ser * 100).toFixed(1)}%`, `${(r.ber * 100).toFixed(2)}%`];
      });
      $('#md-cmp', root).innerHTML = `<h4>All three at ${snr} dB</h4>` + tbl(['Modulation', 'Bits per symbol', 'Symbol errors', 'Bit errors'], rows) + hn('More bits per symbol means more speed but a smaller margin for noise.');
      const small = simulateNoise(kind, 8, snr, seed + 1),
        sy = small.symbols;
      work2.setSteps([
        {
          title: 'Cut the bits into symbols',
          text: `${MODS[kind].name} sends ${MODS[kind].bitsPerSym} bit${MODS[kind].bitsPerSym > 1 ? 's' : ''} at a time. Here are eight random symbols.`,
          html: `<div class="lk-in">${sy.map((s, k) => `<span class="lk-chip c${k % 5} lk-pop" style="--d:${(k * 0.1).toFixed(1)}s">${s.tx.bits}</span>`).join('')}</div>`,
        },
        {
          title: 'Each symbol becomes a point',
          text: 'The transmitter looks up the point for each bit pattern: its distance from the centre is the amplitude and its angle is the phase.',
          html: () => constellationSvg({ ideal, symbols: sy.map(s => ({ rx: s.tx, decided: s.tx, ok: true })), neutral: true }),
        },
        {
          title: 'Noise pushes every point off target',
          text: `The channel adds random noise (SNR ${snr} dB), so the receiver sees each symbol displaced from where it was sent.`,
          html: () => constellationSvg({ ideal, symbols: sy, neutral: true }),
        },
        {
          title: 'The receiver picks the nearest allowed point',
          text: 'Each line joins a received dot to the point the receiver chooses. A dot that landed closer to a neighbour gets decided wrongly (red).',
          html: () => constellationSvg({ ideal, symbols: sy, lines: true }),
        },
        {
          title: 'Compare with what was sent',
          text: `${small.symbolErrors === 0 ? 'Every symbol was decided correctly.' : `${small.symbolErrors} of 8 symbols were decided wrongly, causing ${small.bitErrors} wrong bit${small.bitErrors === 1 ? '' : 's'}.`} Because the bit patterns are Gray coded, a one-step mistake usually flips just one bit.`,
          html: () => tbl(['#', 'Sent', 'Decided', 'Result'], sy.map((s, k) => [k + 1, s.tx.bits, s.decided.bits, { h: s.ok ? '✔ correct' : `✘ ${s.bitErr} bit${s.bitErr > 1 ? 's' : ''} wrong` }])),
        },
      ]);
    }

    $('#md-bits', root).oninput = wave;
    $('#md-bits', root).onchange = e => {
      e.target.value = bitsNow();
    };
    $('#md-kind', root).onchange = () => {
      flag('md_kind');
      wave();
    };
    $('#md-mod', root).onchange = constel;
    $('#md-snr', root).oninput = () => {
      flag('md_noise');
      constel();
    };
    $('#md-new', root).onclick = () => {
      seed = (seed * 7 + 13) % 100000;
      constel();
    };
    wave();
    constel();
    return () => cleanups.forEach(f => f());
  },
});
