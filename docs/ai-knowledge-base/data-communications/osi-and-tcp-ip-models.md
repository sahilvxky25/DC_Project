# OSI and TCP/IP Networking Models

## Why layered models exist

Layering divides a complex communication system into responsibilities with defined interfaces. Each layer uses services from the layer below and offers services to the layer above. This supports interoperability, modular design, and troubleshooting.

## OSI seven-layer reference model

| Layer | Main responsibility | Examples |
|---|---|---|
| 7 Application | Network services used by applications | HTTP, DNS, SMTP |
| 6 Presentation | Data representation, translation, compression, encryption concepts | Encoding, format conversion |
| 5 Session | Dialog and session coordination | Session control concepts |
| 4 Transport | Process-to-process delivery, ports, reliability or datagrams | TCP, UDP |
| 3 Network | Logical addressing and routing between networks | IPv4, IPv6, IP routers |
| 2 Data Link | Framing and delivery over a local link | Ethernet, Wi-Fi MAC |
| 1 Physical | Transmission of raw bits as signals | Copper, fibre, radio |

The OSI model is a conceptual reference model. Real Internet protocols do not always map one-to-one to a single OSI layer.

## TCP/IP model

A common four-layer presentation is:

| TCP/IP layer | Typical responsibilities | Approximate OSI mapping |
|---|---|---|
| Application | Application protocols and data representation | OSI 5–7 |
| Transport | End-to-end process delivery | OSI 4 |
| Internet | Logical addressing and routing | OSI 3 |
| Link / Network access | Local framing and physical transmission | OSI 1–2 |

Some teaching materials use a five-layer Internet model by separating physical and data-link responsibilities. State which convention is being used when comparing diagrams.

## Encapsulation

As data moves down the sender's stack, each layer may add its own control information:

- Application data is passed to transport.
- Transport adds a transport header, creating a segment (TCP) or datagram (UDP).
- The Internet layer adds an IP header, creating an IP packet.
- The link layer adds framing information, creating a frame.
- The physical layer transmits bits or symbols.

At the receiver, decapsulation removes and interprets the corresponding headers in reverse order. Tunnelling and encryption can make real captures more complex than this simplified model.

## Addressing at different layers

- Application identifiers include names such as domain names and URLs.
- Transport ports identify application endpoints on a host.
- IP addresses identify network-layer interfaces/locations for routing.
- Link-layer addresses identify interfaces on a local link, subject to the link technology.

These identifiers solve different problems and are not interchangeable.

## Troubleshooting with layers

Start by identifying the symptom and the layer where evidence appears. For example, a valid Wi-Fi association does not prove DNS works; successful DNS resolution does not prove an HTTPS application request succeeds. Use observations from each layer rather than assuming one successful step validates the entire path.

## BitSecure mapping

BitSecure groups learning modules into Link and errors, Reliable transfer, Network layer, Transport layer, Application layer, Advanced, and Journey and learning. These are learning-path groups, not a literal implementation of the seven OSI layers. The protocol comparison lab provides an interactive OSI/TCP-IP mapping.
