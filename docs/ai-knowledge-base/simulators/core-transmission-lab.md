# BitSecure Core Transmission Lab

## Purpose

The core lab demonstrates how a message or file is represented as bytes, divided into packets, transmitted through a simulated link, and reconstructed at the receiver. It is an educational model of an end-to-end data path.

## Stages

The lab presents four stages:

1. **Message & Encoding:** text is encoded as UTF-8 bytes; supported files are read as binary data.
2. **Packetization:** the byte stream is split into payload chunks and packet metadata is associated with each chunk.
3. **Transmission Lab:** packets are animated across a simulated link. Learners can experiment with link conditions and delivery behaviour.
4. **Receiver & Reconstruction:** received data is checked, ordered/retried where supported, and reassembled into the original content.

Supported data modes shown in the interface include text, image, video, documents, and audio. The current interface labels file limits: image up to 2 MB; video up to 10 MB; documents up to 5 MB; audio up to 10 MB. Supported formats and validation are enforced by the corresponding file-input implementation; users should follow the formats displayed in the interface.

## Concepts to explain

- Text becomes bytes through a character encoding such as UTF-8.
- Images, videos, documents, and audio are binary data; they use the same broad byte/packet pipeline.
- Packet size controls payload chunking in the simulation. Smaller chunks generally mean more packets for the same input.
- Packet loss means a packet does not arrive in the current attempt.
- Corruption means received content or check data does not match the expected integrity check.
- A retry/retransmission is another attempt to deliver data that was not accepted.
- Reassembly uses packet ordering/identifiers and the received payloads to rebuild the byte stream.

## Interpreting results

Packet counts and transfer duration are simulation outputs, not measurements of a real network. Animation speed is a visual teaching aid. A successful reconstruction demonstrates that the simulated receiver collected sufficient valid data; it does not establish internet connectivity or guarantee a real file transfer would behave identically.

## Troubleshooting guidance

If a file appears not to load, first check the displayed allowed formats and maximum size, then confirm a file is selected and the browser console has no read/validation error. If transmission does not complete, inspect loss/corruption settings, retry limits, and whether all required packets were received. Avoid telling a learner that the lab has transmitted their file over the internet.

## Scope

The lab is browser-side. It does not send packets to another computer, configure routers, or use an external network transport for its simulated packet animation.
