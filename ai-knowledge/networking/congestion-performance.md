# TCP congestion control and network performance

Flow control protects the receiver from being overwhelmed; congestion control responds to conditions in the network. TCP congestion-control algorithms adjust the congestion window (cwnd) based on acknowledgements, loss signals, and other congestion feedback.

A retransmission timeout (RTO) indicates that an expected acknowledgement did not arrive within the timeout. Three duplicate ACKs traditionally trigger fast retransmit in classic TCP Reno-style explanations. Modern TCP variants can behave differently, so explain the algorithm being discussed.

Throughput is the rate of successfully delivered data over time. Bandwidth is a link's capacity, while latency is delay. Packet loss is the fraction of transmitted packets that fail to arrive. Simulator estimates depend on configured inputs and are not live internet measurements unless explicitly connected to measurement infrastructure.
