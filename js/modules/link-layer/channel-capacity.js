/**
 * learning module: Channel capacity
 *
 * Nyquist (noiseless) and Shannon (noisy) limits with live numbers, a close-up of how noise blurs neighbouring signal
 * levels, and an animated step-by-step calculation. Layered explanations with an everyday analogy are included.
 *
 * Imports:
 *   - ../../core/ui-helpers.js: panel, sel, statRow, vd
 *   - ../../core/utils.js: $, clamp, esc
 *   - ../../core/learn-kit.js: kitStyles, layers, showWorking
 *   - ../../core/wave-svg.js: barsSvg
 *   - ../../simulations/channel-capacity.js: PRESETS, dbToLinear, fmtHz, fmtRate, limits
 *   - ../registry.js: regMod
 *   - ../../app/progress.js: flag
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { panel, sel, statRow, vd } from '../../core/ui-helpers.js';
import { $, clamp } from '../../core/utils.js';
import { kitStyles, layers, showWorking } from '../../core/learn-kit.js';
import { barsSvg } from '../../core/wave-svg.js';
import { PRESETS, dbToLinear, fmtHz, fmtRate, limits } from '../../simulations/channel-capacity.js';
import { regMod } from '../registry.js';
import { flag } from '../../app/progress.js';

const EXPLAIN = {
  analogy: {
    emoji: '🗣️',
    title: 'Talking across a noisy room',
    text: 'You can talk faster (more <b>bandwidth</b>) and use a bigger vocabulary of distinct words (more <b>signal levels</b>). But the louder the chatter in the room (<b>noise</b>), the more your listener mixes up words that sound alike. Shannon’s formula tells you the fastest anyone could ever talk in that exact room, with the cleverest possible code.',
  },
  plain: `<p>Every link has a speed limit, and two things set it: how wide the “road” is (<b>bandwidth</b>) and how noisy it is (<b>signal-to-noise ratio</b>, SNR).</p>
    <p>On a perfectly quiet road you could keep adding signal levels and go as fast as you like. On a real, noisy road the levels start to blur together, and there is a ceiling nothing can beat.</p>
    <p>Change the numbers below and watch which limit you are hitting: the <i>levels</i> you chose, or the <i>noise</i>.</p>`,
  how: `<p><b>Nyquist</b> (no noise): a channel of bandwidth B can carry at most 2B symbols per second, and each symbol with L levels carries log₂(L) bits.</p>
    <span class="lk-formula">bit rate ≤ 2 × B × log₂(L)</span>
    <p><b>Shannon</b> (with noise): however many levels or clever tricks you use, the rate can never exceed</p>
    <span class="lk-formula">C = B × log₂(1 + SNR)</span>
    <p>SNR is a plain ratio here, <b>not</b> decibels. 30 dB means a ratio of 1000. Your real limit is whichever formula gives the <i>smaller</i> number.</p>`,
  deep: `<p><b>Equivalent levels.</b> Setting Nyquist equal to Shannon gives L = √(1 + SNR): the number of levels the noise still lets you tell apart. At 30 dB that is about 32 levels, so a 256-level scheme cannot work on that line.</p>
    <p><b>Diminishing returns.</b> Capacity grows in direct proportion to bandwidth, but only with the <i>logarithm</i> of SNR. Doubling the signal power adds about B bit/s, no matter how large it already is. Even with unlimited bandwidth, capacity approaches a ceiling of about 1.44 × (signal power ÷ noise density).</p>
    <p><b>Bound, not promise.</b> Shannon’s limit is an upper bound over all possible codes. Modern error-correcting codes (turbo, LDPC) get within about 1 dB of it; real products also lose rate to headers, retransmissions and interference from other users. The Wi-Fi and cable figures here are theoretical per-channel ceilings.</p>
    <p><b>The close-up.</b> Level spacing Δ and noise spread σ are related by σ/Δ = √((L² − 1) / (12 · SNR)) for evenly spaced levels. When σ climbs above about a quarter of Δ, neighbouring levels start to overlap, and at L = √(1 + SNR) it sits near 0.29: right on the edge, as Shannon predicts.</p>
    <p><b>Where the analogy stops.</b> Talking has no hard “2B symbols per second” rule; in a wire that limit comes from the channel’s frequency response blurring one symbol into the next (intersymbol interference).</p>`,
  map: [
    ['How fast the room lets you talk', 'Bandwidth B (hertz)'],
    ['Different words in your vocabulary', 'Signal levels L'],
    ['Background chatter', 'Noise power; the SNR is signal ÷ noise'],
    ['“Even the best talker can’t beat this”', 'Shannon capacity C'],
    ['Slowing down when the room gets loud', 'Lower bit rate (or fewer levels) at low SNR'],
  ],
};

const UNITS = [
  [1, 'Hz'],
  [1e3, 'kHz'],
  [1e6, 'MHz'],
];

regMod({
  id: 'capacity',
  group: 'link',
  title: 'Channel capacity: Nyquist and Shannon',
  desc: 'Find the speed limit of a link from its bandwidth, noise and signal levels, and see which limit you hit first.',
  obj: [
    'Compute the Nyquist and Shannon limits for a channel.',
    'Convert an SNR in decibels to a plain ratio.',
    'Explain why adding signal levels stops helping in a noisy channel.',
  ],
  mount(root) {
    kitStyles();
    root.innerHTML =
      panel('Learn it at your level', '<div id="cp-layers"></div>') +
      panel(
        'Describe the channel',
        `<div class="controls"><div class="field"><label for="cp-pre">Example channel</label>${sel('cp-pre', [['custom', 'Custom'], ...PRESETS.map(p => [p.id, p.name])], 'phone')}</div>
        <div class="field"><label for="cp-bw">Bandwidth</label><input id="cp-bw" type="number" min="0.1" step="any" value="3.1"></div>
        <div class="field"><label for="cp-unit">Unit</label>${sel('cp-unit', UNITS.map(([v, l]) => [v, l]), 1e3)}</div>
        <div class="field"><label for="cp-snr">SNR (dB)</label><input id="cp-snr" type="number" min="0" max="60" step="1" value="30"></div>
        <div class="field"><label for="cp-L">Signal levels L</label>${sel('cp-L', [2, 4, 8, 16, 32, 64, 128, 256].map(v => [v, v]), 16)}</div></div>`
      ) +
      panel('Result', '<div id="cp-res"></div><div id="cp-bars"></div><div id="cp-note"></div>') +
      panel('Close-up: can the receiver tell neighbouring levels apart?', '<div id="cp-zoom"></div>') +
      panel('Show the working', '<div id="cp-work"></div>', 'Follow the calculation with your own numbers.');
    const cleanups = [layers($('#cp-layers', root), EXPLAIN)];
    const work = showWorking($('#cp-work', root), { onOpen: () => flag('cp_working') });
    cleanups.push(() => work.destroy());

    const read = () => {
      const bw = Math.max(0.1, (Number($('#cp-bw', root).value) || 0.1) * Number($('#cp-unit', root).value)),
        snr = clamp(Number($('#cp-snr', root).value) || 0, 0, 60),
        L = Number($('#cp-L', root).value);
      return { bw, snr, L };
    };
    const meter = (frac, cls, d = 0) => `<div class="lk-meter ${cls}" style="--w:${Math.max(1, frac * 100).toFixed(1)}%;--d:${d}s"><i></i></div>`;

    function zoom(L, snr) {
      const lin = dbToLinear(snr),
        r = Math.sqrt((L * L - 1) / (12 * lin)),
        ok = r < 0.25;
      const n = 6,
        dy = 28,
        w = 360,
        h = n * dy + 24;
      let svg = `<svg class="lk-svg" viewBox="0 0 ${w} ${h}" style="max-width:${w}px" role="img" aria-label="Neighbouring signal levels and the spread of noise around each">`;
      for (let k = 0; k < n; k++) {
        const y = 14 + k * dy,
          band = Math.min(2 * r, 2.5) * dy;
        svg += `<rect class="lk-bx ${ok ? 'c2' : 'c4'} lk-in" style="--d:${(k * 0.08).toFixed(2)}s;opacity:.28" x="90" y="${(y - band).toFixed(1)}" width="200" height="${(2 * band).toFixed(1)}" rx="6"/><line class="lk-axis" x1="90" y1="${y}" x2="290" y2="${y}" stroke-width="2"/><text class="lk-sub" x="82" y="${y + 4}" text-anchor="end">level ${k + 1}</text>`;
      }
      svg += '</svg>';
      return (
        svg +
        `<p class="hint">Noise spread σ ≈ <b>${r.toFixed(2)}</b> × the gap between levels (showing six neighbouring levels at true spacing; the shaded bands are ±2σ).</p>` +
        (ok
          ? vd('ok', 'The levels are easy to tell apart.', 'The shaded noise bands stay inside their own level.')
          : vd('warn', 'The levels overlap.', 'A receiver cannot reliably tell neighbouring levels apart here, so you would see errors. Use fewer levels or improve the SNR.'))
      );
    }

    function refresh() {
      const { bw, snr, L } = read(),
        r = limits(bw, snr, L);
      $('#cp-res', root).innerHTML = statRow([
        [fmtRate(r.nyq), `Nyquist limit with ${L} levels`],
        [fmtRate(r.shan), 'Shannon capacity (noise ceiling)'],
        [fmtRate(r.rate), 'Best you can use'],
        [r.usableLevels.toFixed(1), 'levels the noise allows'],
      ]);
      $('#cp-bars', root).innerHTML = barsSvg([
        { label: 'Nyquist (levels)', value: r.nyq, text: fmtRate(r.nyq), cls: 'c0' },
        { label: 'Shannon (noise)', value: r.shan, text: fmtRate(r.shan), cls: 'c1' },
        { label: 'Usable', value: r.rate, text: fmtRate(r.rate), cls: 'c2' },
      ]);
      $('#cp-note', root).innerHTML =
        r.limitedBy === 'noise'
          ? vd('warn', 'Noise is your limit.', `With ${L} levels Nyquist would allow ${fmtRate(r.nyq)}, but Shannon says this channel cannot carry more than ${fmtRate(r.shan)}. More levels will not help; raise the SNR or the bandwidth.`)
          : vd('ok', 'The number of levels is your limit.', `This channel could carry up to ${fmtRate(r.shan)}, but ${L} levels only reach ${fmtRate(r.nyq)}. You could go up to about ${Math.floor(r.usableLevels)} levels before noise takes over.`);
      $('#cp-zoom', root).innerHTML = zoom(L, snr);

      const lin = dbToLinear(snr),
        top = Math.max(r.nyq, r.shan);
      work.setSteps([
        {
          title: 'Nyquist: symbols per second',
          text: `A channel of ${fmtHz(bw)} can carry at most <b>2 × B</b> distinct symbols each second without one smearing into the next.`,
          html: `<span class="lk-formula lk-in">symbols/s = 2 × ${fmtHz(bw)} = <b>${Math.round(2 * bw).toLocaleString('en-US')}</b></span>`,
        },
        {
          title: 'Nyquist: bits per symbol',
          text: `With ${L} signal levels, each symbol is one of ${L} choices, which is log₂(${L}) bits.`,
          html: `<span class="lk-formula lk-in">bits/symbol = log₂(${L}) = <b>${Math.log2(L)}</b></span>`,
        },
        {
          title: 'Nyquist limit',
          text: 'Multiply the two. This is the best the levels allow if there were no noise at all.',
          html: `<span class="lk-formula lk-in">${Math.round(2 * bw).toLocaleString('en-US')} × ${Math.log2(L)} = <b>${fmtRate(r.nyq)}</b></span>${meter(r.nyq / top, 'c0')}`,
        },
        {
          title: 'Turn decibels into a ratio',
          text: 'Shannon needs the plain signal-to-noise ratio, not the decibel figure.',
          html: `<span class="lk-formula lk-in">SNR = 10<sup>(${snr} / 10)</sup> = <b>${lin >= 100 ? Math.round(lin).toLocaleString('en-US') : lin.toFixed(2)}</b></span>`,
        },
        {
          title: 'Shannon capacity',
          text: 'Now the noise ceiling: the most any code could ever achieve on this channel.',
          html: `<span class="lk-formula lk-in">C = ${fmtHz(bw)} × log₂(1 + ${lin >= 100 ? Math.round(lin) : lin.toFixed(2)}) = <b>${fmtRate(r.shan)}</b></span>${meter(r.nyq / top, 'c0')}${meter(r.shan / top, 'c1', 0.3)}`,
        },
        {
          title: 'Which limit bites?',
          text:
            r.limitedBy === 'noise'
              ? `Shannon is lower, so <b>noise</b> is the limit: ${fmtRate(r.rate)}. Adding levels cannot help.`
              : `Nyquist is lower, so the <b>number of levels</b> is the limit: ${fmtRate(r.rate)}. The noise would let you use up to about ${Math.floor(r.usableLevels)} levels.`,
          html: `${meter(r.nyq / top, 'c0')}${meter(r.shan / top, 'c1', 0.2)}${meter(r.rate / top, 'c2', 0.4)}<p class="hint">Blue: Nyquist · orange: Shannon · green: what you can actually use.</p>`,
        },
      ]);
    }

    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id);
      if (!p) return;
      const u = p.bw >= 1e6 ? 1e6 : p.bw >= 1e3 ? 1e3 : 1;
      $('#cp-unit', root).value = u;
      $('#cp-bw', root).value = +(p.bw / u).toFixed(3);
      $('#cp-snr', root).value = p.snrDb;
      $('#cp-L', root).value = p.levels;
    }

    $('#cp-pre', root).onchange = e => {
      applyPreset(e.target.value);
      refresh();
    };
    ['cp-bw', 'cp-unit', 'cp-snr', 'cp-L'].forEach(id => {
      $('#' + id, root).oninput = () => {
        $('#cp-pre', root).value = 'custom';
        flag('cp_change');
        refresh();
      };
    });
    applyPreset('phone');
    refresh();
    return () => cleanups.forEach(f => f());
  },
});
