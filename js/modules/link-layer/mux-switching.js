/**
 * learning module: Multiplexing and switching
 *
 * Two tabs. Multiplexing: synchronous TDM against statistical TDM on the same demand, and an FDM band planner.
 * Switching: circuit, message and packet switching delay with a timeline that shows packets pipelining across hops.
 * Each tab has layered explanations with an everyday analogy and an animated "show the working" player.
 *
 * Imports:
 *   - ../../core/ui-helpers.js: hn, panel, sel, statRow, tabset, tbl, vd
 *   - ../../core/utils.js: $, esc
 *   - ../../core/learn-kit.js: kitStyles, layers, showWorking
 *   - ../../core/wave-svg.js: barsSvg
 *   - ../../simulations/multiplexing.js: fdmPlan, parseDemand, simulateMux
 *   - ../../simulations/switching.js: compareSwitching, packetTimeline
 *   - ../registry.js: regMod
 *   - ../../app/progress.js: flag
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { panel, sel, statRow, tabset, tbl, vd } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { kitStyles, layers, showWorking } from '../../core/learn-kit.js';
import { barsSvg } from '../../core/wave-svg.js';
import { fdmPlan, parseDemand, simulateMux } from '../../simulations/multiplexing.js';
import { compareSwitching, packetTimeline } from '../../simulations/switching.js';
import { regMod } from '../registry.js';
import { flag } from '../../app/progress.js';

const NAMES = 'ABCD';
const FRAMES = 12;

const MUX_EXPLAIN = {
  analogy: {
    emoji: '🚌',
    title: 'One school bus, many children',
    text: 'The bus has a fixed number of seats. <b>Synchronous TDM</b> gives each child a numbered seat: if a child is absent, that seat rides empty. <b>Statistical TDM</b> lets whoever turns up take any free seat, so the bus can be smaller, but on a busy day some children wait for the next bus. <b>FDM</b> is a road with a separate lane for each child, all travelling at once.',
  },
  plain: `<p>One cable is expensive, so many conversations have to share it. <b>Multiplexing</b> is the set of rules for taking turns without mixing anybody’s data up.</p>
    <p>You can share by <i>time</i> (everybody gets short turns) or by <i>frequency</i> (everybody gets their own slice of the spectrum). Sharing by time can be fixed (your turn comes round whether you need it or not) or on demand (turns go to whoever has something to say).</p>`,
  how: `<ul><li><b>FDM</b> (frequency): every conversation gets its own band, all at the same time. Small unused <b>guard bands</b> between them stop neighbours interfering, like the gaps between radio stations.</li>
    <li><b>Synchronous TDM</b>: time is cut into <b>frames</b>, each with one <b>slot</b> per conversation. Simple and predictable, but an idle conversation wastes its slot.</li>
    <li><b>Statistical TDM</b>: slots go to whoever has data right now, so the link can be smaller. Each slot needs an address tag to say who owns it, and a <b>queue</b> absorbs bursts (adding delay).</li></ul>
    <p>Try the default pattern: the flows are bursty, so synchronous TDM wastes most slots while statistical TDM keeps the link busy.</p>`,
  deep: `<p><b>Efficiency.</b> Synchronous TDM utilisation equals the average fraction of time each flow is active, so bursty traffic wastes most of the link. Statistical TDM can run the link much closer to full, but queueing delay climbs steeply as utilisation approaches 100% and a full buffer drops data.</p>
    <p><b>Sizing.</b> Link capacity should cover the sum of the <i>average</i> rates plus a margin for bursts, not the sum of the peak rates. That saving is the whole point of statistical multiplexing and of the packet-switched Internet.</p>
    <p><b>Real examples.</b> A T1 line is synchronous TDM: 24 voice channels × 64 kbit/s + 8 kbit/s of framing = 1.544 Mbit/s. FDM carries radio, cable TV and ADSL (separate bands for voice, upload and download); OFDM in Wi-Fi, 4G and 5G is a close relative. Ethernet and IP are statistical multiplexing.</p>
    <p><b>Simplifications here.</b> Each flow has at most one unit ready per frame, a unit takes one slot, and the address-tag overhead of statistical TDM is not counted.</p>`,
  map: [
    ['A numbered seat for each child', 'A fixed slot per flow (synchronous TDM)'],
    ['An empty seat on the bus', 'A wasted slot'],
    ['Anyone takes any free seat', 'Statistical TDM slot assignment'],
    ['A name tag so the driver knows whose seat it is', 'The address in each statistical-TDM slot'],
    ['Children waiting for the next bus', 'Queueing delay'],
    ['A separate lane per child', 'An FDM frequency band'],
  ],
};

const SW_EXPLAIN = {
  analogy: {
    emoji: '✉️',
    title: 'A phone call, a parcel, or loose pages',
    text: 'A phone call (<b>circuit switching</b>) books the whole line end to end before anyone speaks, even through the silences. Posting a whole book as one parcel (<b>message switching</b>) means every sorting office must receive the entire parcel before sending it on. Tearing out the pages and posting each one separately (<b>packet switching</b>) lets pages travel like a conveyor belt, each office working on a different page at once.',
  },
  plain: `<p>To get data across several links, the network has to decide how to move it. There are three classic answers.</p>
    <p>Reserve a private path first and then stream (<b>circuit</b>). Pass the whole message from hop to hop (<b>message</b>). Or chop it into small <b>packets</b> that flow through the network like a conveyor belt (<b>packet</b>). The Internet uses packets because while packet 1 is on hop 3, packet 2 can already be on hop 2.</p>`,
  how: `<ul><li><b>Circuit</b>: a set-up phase reserves capacity along the path. Then data streams with no waiting, but the capacity is held even when you are silent, and set-up costs time.</li>
    <li><b>Message</b>: each switch receives the <i>whole</i> message, then forwards it (“store and forward”). Delay is hops × the message’s transmission time.</li>
    <li><b>Packet</b>: store and forward per <i>packet</i>. After the first packet fills the pipe, every link works at once. Delay is (packets + hops − 1) × the packet time. The cost is a header on every packet.</li></ul>
    <span class="lk-formula">circuit = setup + M/R + hops × prop<br>message = hops × M/R + hops × prop<br>packets = (n + hops − 1) × (Lp/R) + hops × prop</span>
    <p>M = message size, R = link rate, n = number of packets, Lp = packet size including header, prop = propagation delay per link.</p>`,
  deep: `<p><b>Transmission vs propagation.</b> Transmission delay (size ÷ rate) is the time to push the bits onto the wire; propagation delay is the time for them to travel along it. Store-and-forward multiplies the first by the number of hops; propagation just adds up.</p>
    <p><b>Packet size trade-off.</b> Small packets pipeline better but pay more header overhead; large packets waste less on headers but pipeline less. There is a sweet spot, and changing the payload size below shows both sides of it.</p>
    <p><b>Beyond the model.</b> Real networks add queueing delay behind other traffic, processing time in each router, possible loss and reordering. Virtual-circuit networks (ATM, MPLS) are a hybrid: they set up a path but still send packets. Circuits suit steady streams such as voice; packets suit bursty data.</p>
    <p><b>Simplifications here.</b> All packets are the same size (the last is padded), links are identical, and there is no competing traffic.</p>`,
  map: [
    ['Booking the whole phone line before talking', 'Circuit set-up'],
    ['Silent minutes still cost the line', 'Reserved capacity sits idle'],
    ['The whole parcel waits at each sorting office', 'Message switching, store and forward'],
    ['Tearing out pages and posting each one', 'Packetisation'],
    ['Pages moving like a conveyor belt', 'Pipelining across hops'],
    ['An address on every page', 'Header overhead on every packet'],
  ],
};

/* ---------- shared drawing ---------- */
const fmtTime = s => (s < 1 ? `${(s * 1000).toFixed(s * 1000 < 10 ? 2 : 1)} ms` : `${s.toFixed(2)} s`);

