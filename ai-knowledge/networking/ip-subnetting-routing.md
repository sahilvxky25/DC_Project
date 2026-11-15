# IP addressing, subnetting, and routing

IPv4 addresses are 32 bits, commonly written as four decimal octets. A CIDR prefix such as /24 states how many leading bits identify the network. The remaining bits identify host addresses within that subnet.

For a conventional IPv4 subnet with prefix length /p (where p is 0 through 30), the total address count is 2^(32-p), and the conventional usable host count is total minus two for network and broadcast addresses. /31 point-to-point and /32 host routes are special cases. The subnet mask has p leading one bits followed by zero bits.

To calculate a subnet: convert the prefix to a mask, identify the block size in the changing octet, find the network boundary at or below the address, then determine broadcast and usable host range where applicable.

Routers forward IP packets between networks using routing tables. A router generally selects the matching route with the longest prefix (longest-prefix match). A default route is used when no more-specific route matches.
