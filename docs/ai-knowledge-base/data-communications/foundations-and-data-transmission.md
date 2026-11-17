# Data Communications Foundations and Data Transmission

## What data communication means

Data communication is the exchange of information between devices through a transmission medium using agreed rules called protocols. A basic system has a sender, receiver, message, medium, and protocol. Useful measures include delivery, accuracy, timeliness, and jitter where timing matters.

A protocol defines syntax (format), semantics (meaning and control), and timing (when and how quickly actions occur). Communication may be simplex, half-duplex, or full-duplex.

## Data, signals, and media

- **Data** is the information to be represented; it may be text, image, audio, video, or other binary content.
- **Signals** are physical or electromagnetic representations used to carry data.
- **Guided media** include twisted-pair copper, coaxial cable, and optical fibre.
- **Unguided media** include radio, microwave, and infrared transmission.

Bandwidth is a frequency range in hertz in analogue contexts; in networking it is also commonly used informally for a link's bit rate. Throughput is the achieved useful data rate. Latency is the time taken for data to travel or a transaction to complete. These terms are related but not interchangeable.

## Encoding and packetization

Text is encoded into bytes using a character encoding such as UTF-8. Binary files already contain bytes. A sender may divide a byte stream into packets or frames so it can be transmitted, addressed, checked, acknowledged, and retransmitted in manageable units.

A simplified path is:

1. Select a message or file.
2. Represent it as bytes.
3. Divide the byte stream into payload chunks.
4. Add protocol headers and, where appropriate, trailers.
5. Transmit frames or packets across a link.
6. Receive, validate, order, and reassemble the data.

A packet is not the same thing as a frame: packets are commonly associated with the network layer, while frames are link-layer units that carry network-layer packets over a particular link.

## Delay components

A useful simplified one-way delay model is:

`total delay = processing + queuing + transmission + propagation`

- **Processing delay:** time to inspect headers and make forwarding decisions.
- **Queuing delay:** time waiting in a buffer.
- **Transmission delay:** packet length in bits divided by link rate in bits per second.
- **Propagation delay:** physical distance divided by propagation speed in the medium.

For a packet of `L` bits on a link with rate `R` bit/s, transmission delay is `L/R` seconds. Increasing bandwidth reduces transmission delay for a fixed packet size but does not automatically reduce propagation delay.

## Error sources and reliability

Noise, attenuation, interference, and physical faults can corrupt or lose data. Error detection adds redundant information so a receiver can detect some corruptions. Error correction adds enough redundancy to recover some errors without retransmission. Reliable protocols may use acknowledgements, sequence numbers, timers, and retransmissions.

## Common misconceptions

- Bandwidth is not the same as measured throughput.
- A packet's transmission delay is not its propagation delay.
- Packetization does not mean each packet is an independent application message.
- A successful simulation is not proof that a real network path is available.