/** Horizontal timeline: one row per link, one block per transmission. */
function gantt({ rows, items, total, w = 640 }) {
  const padL = 74,
    padR = 12,
    rh = 30,
    top = 8,
    h = top + rows.length * rh + 24;
  const X = t => padL + (t / total) * (w - padL - padR);
  let s = `<svg class="lk-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Timeline of transmissions on each link">`;
  rows.forEach((name, i) => {
    const y = top + i * rh;
    s += `<text class="lk-sub" x="${padL - 8}" y="${y + rh / 2 + 4}" text-anchor="end">${esc(name)}</text><line class="lk-axis" x1="${padL}" y1="${y + rh - 2}" x2="${w - padR}" y2="${y + rh - 2}" opacity=".35"/>`;
  });
  items.forEach(it => {
    const x0 = X(it.start),
      x1 = X(it.end),
      y = top + it.row * rh + 4;
    s += `<rect class="lk-bx ${it.cls || ''} lk-pop" style="--d:${((it.start / total) * 1.2).toFixed(2)}s" x="${x0.toFixed(1)}" y="${y}" width="${Math.max(1.5, x1 - x0 - 1).toFixed(1)}" height="${rh - 10}" rx="4"/>`;
    if (it.label && x1 - x0 > 18) s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${y + 13}" text-anchor="middle" style="fill:#fff;font:600 10px var(--mono)">${esc(it.label)}</text>`;
  });
  s += `<text class="lk-sub" x="${padL}" y="${h - 6}">0</text><text class="lk-sub" x="${w - padR}" y="${h - 6}" text-anchor="end">${fmtTime(total)}</text></svg>`;
  return s;
}

