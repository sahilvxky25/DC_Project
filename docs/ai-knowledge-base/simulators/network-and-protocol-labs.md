# BitSecure Network and Protocol Simulators

This document describes the learning purpose and boundaries of the network/protocol labs registered in the application.

## Link and reliable-transfer labs

- **Framing:** explores frame boundaries and byte/bit stuffing.
- **Error Detection:** compares parity, checksum, and CRC-style detection.
- **Line Coding and Modulation:** illustrates how digital information can be represented in signals.
- **Channel Capacity:** explores theoretical capacity and factors that limit communication.
- **Stop-and-Wait and Sliding Window:** visualize acknowledgements, timers, outstanding frames, and retransmissions.

These are educational protocol models. They do not drive a physical network interface.

## Network-layer labs

- **Subnetting:** practises IPv4 network/prefix calculations.
- **IP Headers:** inspects network-layer header fields.
- **Routing:** demonstrates route selection and forwarding concepts.
- **Topology Builder:** lets learners construct a model network and inspect connections. It is not a live topology discovery tool.
- **Wi-Fi Simulator:** models access points, clients, SSID, band, channel, signal coverage, simplified interference, and obstacles. Its scores are not real radio measurements and it does not configure a wireless adapter.

## Transport-layer labs

- **TCP/UDP:** compares transport properties and header concepts.
- **Handshake:** steps through the TCP connection handshake.
- **Congestion:** visualizes congestion-window behaviour under events such as duplicate acknowledgements and timeout.
- **Sockets:** explains ports, endpoints, and multiplexing.
- **Network Performance Analyzer:** estimates transfer time, throughput, delivery ratio, and retransmissions from user-selected bandwidth, RTT, packet loss, packet size, packet count, and retry settings. It is not a live speed test and does not measure the user's connection.

## Application and advanced labs

- **DNS:** explains name resolution and caching.
- **HTTP/TLS:** explores requests, responses, methods, status codes, and TLS concepts.
- **Encapsulation:** illustrates headers being added and removed across layers.
- **Encryption and key exchange:** demonstrates cryptographic concepts using browser-side examples.
- **Packet Capture:** provides a learning environment for reading packet-capture concepts and filters; do not describe it as capturing the user's live network traffic unless the implementation is explicitly changed.
- **Troubleshooting:** presents guided cases for diagnosing common networking symptoms.
- **Firewall:** lets learners define ordered sample rules and see which rule matches sample traffic. It does not change the operating system firewall or filter real traffic.

## Protocol comparison and learning features

The protocol comparison lab supports side-by-side comparison and OSI/TCP-IP mapping. Journey, tutorials, challenges, glossary, and quiz experiences support guided learning and practice.

## How the assistant should answer simulator questions

1. Identify the named lab and its learning objective.
2. Explain the relevant networking concept in general terms.
3. Explain what the controls/results mean in this simulation.
4. State the simulation boundary when a learner could mistake it for a real network operation.
5. If a question depends on a control or behaviour not documented here, avoid inventing it and ask for the screen or exact label.
