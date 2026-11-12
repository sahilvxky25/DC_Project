/**
 * multiplexing: sharing one link between several flows
 *
 * simulateMux() compares synchronous TDM (every flow owns a fixed slot in every frame, used or not) with statistical TDM
 * (slots are given to whoever has data, at the price of an address tag and possible queueing). fdmPlan() lays out
 * frequency bands for FDM.
 *
 * The model is deliberately small: time is a list of frames, a flow has at most one unit of data ready per frame, and a
 * unit takes one slot.
 *
 * Imports: (none)
 *
 * Exports: fdmPlan, parseDemand, simulateMux
 *
 * Used by: modules/link-layer/mux-switching.js, tests/physical.test.mjs
 */

/**
 * Turns a string such as "1101" into a demand list, ignoring anything but 0 and 1.
 */
export const parseDemand = (s, frames) => {
  const bits = String(s).replace(/[^01]/g, '').padEnd(frames, '0').slice(0, frames);
  return [...bits].map(c => c === '1');
};

/**
 * @param {boolean[][]} demand - demand[flow][frame] is true when that flow has a unit ready in that frame.
 * @param {'sync'|'stat'} mode
 * @param {number} capacity - slots per frame for statistical TDM (synchronous TDM always uses one slot per flow).
 * @returns {{frames:{slots:({flow:number,born:number}|null)[], queued:number}[], sent:number, slotsTotal:number, wasted:number, util:number, maxQueue:number, avgDelay:number, leftover:number}}
 */
export function simulateMux(demand, mode, capacity) {
  const flows = demand.length,
    nFrames = flows ? demand[0].length : 0;
  const slotsPerFrame = mode === 'sync' ? flows : Math.max(1, capacity);
  const queue = [],
    frames = [];
  let sent = 0,
    delaySum = 0,
    maxQueue = 0;
  for (let f = 0; f < nFrames; f++) {
    for (let k = 0; k < flows; k++) if (demand[k][f]) queue.push({ flow: k, born: f });
    const slots = [];
    if (mode === 'sync') {
      // Each flow owns slot k. Its unit goes out this frame if it has one waiting; otherwise the slot is wasted.
      for (let k = 0; k < flows; k++) {
        const at = queue.findIndex(u => u.flow === k);
        if (at >= 0) {
          const [u] = queue.splice(at, 1);
          slots.push(u);
          sent++;
          delaySum += f - u.born;
        } else slots.push(null);
      }
    } else {
      for (let s = 0; s < slotsPerFrame; s++) {
        const u = queue.shift();
        if (u) {
          slots.push(u);
          sent++;
          delaySum += f - u.born;
        } else slots.push(null);
      }
    }
    maxQueue = Math.max(maxQueue, queue.length);
    frames.push({ slots, queued: queue.length });
  }
  const slotsTotal = slotsPerFrame * nFrames;
  return {
    frames,
    sent,
    slotsTotal,
    wasted: slotsTotal - sent,
    util: slotsTotal ? sent / slotsTotal : 0,
    maxQueue,
    avgDelay: sent ? delaySum / sent : 0,
    leftover: queue.length,
  };
}

/**
 * Frequency-division plan: n channels of equal width separated by guard bands.
 *
 * @returns {{bands:{lo:number,hi:number}[], total:number}} frequencies in the same unit as the inputs.
 */
export function fdmPlan(n, channelBw, guard) {
  const bands = [];
  let f = 0;
  for (let k = 0; k < n; k++) {
    bands.push({ lo: f, hi: f + channelBw });
    f += channelBw + guard;
  }
  return { bands, total: n > 0 ? n * channelBw + (n - 1) * guard : 0 };
}
