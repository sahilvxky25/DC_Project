# Link Layer, Error Control, and Reliable Transfer

## Framing

The data-link layer packages network-layer data into frames for transfer over a particular link. A frame commonly contains addressing/control fields, a payload, and an error-detection field. Framing methods include length fields, sentinel delimiters with byte stuffing, and bit-oriented delimiters with bit stuffing.

- **Byte stuffing:** an escape byte is inserted when a reserved delimiter byte appears in the payload.
- **Bit stuffing:** a sender inserts a zero after a specified run of consecutive one bits so the delimiter pattern is not confused with payload data. The receiver removes the inserted bit.

Exact framing rules depend on the protocol.

## Error detection

Error detection adds redundancy to help identify corruption.

- **Parity:** a parity bit makes the count of ones even or odd. It detects any odd number of bit flips in the protected group, but can miss an even number.
- **Internet checksum:** one's-complement addition and complementing are used in several Internet protocols. It is useful but is not a cryptographic integrity check.
- **CRC:** treats bits as a polynomial over GF(2), performs modulo-2 division by a generator polynomial, and appends the remainder. Detection strength depends on the generator and error pattern.

A detected error does not itself repair the data. Error correction requires additional redundancy or retransmission.

## Error correction

Hamming codes add parity positions that allow a receiver to calculate a syndrome and locate certain bit errors. Extended Hamming codes can provide single-error correction and double-error detection (SECDED) under the code's assumptions. Two-dimensional parity uses row and column checks to help locate some errors. Reed–Solomon codes operate on symbols over finite fields and are useful for correcting symbol errors and bursts.

Do not claim every code corrects every pattern: correction capability depends on code parameters and the number/type of errors.

## Reliable delivery and ARQ

Automatic Repeat reQuest (ARQ) combines error detection with feedback and retransmission.

- **Stop-and-Wait:** send one frame and wait for its acknowledgement before sending the next. Simple but can underuse a long-delay link.
- **Sliding Window:** allow multiple outstanding frames up to a window limit. Sequence numbers and acknowledgements coordinate progress.
- **Timeout:** if the expected acknowledgement does not arrive before the timer expires, retransmission may occur.
- **Duplicate ACKs:** repeated acknowledgements can indicate a missing segment or frame, depending on the protocol. TCP fast retransmit is commonly triggered by three duplicate ACKs in classic TCP descriptions.

Sequence numbers help distinguish new data from retransmissions and support ordering/duplicate handling. Exact rules differ between link-layer ARQ protocols and TCP.

## Flow control versus congestion control

Flow control protects a receiver from being overwhelmed; it is concerned with receiver capacity. Congestion control protects the network from overload; it responds to conditions such as loss, delay, or congestion signals. A protocol may implement both, but they solve different problems.

## BitSecure lab boundaries

BitSecure includes framing, error detection/correction, Stop-and-Wait, and Sliding Window learning modules. Their outputs are educational simulations; they do not control a physical link or transmit real frames over the user's network.
