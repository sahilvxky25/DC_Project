# TCP, UDP, and the TCP three-way handshake

TCP is connection-oriented and provides a reliable, ordered byte stream using sequence numbers, acknowledgements, retransmission, flow control, and congestion control. UDP is connectionless and sends independent datagrams without guaranteeing delivery, ordering, or duplicate protection. Applications choose based on their needs; UDP can be appropriate for real-time media, DNS queries, and protocols that implement their own reliability.

A TCP three-way handshake establishes a connection:
1. Client sends SYN with its initial sequence number.
2. Server responds with SYN-ACK, acknowledging the client's sequence and supplying its own initial sequence number.
3. Client sends ACK acknowledging the server's sequence. Data transfer can then begin.

A port identifies an application endpoint on a host. TCP and UDP use 16-bit port numbers. A socket endpoint is commonly described by an IP address and port, with transport protocol context.