const slotChip = (s, f) =>
  s
    ? `<span class="lk-chip c${s.flow}" title="Flow ${NAMES[s.flow]}${f > s.born ? `, waited ${f - s.born} frame(s)` : ''}">${NAMES[s.flow]}${f > s.born ? '⏱' : ''}</span>`
    : '<span class="lk-chip empty" title="Wasted slot">·</span>';

const column = (slots, f, label) =>
  `<div style="display:flex;flex-direction:column;align-items:center">${slots.map(s => slotChip(s, f)).join('')}<small class="hint">${label}</small></div>`;

/* ---------- multiplexing tab ---------- */
function muxTab(p) {
  const DEF = ['110110110110', '100000100000', '011100011100', '000010000100'];
  p.innerHTML =
    panel('Learn it at your level', '<div id="mx-layers"></div>') +
    panel(
      'Who has data to send, and when?',
      `<p class="hint">Each box below is one frame. A 1 means that flow has a unit of data ready in that frame.</p><div class="controls">${DEF.map((d, i) => `<div class="field grow"><label for="mx-p${i}">Flow ${NAMES[i]} (12 frames)</label><input id="mx-p${i}" value="${d}" maxlength="12" inputmode="numeric" autocomplete="off" spellcheck="false"></div>`).join('')}
      <div class="field"><label for="mx-cap">Statistical TDM capacity (slots per frame)</label>${sel('mx-cap', [1, 2, 3, 4].map(v => [v, v]), 2)}</div></div>`
    ) +
    panel('Result', '<div id="mx-out"></div>') +
    panel('Show the working', '<div id="mx-work"></div>', 'Go through the frames one at a time.') +
    panel(
      'Frequency-division multiplexing (FDM)',
      `<div class="controls"><div class="field"><label for="fd-n">Channels</label><input id="fd-n" type="number" min="1" max="10" value="4"></div>
      <div class="field"><label for="fd-bw">Width of each channel (kHz)</label><input id="fd-bw" type="number" min="1" max="100" value="4"></div>
      <div class="field"><label for="fd-g">Guard band (kHz)</label><input id="fd-g" type="number" min="0" max="20" value="1"></div></div>
      <div id="fd-out"></div><div id="fd-work"></div>`
    );
  const cleanups = [layers($('#mx-layers', p), MUX_EXPLAIN)];
  const work = showWorking($('#mx-work', p), { onOpen: () => flag('mx_working') });
  const fdWork = showWorking($('#fd-work', p), { label: 'Show the working for FDM', onOpen: () => flag('mx_working') });
  cleanups.push(() => work.destroy(), () => fdWork.destroy());

  function refresh() {
    const demand = DEF.map((_, i) => parseDemand($(`#mx-p${i}`, p).value, FRAMES)),
      cap = Number($('#mx-cap', p).value);
    const sync = simulateMux(demand, 'sync', 0),
      stat = simulateMux(demand, 'stat', cap);
    const gridOf = (sim, title) => `<h4>${title}</h4><div class="lk-row" style="gap:6px;align-items:flex-start">${sim.frames.map((fr, f) => column(fr.slots, f, f + 1)).join('')}</div>`;
    $('#mx-out', p).innerHTML =
      gridOf(sync, 'Synchronous TDM: one fixed slot per flow') +
      gridOf(stat, `Statistical TDM: ${cap} shared slot${cap > 1 ? 's' : ''} per frame`) +
      '<p class="hint">Columns are frames and each box is a slot. Dashed boxes are wasted capacity. ⏱ means the data waited in the queue.</p>' +
      tbl(
        ['', 'Synchronous TDM', 'Statistical TDM'],
        [
          ['Units sent', sync.sent, stat.sent],
          ['Slots the link provided', sync.slotsTotal, stat.slotsTotal],
          ['Slots wasted', sync.wasted, stat.wasted],
          ['Link utilisation', `${(sync.util * 100).toFixed(0)}%`, `${(stat.util * 100).toFixed(0)}%`],
          ['Longest queue', '0', stat.maxQueue],
          ['Average wait (frames)', sync.avgDelay.toFixed(2), stat.avgDelay.toFixed(2)],
          ['Still queued at the end', sync.leftover, stat.leftover],
        ]
      ) +
      (stat.leftover > 0
        ? vd('warn', `${stat.leftover} unit${stat.leftover > 1 ? 's are' : ' is'} still waiting.`, 'The shared link is too small for this demand. Increase its capacity, or accept the delay and the risk of a full buffer.')
        : vd('ok', 'Everything was delivered.', `Statistical TDM used ${stat.slotsTotal} slots where synchronous TDM needed ${sync.slotsTotal}${stat.avgDelay > 0 ? `, at the price of an average wait of ${stat.avgDelay.toFixed(2)} frames` : ''}.`));

    const names = i => NAMES[i];
    const steps = [
      {
        title: 'Who wants to send, and when?',
        text: 'Each row is one flow and each box a frame. Filled boxes are frames where that flow has data ready.',
        html: `<div class="lk-in">${demand.map((d, i) => `<div><b>${names(i)}</b> ${d.map(x => `<span class="lk-chip ${x ? `c${i}` : 'empty'}">${x ? names(i) : '·'}</span>`).join('')}</div>`).join('')}</div>`,
      },
    ];
    for (let f = 0; f < FRAMES; f++) {
      const ready = demand.map((d, i) => (d[f] ? names(i) : '')).filter(Boolean);
      const sSent = sync.frames.slice(0, f + 1).flatMap(x => x.slots).filter(Boolean).length,
        tSent = stat.frames.slice(0, f + 1).flatMap(x => x.slots).filter(Boolean).length;
      steps.push({
        title: `Frame ${f + 1}`,
        text: `${ready.length ? `Flow${ready.length > 1 ? 's' : ''} <b>${ready.join(', ')}</b> ${ready.length > 1 ? 'have' : 'has'} data.` : 'Nobody has new data.'} Synchronous TDM keeps every flow’s slot whether it is used or not; statistical TDM hands the ${cap} slot${cap > 1 ? 's' : ''} to whoever is waiting.`,
        html: () =>
          `<div class="lk-row" style="align-items:flex-start;gap:28px"><div><b>Synchronous</b><br><span class="lk-in">${sync.frames[f].slots.map(s => slotChip(s, f)).join('')}</span></div><div><b>Statistical</b><br><span class="lk-in" style="--d:.25s">${stat.frames[f].slots.map(s => slotChip(s, f)).join('')}</span><br><small class="hint">queue after this frame: ${stat.frames[f].queued}</small></div></div>` +
          `<p class="hint">Units sent so far: synchronous ${sSent}, statistical ${tSent}.</p>`,
        ms: 1500,
      });
    }
    steps.push({
      title: 'Totals',
      text: `Both carried the same data, but synchronous TDM used ${sync.slotsTotal} slots against ${stat.slotsTotal}.`,
      html: () =>
        statRow([
          [`${(sync.util * 100).toFixed(0)}%`, 'synchronous utilisation'],
          [`${(stat.util * 100).toFixed(0)}%`, 'statistical utilisation'],
          [stat.avgDelay.toFixed(2), 'average wait, statistical (frames)'],
        ]),
    });
    work.setSteps(steps);
    refreshFdm();
  }

  function refreshFdm() {
    const n = Math.max(1, Math.min(10, Math.floor(+$('#fd-n', p).value) || 1)),
      bw = Math.max(1, +$('#fd-bw', p).value || 1),
      g = Math.max(0, +$('#fd-g', p).value || 0),
      plan = fdmPlan(n, bw, g);
    const draw = upTo => {
      const w = 640,
        padL = 14,
        sc = (w - 2 * padL) / plan.total;
      let s = `<svg class="lk-svg" viewBox="0 0 ${w} 96" role="img" aria-label="${n} frequency channels with guard bands">`;
      plan.bands.slice(0, upTo).forEach((b, k) => {
        s += `<rect class="lk-bx c${k % 5} lk-pop" style="--d:${(k * 0.07).toFixed(2)}s" x="${(padL + b.lo * sc).toFixed(1)}" y="14" width="${((b.hi - b.lo) * sc).toFixed(1)}" height="46" rx="4"/><text class="lk-lbl" style="fill:#fff" x="${(padL + ((b.lo + b.hi) / 2) * sc).toFixed(1)}" y="42">${k + 1}</text>`;
        if (k > 0 && g > 0) s += `<rect class="lk-slot" x="${(padL + plan.bands[k - 1].hi * sc).toFixed(1)}" y="14" width="${(g * sc).toFixed(1)}" height="46"/>`;
      });
      return s + `<line class="lk-axis" x1="${padL}" y1="68" x2="${w - padL}" y2="68"/><text class="lk-sub" x="${padL}" y="86">0 kHz</text><text class="lk-sub" x="${w - padL}" y="86" text-anchor="end">${plan.total} kHz</text></svg>`;
    };
    $('#fd-out', p).innerHTML = draw(n) + statRow([[`${plan.total} kHz`, 'total bandwidth needed'], [`${n} × ${bw}`, 'channel bandwidth'], [`${Math.max(0, n - 1)} × ${g}`, 'guard bands']]) + vd('info', 'The link must be at least this wide.', 'Guard bands cost bandwidth but stop neighbouring channels interfering.');
    const steps = plan.bands.map((b, k) => ({
      title: `Channel ${k + 1}`,
      text: `Channel ${k + 1} occupies <b>${b.lo}–${b.hi} kHz</b>${k > 0 && g > 0 ? `, starting ${g} kHz after channel ${k} to leave a guard band` : ''}.`,
      html: () => draw(k + 1),
      ms: 1400,
    }));
    steps.push({
      title: 'Total bandwidth',
      text: `${n} × ${bw} kHz of channels${n > 1 ? ` + ${n - 1} × ${g} kHz of guard bands` : ''} = <b>${plan.total} kHz</b>. The physical link must be at least that wide.`,
      html: () => draw(n),
    });
    fdWork.setSteps(steps);
  }

  [0, 1, 2, 3].forEach(i => {
    $(`#mx-p${i}`, p).oninput = refresh;
  });
  $('#mx-cap', p).onchange = refresh;
  ['fd-n', 'fd-bw', 'fd-g'].forEach(id => {
    $('#' + id, p).oninput = refreshFdm;
  });
  refresh();
  return () => cleanups.forEach(f => f());
}

