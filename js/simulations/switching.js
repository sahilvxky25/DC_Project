/**
 * switching: circuit, message and packet switching delay
 *
 * Classic store-and-forward arithmetic over a chain of equal links. Times are in seconds, sizes in bits, rates in bit/s.
 *
 *   circuit:  setup + M/R + hops * prop           (the path is reserved; data streams through with no waiting)
 *   message:  hops * (M/R) + hops * prop          (every switch receives the whole message before forwarding)
 *   packets:  (n + hops - 1) * (Lp/R) + hops * prop   where n = ceil(M / payload) and Lp = payload + header
 *
 * Packets are assumed equal in size (the last one is padded), which is the usual textbook simplification.
 *
 * Imports: (none)
 *
 * Exports: compareSwitching, packetTimeline
 *
 * Used by: modules/link-layer/mux-switching.js, tests/physical.test.mjs
 */

/**
 * @param {Object} c
 * @param {number} c.bits - message size.
 * @param {number} c.rate - link rate in bit/s.
 * @param {number} c.hops - number of links.
 * @param {number} c.prop - propagation delay per link, seconds.
 * @param {number} c.setup - circuit set-up time, seconds.
 * @param {number} c.payload - payload bits per packet.
 * @param {number} c.header - header bits per packet.
 */
export function compareSwitching({ bits, rate, hops, prop, setup, payload, header }) {
  const n = Math.max(1, Math.ceil(bits / payload)),
    lp = payload + header,
    tp = lp / rate;
  const circuit = setup + bits / rate + hops * prop,
    message = hops * (bits / rate) + hops * prop,
    packet = (n + hops - 1) * tp + hops * prop;
  return { n, packetBits: lp, packetTime: tp, circuit, message, packet, overheadBits: n * header };
}

/**
 * Transmission schedule of the first `count` packets on every link (for the Gantt-style drawing).
 * Packet j can start on link h once it has arrived from link h-1 and the link is free, which for equal packets is (j+h)*T.
 *
 * @returns {{link:number, packet:number, start:number, end:number}[]}
 */
export function packetTimeline(count, hops, packetTime) {
  const out = [];
  for (let j = 0; j < count; j++)
    for (let h = 0; h < hops; h++) out.push({ link: h, packet: j, start: (j + h) * packetTime, end: (j + h + 1) * packetTime });
  return out;
}
