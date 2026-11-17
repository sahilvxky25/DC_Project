# Network Layer, IP Addressing, Subnetting, and Routing

## Network-layer purpose

The Internet Protocol provides connectionless, best-effort delivery of packets across interconnected networks. Routers inspect network-layer information and choose a next hop using routing information. IP itself does not guarantee delivery, ordering, or retransmission.

## IPv4 addressing

An IPv4 address is 32 bits, conventionally written as four decimal octets (for example, `192.0.2.10`). A prefix length such as `/24` identifies how many leading bits form the network prefix. The remaining bits identify addresses within that prefix.

A subnet mask expresses the prefix as contiguous one bits followed by zero bits. For a prefix `/p`, the number of host bits is `32 - p`. For ordinary IPv4 subnets with at least two host bits, the traditional number of usable host addresses is `2^(32-p) - 2`, excluding the network and directed broadcast addresses. Special-purpose prefixes and point-to-point conventions can differ.

## Subnetting method

For an IPv4 address and prefix:

1. Convert the prefix to a subnet mask.
2. Apply bitwise AND between the address and mask to obtain the network address.
3. Set all host bits to zero for the network address and all host bits to one for the directed broadcast address.
4. Determine the address range and usable host count according to the subnet convention.

For example, `192.168.10.34/24` belongs to network `192.168.10.0/24`; the conventional usable host range is `192.168.10.1` through `192.168.10.254`, with `192.168.10.255` as broadcast.

## Variable Length Subnet Masking (VLSM)

VLSM allocates subnets of different sizes from a larger address block. A safe planning method is:

1. List required host counts.
2. Sort requirements from largest to smallest.
3. For each requirement, choose the smallest prefix whose usable capacity is sufficient.
4. Allocate on a correctly aligned network boundary.
5. Check that allocations do not overlap and remain inside the parent block.

Allow for network/broadcast addresses when using conventional IPv4 LAN subnetting.

## IPv6 overview

IPv6 uses 128-bit addresses written in hexadecimal groups. It has a much larger address space and uses prefix lengths. IPv6 does not use broadcast; it uses multicast and anycast. Do not apply IPv4 dotted-decimal or network/broadcast-host formulas directly to IPv6.

## Routing

A router selects a route using its routing table. When multiple prefixes match a destination, longest-prefix match generally selects the most specific matching route. A route can be directly connected, static, or learned through a routing protocol. The selected route determines a next hop and outgoing interface; it does not necessarily reveal the complete end-to-end path.

## ARP and neighbour discovery

IPv4 commonly uses ARP to resolve a local next-hop IPv4 address to a link-layer address on a local network. IPv6 uses Neighbor Discovery Protocol (NDP), based on ICMPv6. A host resolves the local next hop, which may be its default gateway rather than the final remote destination.

## BitSecure modules

The Network layer group includes subnetting, IP headers, routing, topology building, and a Wi-Fi simulator. The subnetting tools are for learning and calculation. The topology and Wi-Fi labs are simplified browser models, not live network discovery or device configuration.