/* ---------- switching tab ---------- */
function switchTab(p) {
  p.innerHTML =
    panel('Learn it at your level', '<div id="sw-layers"></div>') +
    panel(
      'Describe the path and the message',
      `<div class="controls"><div class="field"><label for="sw-kb">Message size (kB)</label>${sel('sw-kb', [10, 100, 1000, 10000].map(v => [v, v.toLocaleString('en-US')]), 100)}</div>
      <div class="field"><label for="sw-rate">Link rate (Mbit/s)</label>${sel('sw-rate', [1, 10, 100, 1000].map(v => [v, v]), 10)}</div>
      <div class="field"><label for="sw-hops">Links on the path</label><input id="sw-hops" type="number" min="1" max="8" value="4"></div>
      <div class="field"><label for="sw-pay">Packet payload (bytes)</label>${sel('sw-pay', [100, 500, 1000, 1460].map(v => [v, v]), 1000)}</div>
      <div class="field"><label for="sw-hdr">Header (bytes)</label>${sel('sw-hdr', [20, 40, 64].map(v => [v, v]), 40)}</div>
      <div class="field"><label for="sw-prop">Propagation per link (ms)</label>${sel('sw-prop', [0.1, 1, 5, 20].map(v => [v, v]), 1)}</div>
      <div class="field"><label for="sw-setup">Circuit set-up (ms)</label>${sel('sw-setup', [0, 50, 200, 500].map(v => [v, v]), 200)}</div></div>`
    ) +
    panel('Result', '<div id="sw-out"></div>') +
    panel('Timeline: why packets win', '<div id="sw-gantt"></div>') +
    panel('Show the working', '<div id="sw-work"></div>', 'Circuit, message and packet switching with your numbers.');
  const cleanups = [layers($('#sw-layers', p), SW_EXPLAIN)];
  const work = showWorking($('#sw-work', p), { onOpen: () => flag('sw_working') });
  cleanups.push(() => work.destroy());

  function refresh() {
    const hops = Math.max(1, Math.min(8, Math.floor(+$('#sw-hops', p).value) || 1)),
      cfg = {
        bits: Number($('#sw-kb', p).value) * 8000,
        rate: Number($('#sw-rate', p).value) * 1e6,
        hops,
        prop: Number($('#sw-prop', p).value) / 1000,
        setup: Number($('#sw-setup', p).value) / 1000,
        payload: Number($('#sw-pay', p).value) * 8,
        header: Number($('#sw-hdr', p).value) * 8,
      };
    const c = compareSwitching(cfg);
    const best = Math.min(c.circuit, c.message, c.packet);
    $('#sw-out', p).innerHTML =
      statRow([
        [fmtTime(c.circuit), 'circuit switching'],
        [fmtTime(c.message), 'message switching'],
        [fmtTime(c.packet), `packet switching (${c.n.toLocaleString('en-US')} packets)`],
      ]) +
      barsSvg([
        { label: 'Circuit', value: c.circuit, text: fmtTime(c.circuit), cls: 'c1' },
        { label: 'Message', value: c.message, text: fmtTime(c.message), cls: 'c4' },
        { label: 'Packets', value: c.packet, text: fmtTime(c.packet), cls: 'c2' },
      ]) +
      vd(
        c.packet === best ? 'ok' : 'info',
        c.packet === best ? 'Packet switching is fastest here.' : c.circuit === best ? 'Circuit switching is fastest here.' : 'Message switching is fastest here.',
        `Packets add ${(c.overheadBits / 8).toLocaleString('en-US')} bytes of headers (${((c.overheadBits / cfg.bits) * 100).toFixed(1)}% of the message). ${c.circuit === best ? 'But circuit switching holds the whole path for you even while it is idle.' : 'Try a larger message or more links to see the gap grow.'}`
      );

    // Schematic: a message of 6 packets, so the pipelining is visible whatever the real size is.
    const count = 6,
      T = 1,
      rows = Array.from({ length: hops }, (_, i) => `Link ${i + 1}`);
    const pk = packetTimeline(count, hops, T).map(x => ({ row: x.link, start: x.start, end: x.end, cls: `c${x.packet % 5}`, label: String(x.packet + 1) }));
    const ms = Array.from({ length: hops }, (_, h) => ({ row: h, start: h * count * T, end: (h + 1) * count * T, cls: 'c4', label: 'whole message' }));
    const totalMsg = hops * count * T,
      totalPk = (count + hops - 1) * T;
    $('#sw-gantt', p).innerHTML =
      `<h4>Message switching</h4>${gantt({ rows, items: ms, total: totalMsg })}<h4>Packet switching</h4>${gantt({ rows, items: pk, total: totalMsg })}` +
      `<p class="hint">A schematic message of ${count} packets on the same time scale. Packet 2 starts on link 1 while packet 1 is already on link 2, so the links work in parallel: ${totalPk} packet-times against ${totalMsg}.</p>`;

    const lp = c.packetBits;
    work.setSteps([
      {
        title: 'Circuit switching: reserve the path first',
        text: `A set-up phase of ${fmtTime(cfg.setup)} reserves the whole path. Then the ${(cfg.bits / 8000).toLocaleString('en-US')} kB stream through at ${cfg.rate / 1e6} Mbit/s with no waiting, plus ${hops} × ${fmtTime(cfg.prop)} of propagation.`,
        html: () =>
          gantt({
            rows: ['Whole path'],
            total: c.circuit,
            items: [
              { row: 0, start: 0, end: cfg.setup, cls: 'c1', label: 'set-up' },
              { row: 0, start: cfg.setup, end: cfg.setup + cfg.bits / cfg.rate, cls: 'c0', label: 'data' },
              { row: 0, start: cfg.setup + cfg.bits / cfg.rate, end: c.circuit, cls: 'c3', label: 'prop' },
            ],
          }) + `<span class="lk-formula">${fmtTime(cfg.setup)} + ${fmtTime(cfg.bits / cfg.rate)} + ${hops} × ${fmtTime(cfg.prop)} = <b>${fmtTime(c.circuit)}</b></span>`,
      },
      {
        title: 'Message switching: the whole message at every hop',
        text: `Each switch must receive all ${fmtTime(cfg.bits / cfg.rate)} of the message before it can forward it, so the hops happen one after another.`,
        html: () => gantt({ rows, items: ms, total: totalMsg }) + `<span class="lk-formula">${hops} × ${fmtTime(cfg.bits / cfg.rate)} + ${hops} × ${fmtTime(cfg.prop)} = <b>${fmtTime(c.message)}</b></span><p class="hint">(Schematic timeline; the formula uses your real numbers.)</p>`,
      },
      {
        title: 'Packet switching: cut it into packets',
        text: `The ${(cfg.bits / 8000).toLocaleString('en-US')} kB message becomes <b>${c.n.toLocaleString('en-US')}</b> packets of ${cfg.payload / 8} bytes of data plus a ${cfg.header / 8}-byte header (${lp / 8} bytes each, ${fmtTime(c.packetTime)} on the wire).`,
        html: () => `<div class="lk-in">${Array.from({ length: Math.min(c.n, 12) }, (_, k) => `<span class="lk-chip c${k % 5} lk-pop" style="--d:${(k * 0.06).toFixed(2)}s">#${k + 1}</span>`).join('')}${c.n > 12 ? `<span class="lk-chip empty">… ${(c.n - 12).toLocaleString('en-US')} more</span>` : ''}</div>`,
      },
      {
        title: 'Packets pipeline across the links',
        text: 'Once the first packet has crossed link 1, link 1 is free for packet 2 while packet 1 moves to link 2. Every link works at once.',
        html: () => gantt({ rows, items: pk, total: totalMsg }) + `<span class="lk-formula">(${c.n.toLocaleString('en-US')} + ${hops} − 1) × ${fmtTime(c.packetTime)} + ${hops} × ${fmtTime(cfg.prop)} = <b>${fmtTime(c.packet)}</b></span>`,
      },
      {
        title: 'Compare',
        text: `Packet switching pays for ${(c.overheadBits / 8).toLocaleString('en-US')} bytes of headers, but it shares the links with other users and pipelines the work. Circuit switching is predictable but reserves capacity; message switching is slowest because nothing overlaps.`,
        html: () => barsSvg([{ label: 'Circuit', value: c.circuit, text: fmtTime(c.circuit), cls: 'c1' }, { label: 'Message', value: c.message, text: fmtTime(c.message), cls: 'c4' }, { label: 'Packets', value: c.packet, text: fmtTime(c.packet), cls: 'c2' }]),
      },
    ]);
  }

  ['sw-kb', 'sw-rate', 'sw-pay', 'sw-hdr', 'sw-prop', 'sw-setup'].forEach(id => {
    $('#' + id, p).onchange = refresh;
  });
  $('#sw-hops', p).oninput = refresh;
  refresh();
  return () => cleanups.forEach(f => f());
}

regMod({
  id: 'muxswitch',
  group: 'link',
  title: 'Multiplexing and switching',
  desc: 'Share one link with TDM and FDM, and compare circuit, message and packet switching with a timeline of packets pipelining across hops.',
  obj: [
    'Compare synchronous and statistical TDM on bursty traffic.',
    'Plan FDM channels with guard bands.',
    'Explain why packet switching beats message switching on multi-hop paths.',
  ],
  mount(root) {
    kitStyles();
    root.innerHTML = '<div id="ms-tabs"></div>';
    const t = tabset($('#ms-tabs', root), [
      { label: '🚌 Multiplexing', render: muxTab },
      { label: '✉️ Switching', render: switchTab },
    ]);
    return () => t.destroy();
  },
});
