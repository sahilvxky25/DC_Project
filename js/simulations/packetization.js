/**
 * packet layout of the core lab
 *
 * The core lab's packet is [16-bit sequence, 16-bit payload length, ...payload bytes, CRC-8]. This file
 * defines that layout (header size HDR, trailer size TRL) and the two functions that build the bytes and the
 * trailer. Keeping the layout here means the sender, the receiver and the journey module all agree on it.
 *
 * Imports:
 *   - ../core/checksums.js (parity-free error-detection math: Internet checksum, CRC-8, CRC-32): crc8
 *
 * Exports: HDR, TRL, packetBytes, packetCrc
 *
 * Used by: lab/packet-stage.js, lab/transmission-stage.js, modules/learning/journey.js
 */

import { crc8 } from '../core/checksums.js';

/**
 * Header uses a 16-bit sequence number and 16-bit payload length. This supports
 * image transfers with more than 255 packets and payloads larger than 255 bytes.
 */
export const HDR = 4,
  TRL = 1;

/**
 * Builds bytes: [sequence high, sequence low, length high, length low, ...payload].
 * Sequence numbers are 1-based and support up to 65,535 packets.
 */
export const packetBytes = (i, p) => {
  const seq = i + 1;
  if (seq > 0xffff || p.length > 0xffff) {
    throw new RangeError('Core Lab packet sequence and payload length must fit in 16 bits.');
  }
  return [seq >>> 8, seq & 0xff, p.length >>> 8, p.length & 0xff, ...p];
};

/**
 * CRC-8 trailer of a core-lab packet, computed over its header and payload.
 */
export const packetCrc = (i, p) => crc8(packetBytes(i, p));
