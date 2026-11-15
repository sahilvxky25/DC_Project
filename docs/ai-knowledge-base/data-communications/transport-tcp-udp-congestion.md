# Transport Layer: TCP, UDP, Ports, and Congestion

## Transport-layer role

The transport layer provides communication between application processes on hosts. Port numbers help identify the sending and receiving application endpoints. Transport protocols may provide reliable byte streams or lightweight datagram delivery.

## TCP

Transmission Control Protocol (TCP) provides a reliable, ordered byte stream. It uses sequence numbers, acknowledgements, retransmission, checksums, flow control, and congestion control. TCP does not preserve application message boundaries: an application writes bytes and the receiver reads a byte stream.

A simplified three-way handshake is:

1. Client sends SYN with an initial sequence number.
2. Server replies SYN-ACK, acknowledging the client's SYN and providing its own initial sequence number.
3. Client sends ACK.

The handshake synchronizes sequence-number state and establishes the connection. It is not an encryption handshake; TLS may be layered above TCP in common HTTPS deployments.

## UDP

User Datagram Protocol (UDP) provides connectionless datagrams with minimal transport functionality. It includes source and destination ports, length, and checksum fields. UDP does not itself provide reliable delivery, ordering, retransmission, congestion control, or connection setup. Applications can implement additional behaviour when needed.

## TCP versus UDP

| Property | TCP | UDP |
|---|---|---|
| Communication abstraction | Ordered byte stream | Datagrams |
| Connection setup | Yes, handshake | No transport handshake |
| Built-in reliability | Yes | No |
| Message boundaries | Not preserved | Preserved per datagram |
| Flow/congestion control | Built in | Not provided by UDP itself |
| Common uses | Web, file transfer, many APIs | DNS, real-time media, games, QUIC transport foundation |

Modern protocols can change the usual examples. QUIC, for example, runs over UDP while implementing reliable streams and security at a higher protocol layer.

## Ports and multiplexing

Ports are 16-bit transport identifiers. A socket endpoint is commonly described by an IP address and port, plus transport protocol. Servers often listen on well-known ports, but a port number alone does not prove which service is running.

Multiplexing allows multiple application conversations to share network resources. Demultiplexing uses header information to deliver received data to the appropriate socket/application.

## Flow control

TCP's receive window communicates how much additional data the receiver is prepared to accept. It helps avoid overrunning receiver buffers. It is distinct from the congestion window, which is maintained by the sender's congestion-control algorithm.

## Congestion control

Congestion control adapts sending behaviour to avoid overwhelming the network. Common TCP concepts include slow start, congestion avoidance, fast retransmit, and recovery. Loss may be inferred through timeout or duplicate acknowledgements. In classic Reno-style teaching models, three duplicate ACKs can trigger fast retransmit; a retransmission timeout generally signals a more severe loss/timeout event and can reduce the congestion window more sharply. Exact algorithms vary by TCP implementation and version.

## BitSecure modules

The Transport layer group includes TCP/UDP comparison, TCP handshake, congestion control, sockets/multiplexing, and a Network Performance Analyzer. The analyzer is a parameter-driven educational estimate, not a measurement of the user's live internet connection.
