# Error detection, correction, and reliable delivery

Parity adds a parity bit so the total number of one bits is even (even parity) or odd (odd parity). It detects any odd number of bit flips but misses an even number of flips.

The Internet checksum uses one's-complement addition over fixed-size words and complements the result. CRC (cyclic redundancy check) treats bits as a polynomial over GF(2) and computes a remainder using XOR division. CRC is strong at detecting common transmission errors but is not an error-correcting code.

Hamming codes add redundant check bits to locate and correct certain bit errors. SECDED extends this idea with an overall parity bit to support single-error correction and double-error detection under its assumptions.

Reliable delivery protocols use acknowledgements, timers, sequence numbers, and retransmissions. Stop-and-Wait sends one outstanding frame at a time. Sliding Window protocols permit multiple outstanding frames and improve link utilization.
