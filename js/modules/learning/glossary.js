/**
 * learning module: Reference and glossary
 *
 * Searchable glossary, layered-model table, port and status-code tables and a subnet cheat sheet.
 *
 * This file registers one learning module with regMod(). Its mount(root) function builds the screen inside
 * `root` and attaches event handlers; the function mount() returns (if any) is its cleanup, called by the router
 * when the learner leaves, so timers and listeners do not outlive the screen. The protocol logic lives in
 * ../../simulations/ and ../../core/; this file is the user interface for it.
 *
 * Imports:
 *   - ../../core/ui-helpers.js (shared HTML builders: icons, tables, tabs, ladder diagrams): icon, on, panel, tabset, tbl
 *   - ../../core/utils.js (tiny DOM, math and timing helpers): $, $$, REDUCE, esc, fmtN
 *   - ../../core/state.js (shared in-memory state): DC
 *   - ../../core/addressing.js (IPv4/IPv6 address and CIDR calculations): ip4, mk
 *   - ../registry.js (learning-module registry and group definitions): regMod
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { ip4, mk } from '../../core/addressing.js';
import { DC } from '../../core/state.js';
import { icon, on, panel, tabset, tbl } from '../../core/ui-helpers.js';
import { $, $$, esc, fmtN, REDUCE } from '../../core/utils.js';
import { regMod } from '../registry.js';

/**
 * Glossary entries: [term, layer, definition, related terms, module id to open].
 */
const GLOSS = [
  [
    'ACK',
    'Reliable',
    'A message confirming that data arrived. TCP uses cumulative ACK numbers that name the next byte expected.',
    ['Sequence number', 'Retransmission', 'Window'],
    'saw',
  ],
  [
    'ARP',
    'Link',
    'Address Resolution Protocol: asks “who has this IP address?” on the local network and learns the MAC address in reply.',
    ['MAC address', 'IP address'],
    'encap',
  ],
  [
    'Bandwidth',
    'Physical',
    'How many bits per second a link can carry. Not the same as latency, which is how long one bit takes.',
    ['Latency', 'RTT'],
    'saw',
  ],
  [
    'Bit stuffing',
    'Link',
    'Inserting a 0 after five consecutive 1s so the frame flag 01111110 can never appear inside data.',
    ['Byte stuffing', 'Frame'],
    'framing',
  ],
  [
    'Broadcast address',
    'Network',
    'The last address in a subnet, used to reach every host on that network at once.',
    ['Subnet mask', 'CIDR'],
    'subnets',
  ],
  [
    'Byte stuffing',
    'Link',
    'Preceding any data byte that looks like a flag with an escape byte so frame boundaries stay unambiguous.',
    ['Bit stuffing', 'Frame'],
    'framing',
  ],
  [
    'Checksum',
    'Link',
    'A small value computed from data so a receiver can detect corruption. The Internet checksum is a ones’-complement sum of 16-bit words.',
    ['CRC', 'Parity'],
    'errors',
  ],
  [
    'CIDR',
    'Network',
    'Classless Inter-Domain Routing: writing an address with its prefix length, such as 192.168.1.0/24.',
    ['Subnet mask', 'IP address'],
    'subnets',
  ],
  [
    'Congestion window',
    'Transport',
    'The sender’s own limit on unacknowledged data, grown and shrunk to avoid overloading the network.',
    ['Window', 'RTT'],
    'congestion',
  ],
  [
    'CRC',
    'Link',
    'Cyclic redundancy check: treats data as a polynomial, divides it by a fixed one and sends the remainder. Detects all short bursts and most random errors.',
    ['Checksum', 'Parity'],
    'errors',
  ],
  [
    'Datagram',
    'Network',
    'A self-contained packet sent without a connection, such as a UDP datagram.',
    ['UDP', 'Packet'],
    'tcpudp',
  ],
  [
    'Default gateway',
    'Network',
    'The router a host sends traffic to when the destination is outside its own subnet.',
    ['Router', 'Subnet mask'],
    'routing',
  ],
  [
    'DHCP',
    'Application',
    'Dynamic Host Configuration Protocol: hands out an address, mask, gateway and DNS server to hosts automatically.',
    ['IP address', 'DNS'],
    'trouble',
  ],
  [
    'DNS',
    'Application',
    'The Domain Name System: a distributed database that maps names to addresses and other records.',
    ['Resolver', 'TTL'],
    'dns',
  ],
  [
    'Encapsulation',
    'All',
    'Wrapping data with a header (and sometimes a trailer) at each layer on the way down, and removing them on the way up.',
    ['Header', 'Payload'],
    'encap',
  ],
  [
    'Ethernet',
    'Link',
    'The dominant wired LAN technology. Frames carry MAC addresses, an EtherType and a CRC-32 trailer.',
    ['Frame', 'MAC address'],
    'encap',
  ],
  [
    'Fragmentation',
    'Network',
    'Splitting an IP packet into smaller pieces to fit a link’s MTU. The receiver reassembles by offset.',
    ['MTU', 'IP address'],
    'ipheaders',
  ],
  [
    'Frame',
    'Link',
    'The unit of data at the link layer: a packet plus a header and trailer.',
    ['Packet', 'Ethernet'],
    'framing',
  ],
  [
    'Go-Back-N',
    'Reliable',
    'A sliding-window protocol where the receiver accepts only in-order frames and the sender resends from the first lost one.',
    ['Selective Repeat', 'Window'],
    'window',
  ],
  [
    'Handshake',
    'Transport',
    'The exchange that opens a connection. TCP uses SYN, SYN-ACK, ACK to agree on starting sequence numbers.',
    ['TCP', 'Sequence number'],
    'handshake',
  ],
  [
    'Header',
    'All',
    'Control information a layer adds in front of its payload.',
    ['Payload', 'Encapsulation'],
    'encap',
  ],
  [
    'HTTP',
    'Application',
    'The request and response protocol of the web, carried over TCP, TLS or QUIC.',
    ['TLS', 'Socket'],
    'http',
  ],
  [
    'ICMP',
    'Network',
    'Internet Control Message Protocol: error and diagnostic messages such as echo reply (ping) and time exceeded.',
    ['TTL', 'Router'],
    'ipheaders',
  ],
  [
    'IP address',
    'Network',
    'A number that identifies a host’s network attachment: 32 bits in IPv4, 128 bits in IPv6.',
    ['CIDR', 'Subnet mask'],
    'subnets',
  ],
  [
    'Latency',
    'Physical',
    'The time for data to cross a link or path, from propagation, queueing and processing.',
    ['RTT', 'Bandwidth'],
    'saw',
  ],
  [
    'MAC address',
    'Link',
    'A 48-bit hardware address that identifies a network interface on a local link.',
    ['Ethernet', 'ARP'],
    'encap',
  ],
  [
    'MSS',
    'Transport',
    'Maximum segment size: the largest TCP payload a peer will accept, usually MTU minus 40 bytes.',
    ['MTU', 'Segment'],
    'capture',
  ],
  [
    'MTU',
    'Link',
    'Maximum transmission unit: the largest packet a link can carry, 1500 bytes for Ethernet.',
    ['Fragmentation', 'MSS'],
    'ipheaders',
  ],
  [
    'NAT',
    'Network',
    'Network address translation: rewrites private addresses and ports to a shared public address.',
    ['Port', 'IP address'],
    'sockets',
  ],
  [
    'Packet',
    'Network',
    'The unit of data at the network layer, with a header and a payload.',
    ['Frame', 'Segment'],
    'ipheaders',
  ],
  [
    'Parity',
    'Link',
    'An extra bit that makes the count of 1s even (or odd). Detects any odd number of flips.',
    ['Checksum', 'CRC'],
    'errors',
  ],
  [
    'Payload',
    'All',
    'The data a layer carries, excluding its own header.',
    ['Header', 'Encapsulation'],
    'encap',
  ],
  [
    'Port',
    'Transport',
    'A 16-bit number that identifies an application or service on a host.',
    ['Socket', 'NAT'],
    'sockets',
  ],
  [
    'Protocol',
    'All',
    'A set of rules for formatting and exchanging messages.',
    ['Header', 'Handshake'],
    'tcpudp',
  ],
  [
    'QUIC',
    'Transport',
    'A UDP-based transport that merges the transport and TLS handshakes and carries HTTP/3.',
    ['UDP', 'TLS'],
    'http',
  ],
  [
    'Resolver',
    'Application',
    'The DNS server a host asks, which does the work of finding the answer and caches it.',
    ['DNS', 'TTL'],
    'dns',
  ],
  [
    'Retransmission',
    'Reliable',
    'Sending data again because it was lost, usually after a timer expires or duplicate ACKs arrive.',
    ['ACK', 'RTO'],
    'saw',
  ],
  [
    'Router',
    'Network',
    'A device that forwards packets between networks using a forwarding table.',
    ['Default gateway', 'TTL'],
    'routing',
  ],
  [
    'RTO',
    'Transport',
    'Retransmission timeout: how long TCP waits for an ACK before resending.',
    ['RTT', 'Retransmission'],
    'congestion',
  ],
  [
    'RTT',
    'Transport',
    'Round-trip time: how long a message takes to reach the peer and for the reply to return.',
    ['Latency', 'RTO'],
    'congestion',
  ],
  [
    'Segment',
    'Transport',
    'A TCP unit of data: a header plus a slice of the byte stream.',
    ['TCP', 'Packet'],
    'tcpudp',
  ],
  [
    'Selective Repeat',
    'Reliable',
    'A sliding-window protocol where the receiver buffers out-of-order frames and only lost ones are resent.',
    ['Go-Back-N', 'Window'],
    'window',
  ],
  [
    'Sequence number',
    'Reliable',
    'A number on each frame or byte that lets the receiver order data and spot duplicates.',
    ['ACK', 'Window'],
    'handshake',
  ],
  [
    'Socket',
    'Transport',
    'One endpoint of a conversation, identified by protocol, address and port.',
    ['Port', 'TCP'],
    'sockets',
  ],
  [
    'Stop-and-Wait',
    'Reliable',
    'The simplest ARQ protocol: send one frame, wait for its ACK.',
    ['ACK', 'Window'],
    'saw',
  ],
  [
    'Subnet mask',
    'Network',
    'A 32-bit pattern whose 1s mark the network part of an address.',
    ['CIDR', 'IP address'],
    'subnets',
  ],
  [
    'TCP',
    'Transport',
    'Transmission Control Protocol: a reliable, ordered byte stream with flow and congestion control.',
    ['UDP', 'Handshake'],
    'tcpudp',
  ],
  [
    'TLS',
    'Application',
    'Transport Layer Security: authenticates the server and encrypts the connection.',
    ['HTTP', 'Handshake'],
    'http',
  ],
  [
    'TTL',
    'Network',
    'Time to live: a hop budget lowered by each router. At 0 the packet is dropped. In DNS, TTL is how long an answer may be cached.',
    ['Router', 'ICMP'],
    'ipheaders',
  ],
  [
    'UDP',
    'Transport',
    'User Datagram Protocol: connectionless and unreliable, with an 8-byte header.',
    ['TCP', 'Datagram'],
    'tcpudp',
  ],
  [
    'UTF-8',
    'Presentation',
    'A variable-length encoding of Unicode using one to four bytes per character.',
    ['Payload'],
    'journey',
  ],
  [
    'Window',
    'Reliable',
    'The amount of data allowed in flight and not yet acknowledged.',
    ['Congestion window', 'ACK'],
    'window',
  ],
];

/**
 * Well-known ports: [port, transport, service].
 */
const PORTS = [
  { port: 20, service: 'FTP Data', transports: ['TCP'], category: 'well-known', description: 'Traditional FTP data transfer channel in active-mode FTP.', example: 'An FTP client transfers file data using active mode.' },
  { port: 21, service: 'FTP Control', transports: ['TCP'], category: 'well-known', description: 'FTP commands and session control.', example: 'An FTP client sends commands to a server.' },
  { port: 22, service: 'SSH / SFTP', transports: ['TCP'], category: 'well-known', description: 'Secure remote login and administration. SFTP is a file-transfer protocol carried over SSH.', example: 'An administrator connects to a remote Linux host.' },
  { port: 23, service: 'Telnet', transports: ['TCP'], category: 'well-known', description: 'Legacy remote terminal access; it does not protect credentials with encryption.', example: 'A legacy device accepts a Telnet session.' },
  { port: 25, service: 'SMTP', transports: ['TCP'], category: 'well-known', description: 'Commonly used for mail transfer between mail servers.', example: 'A mail server forwards a message to another mail server.' },
  { port: 53, service: 'DNS', transports: ['UDP', 'TCP'], category: 'well-known', description: 'Domain Name System queries and responses; both transports are used depending on the exchange.', example: 'A resolver looks up the address for a domain name.' },
  { port: 67, service: 'DHCP Server', transports: ['UDP'], category: 'well-known', description: 'Server-side port used by DHCP for IPv4 configuration.', example: 'A DHCP server offers an address to a client.' },
  { port: 68, service: 'DHCP Client', transports: ['UDP'], category: 'well-known', description: 'Client-side port used by DHCP for IPv4 configuration.', example: 'A device requests network configuration when joining a LAN.' },
  { port: 69, service: 'TFTP', transports: ['UDP'], category: 'well-known', description: 'Trivial File Transfer Protocol, often used in simple or managed-device transfers.', example: 'A device retrieves a configuration or boot file.' },
  { port: 80, service: 'HTTP', transports: ['TCP'], category: 'well-known', description: 'Traditional HTTP web traffic over TCP.', example: 'A browser requests a page over an HTTP connection.' },
  { port: 110, service: 'POP3', transports: ['TCP'], category: 'well-known', description: 'Email retrieval protocol.', example: 'A mail client retrieves messages from a POP3 server.' },
  { port: 123, service: 'NTP', transports: ['UDP'], category: 'well-known', description: 'Network time synchronization.', example: 'A device synchronizes its clock with a time server.' },
  { port: 143, service: 'IMAP', transports: ['TCP'], category: 'well-known', description: 'Email access and mailbox synchronization.', example: 'A mail client lists messages stored on a server.' },
  { port: 161, service: 'SNMP', transports: ['UDP'], category: 'well-known', description: 'Commonly used for network monitoring and management queries.', example: 'A monitoring system reads interface counters from a managed device.' },
  { port: 389, service: 'LDAP', transports: ['TCP', 'UDP'], category: 'well-known', description: 'Directory access protocol; transport use depends on the operation and implementation.', example: 'An application queries a directory service.' },
  { port: 443, service: 'HTTPS / HTTP/3', transports: ['TCP', 'UDP'], category: 'well-known', description: 'HTTPS commonly uses TCP with TLS; HTTP/3 uses QUIC over UDP, commonly on port 443.', example: 'A browser opens a secure website.' },
  { port: 445, service: 'SMB', transports: ['TCP'], category: 'well-known', description: 'Server Message Block file and printer sharing, commonly in Windows networks.', example: 'A workstation accesses a shared folder.' },
  { port: 465, service: 'SMTPS', transports: ['TCP'], category: 'well-known', description: 'Email submission using implicit TLS in common deployments.', example: 'A mail client submits email over an encrypted connection.' },
  { port: 587, service: 'SMTP Submission', transports: ['TCP'], category: 'well-known', description: 'Mail submission from clients to mail servers, commonly with STARTTLS where supported.', example: 'A mail client submits an outgoing message.' },
  { port: 993, service: 'IMAPS', transports: ['TCP'], category: 'well-known', description: 'IMAP over TLS.', example: 'A mail client synchronizes a mailbox over an encrypted connection.' },
  { port: 995, service: 'POP3S', transports: ['TCP'], category: 'well-known', description: 'POP3 over TLS.', example: 'A mail client retrieves email over an encrypted connection.' },
  { port: 1433, service: 'Microsoft SQL Server', transports: ['TCP'], category: 'registered', description: 'Common default port for Microsoft SQL Server database connections.', example: 'An application connects to a SQL Server database.' },
  { port: 1521, service: 'Oracle Database', transports: ['TCP'], category: 'registered', description: 'Commonly associated with Oracle Database listener connections.', example: 'A client connects to an Oracle database listener.' },
  { port: 2049, service: 'NFS', transports: ['TCP', 'UDP'], category: 'registered', description: 'Network File System; transport support depends on version and configuration.', example: 'A host accesses a remote network file system.' },
  { port: 3306, service: 'MySQL', transports: ['TCP'], category: 'registered', description: 'Common default port for MySQL database connections.', example: 'A web application queries a MySQL database.' },
  { port: 3389, service: 'RDP', transports: ['TCP', 'UDP'], category: 'registered', description: 'Remote Desktop Protocol, which can use TCP and UDP transports.', example: 'A user connects to a Windows desktop remotely.' },
  { port: 5432, service: 'PostgreSQL', transports: ['TCP'], category: 'registered', description: 'Common default port for PostgreSQL database connections.', example: 'An application connects to a PostgreSQL database.' },
  { port: 5900, service: 'VNC', transports: ['TCP'], category: 'registered', description: 'Commonly used by Virtual Network Computing remote desktop services.', example: 'A support technician views a remote desktop.' },
  { port: 6379, service: 'Redis', transports: ['TCP'], category: 'registered', description: 'Common default port for Redis data-store connections.', example: 'An application reads cached data from Redis.' },
  { port: 8080, service: 'Alternative HTTP', transports: ['TCP'], category: 'registered', description: 'Frequently used as an alternative web or development-server port; not a guarantee of HTTP service.', example: 'A developer runs a local web server on port 8080.' },
  { port: 8443, service: 'Alternative HTTPS', transports: ['TCP'], category: 'registered', description: 'Frequently used as an alternative HTTPS port; actual service configuration varies.', example: 'An application exposes an HTTPS admin interface on a non-default port.' }
];

/**
 * Common HTTP status codes: [code, meaning].
 */
const CODES = [
  [100, 'Continue'],
  [200, 'OK'],
  [201, 'Created'],
  [204, 'No Content'],
  [301, 'Moved Permanently'],
  [302, 'Found (temporary redirect)'],
  [304, 'Not Modified'],
  [400, 'Bad Request'],
  [401, 'Unauthorized'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [405, 'Method Not Allowed'],
  [418, 'I’m a teapot'],
  [429, 'Too Many Requests'],
  [500, 'Internal Server Error'],
  [502, 'Bad Gateway'],
  [503, 'Service Unavailable'],
  [504, 'Gateway Timeout'],
];

/* Register "Reference and glossary". The router calls mount(root) when the learner opens #/m/glossary and calls the returned function (if any) when they leave. */
regMod({
  id: 'glossary',
  group: 'learn',
  title: 'Reference and glossary',
  desc: 'Look up terms, ports, status codes, the layered models and a subnet cheat sheet.',
  obj: [
    'Find a term fast and jump to related concepts.',
    'Compare the OSI and TCP/IP models.',
    'Keep the common ports and status codes handy.',
  ],
  mount(root) {
    root.innerHTML = '<div id="gltabs"></div>';
    const tabs = tabset(
      $('#gltabs', root),
      [
        {
          label: 'Glossary',
          render(p) {
            const layers = ['All', ...new Set(GLOSS.map(g => g[1]))].filter(
              x => x !== 'All' || true
            );
            let layer = 'All',
              open = null;
            p.innerHTML = panel(
              'Search the glossary',
              `<div class="search-row">${icon('search')}<input id="gq" type="search" placeholder="Search terms: ACK, CRC, TTL, MSS…" aria-label="Search glossary" value="${esc(DC.glossQ || '')}"></div>
          <div class="filters" id="gl">${layers.map(l => `<button class="chipbtn${l === 'All' ? ' on' : ''}" data-l="${l}">${l}</button>`).join('')}</div><p class="hint" id="gcount"></p><div id="gdet"></div><div class="dgrid" id="gg"></div>`
            );
            DC.glossQ = '';
            const f = () => {
              const q = $('#gq', p).value.trim().toLowerCase(),
                list = GLOSS.filter(
                  g =>
                    (layer === 'All' || g[1] === layer) &&
                    (!q || (g[0] + ' ' + g[2]).toLowerCase().includes(q))
                );
              $('#gcount', p).textContent = `${list.length} of ${GLOSS.length} terms`;
              $('#gg', p).innerHTML =
                list
                  .map(
                    g =>
                      `<button class="mc gterm${open === g[0] ? ' open' : ''}" data-t="${esc(g[0])}"><span class="pill">${g[1]}</span><h3>${g[0]}</h3><p>${esc(g[2].length > 90 ? g[2].slice(0, 87) + '…' : g[2])}</p></button>`
                  )
                  .join('') || '<p class="hint">No terms match.</p>';
              const t = GLOSS.find(g => g[0] === open);
              $('#gdet', p).innerHTML = t
                ? `<div class="panel detail"><h3>${t[0]} <span class="pill">${t[1]}</span></h3><p>${esc(t[2])}</p><div class="chips">${t[3].map(r => `<button class="chipbtn" data-t="${esc(r)}">${r}</button>`).join('')}${t[4] ? `<a class="btn sm" href="#/m/${t[4]}">Open related module →</a>` : ''}</div></div>`
                : '';
            };
            $('#gq', p).oninput = () => {
              open = null;
              f();
            };
            $('#gl', p).onclick = e => {
              const b = e.target.closest('[data-l]');
              if (!b) return;
              layer = b.dataset.l;
              $$('#gl .chipbtn', p).forEach(x => x.classList.toggle('on', x === b));
              f();
            };
            on(p, 'click', '[data-t]', (e, b) => {
              open = b.dataset.t;
              $('#gq', p).value = '';
              layer = 'All';
              $$('#gl .chipbtn', p).forEach(x => x.classList.toggle('on', x.dataset.l === 'All'));
              f();
              window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' });
            });
            const q0 = $('#gq', p).value.toLowerCase().trim();
            if (q0) {
              const exact = GLOSS.find(g => g[0].toLowerCase() === q0);
              if (exact) open = exact[0];
            }
            f();
          },
        },
        {
          label: 'Layered models',
          render(p) {
            p.innerHTML = panel(
              'OSI and TCP/IP',
              tbl(
                ['OSI layer', 'TCP/IP layer', 'Unit', 'Examples', 'Where in this lab'],
                [
                  [
                    '7 Application',
                    'Application',
                    'message',
                    'HTTP, DNS, SMTP',
                    'DNS, HTTP and TLS',
                  ],
                  [
                    '6 Presentation',
                    'Application',
                    'message',
                    'UTF-8, TLS encryption',
                    'Message & Encoding',
                  ],
                  [
                    '5 Session',
                    'Application',
                    'message',
                    'TLS sessions, sockets',
                    'Sockets and multiplexing',
                  ],
                  [
                    '4 Transport',
                    'Transport',
                    'segment / datagram',
                    'TCP, UDP, QUIC',
                    'TCP and UDP, Handshake, Congestion',
                  ],
                  [
                    '3 Network',
                    'Internet',
                    'packet',
                    'IP, ICMP, routing',
                    'Subnets, IP headers, Routing',
                  ],
                  [
                    '2 Data link',
                    'Link',
                    'frame',
                    'Ethernet, Wi-Fi',
                    'Framing, Error detection, ARQ',
                  ],
                  ['1 Physical', 'Link', 'bit', 'Copper, fibre, radio', 'Transmission Lab'],
                ]
              ),
              'The OSI model has seven layers and is mostly used for teaching. The Internet is built on the four-layer TCP/IP model.'
            );
          },
        },
        {
          label: 'Ports and status codes',
          render(p) {
            const questions = [
              { q: 'Which port is commonly associated with SSH?', options: ['21', '22', '53', '80'], answer: '22', why: 'SSH commonly uses TCP port 22 for secure remote access.' },
              { q: 'Which transport is used by NTP on port 123?', options: ['TCP', 'UDP', 'TCP only', 'ICMP'], answer: 'UDP', why: 'NTP commonly uses UDP port 123.' },
              { q: 'Which port is commonly associated with DNS?', options: ['25', '53', '110', '443'], answer: '53', why: 'DNS commonly uses port 53 over UDP and TCP.' },
              { q: 'Which port is commonly associated with HTTPS?', options: ['80', '123', '443', '3389'], answer: '443', why: 'HTTPS commonly uses TCP port 443; HTTP/3 uses QUIC over UDP port 443.' },
              { q: 'Which service is commonly associated with TCP port 3306?', options: ['MySQL', 'SSH', 'NTP', 'RDP'], answer: 'MySQL', why: 'MySQL commonly accepts TCP connections on port 3306.' }
            ];
            let activeTransport = 'ALL';
            let activeCategory = 'ALL';
            let selectedPort = null;
            let quizIndex = 0;
            let quizAnswered = false;
            p.innerHTML = `
              <div class="panel port-reference">
                <div class="port-ref-heading">
                  <div><span class="pill">NETWORKING QUICK REFERENCE</span><h3>Port Number Reference</h3>
                  <p class="hint">Search common ports, compare transports, and learn what services typically use them.</p></div>
                </div>
                <div class="search-row">${icon('search')}<input id="portSearch" type="search" placeholder="Search port, service, protocol, or purpose…" aria-label="Search port reference"></div>
                <div class="filters" id="portTransportFilters" aria-label="Filter by transport">
                  <button class="chipbtn on" type="button" data-transport="ALL">All transports</button>
                  <button class="chipbtn" type="button" data-transport="TCP">TCP</button>
                  <button class="chipbtn" type="button" data-transport="UDP">UDP</button>
                </div>
                <div class="filters" id="portCategoryFilters" aria-label="Filter by port range">
                  <button class="chipbtn on" type="button" data-category="ALL">All ranges</button>
                  <button class="chipbtn" type="button" data-category="well-known">Well-known (0–1023)</button>
                  <button class="chipbtn" type="button" data-category="registered">Registered (1024–49151)</button>
                  
                </div>
                <div class="port-browse-controls">
                  <button class="btn ghost sm" id="prevPortRange" type="button" disabled>← Previous 10 ports</button>
                  <button class="btn sm" id="nextPortRange" type="button">Next 10 ports →</button>
                  <span class="hint">Browse assigned ports 0–49151 in small blocks to include every registration.</span>
                </div>
                <p class="hint" id="portCount" aria-live="polite"></p>
                <div class="port-table-wrap" id="portTable"></div>
                <div id="portDetail" aria-live="polite"></div>
                <p class="hint">Port associations are conventional, not proof that a service is running or secure. Services can be configured to use other ports. Dynamic/private ports are 49152–65535 and are commonly used for temporary connections; this starter list focuses on common service ports.</p>
              </div>
              <div class="panel">
                <h3>Test your knowledge</h3>
                <div id="portQuiz" class="port-quiz"></div>
              </div>
              <div class="panel">
                <h3>HTTP status codes</h3>
                <div class="search-row">${icon('search')}<input id="sq" type="search" placeholder="Filter: 404, redirect, error…" aria-label="Filter status codes"></div>
                <div id="sc"></div>
              </div>`;
            let portRequestId = 0;
            let portWindowStart = 0;
            const renderPorts = async () => {
              const requestId = ++portRequestId;
              const q = $('#portSearch', p).value.trim();
              const params = new URLSearchParams({ count: '100' });
              let url;
              let description;
              if (/^\\d{1,5}$/.test(q) && Number(q) <= 65535) {
                url = 'https://randomapi.dev/api/ports/lookup?' + new URLSearchParams({ port: String(Number(q)) });
                description = 'exact port ' + Number(q);
              } else {
                if (q) params.set('search', q.slice(0, 64));
                else {
                  params.set('portFrom', String(portWindowStart));
                  params.set('portTo', String(Math.min(49151, portWindowStart + 9)));
                }
                if (activeTransport !== 'ALL') params.set('protocol', activeTransport.toLowerCase());
                if (activeCategory === 'well-known') params.set('range', 'system');
                if (activeCategory === 'registered') params.set('range', 'registered');
                url = 'https://randomapi.dev/api/ports?' + params.toString();
                description = q ? 'search results for “' + q + '”' : 'registry ports ' + portWindowStart + '–' + Math.min(49151, portWindowStart + 9);
              }
              $('#portCount', p).textContent = 'Loading IANA port registry…';
              $('#portTable', p).innerHTML = '<p class="hint">Fetching registered services…</p>';
              try {
                const response = await fetch(url, { headers: { Accept: 'application/json' } });
                if (!response.ok) throw new Error('Port registry request failed: ' + response.status);
                const payload = await response.json();
                if (requestId !== portRequestId) return;
                let rows = Array.isArray(payload.data) ? payload.data : payload.data?.registrations;
                if (!Array.isArray(rows)) rows = [];
                const normalized = rows.map(row => ({
                  port: Number(row.port),
                  service: row.serviceName || 'Reserved / Unassigned',
                  transports: row.protocol ? [String(row.protocol).toUpperCase()] : ['Unspecified'],
                  category: row.range === 'system' ? 'well-known' : 'registered',
                  description: row.description || 'No description supplied in the IANA registry.',
                  example: 'IANA registration: ' + (row.reference || 'No reference listed.'),
                  assignedRange: row.assignedRange || '',
                  registrationDate: row.registrationDate || '',
                  note: row.note || '',
                  unauthorizedUse: row.unauthorizedUse || ''
                }));
                PORTS.splice(0, PORTS.length, ...normalized);
                const filtered = normalized.filter(item =>
                  (activeTransport === 'ALL' || item.transports.includes(activeTransport)) &&
                  (activeCategory === 'ALL' || item.category === activeCategory)
                );
                $('#portCount', p).textContent = filtered.length + ' registration(s) · ' + description + ' · IANA registry API';
                $('#portTable', p).innerHTML = filtered.length
                  ? '<table class="port-table"><thead><tr><th scope="col">Port</th><th scope="col">Service</th><th scope="col">Transport</th><th scope="col">Details</th></tr></thead><tbody>' + filtered.map(item =>
                      '<tr><td><button type="button" class="port-number" data-port="' + item.port + '">' + item.port + (item.assignedRange ? '*' : '') + '</button></td><td>' + esc(item.service) + '</td><td>' + item.transports.map(t => '<span class="pill">' + esc(t) + '</span>').join(' ') + '</td><td><button class="btn ghost sm" type="button" data-port="' + item.port + '">View details</button></td></tr>'
                    ).join('') + '</tbody></table>'
                  : '<p class="hint">No matching registry entries. Try a service name or another port number.</p>';
                $('#portDetail', p).innerHTML = '';
                selectedPort = null;
              } catch (error) {
                if (requestId !== portRequestId) return;
                $('#portCount', p).textContent = 'Could not load port data from the registry API.';
                $('#portTable', p).innerHTML = '<p class="hint">Check your internet connection and retry. The live registry API is required for this lookup.</p>';
              }
            };
            const showPortDetail = item => {
              selectedPort = item.port;
              $('#portDetail', p).innerHTML = `
                <div class="port-detail-card">
                  <div class="port-detail-top"><div><span class="pill">PORT ${item.port}</span><h3>${esc(item.service)}</h3></div>
                    <button type="button" class="btn sm" data-copy-port="${item.port}">Copy details</button>
                  </div>
                  <p>${esc(item.description)}</p>
                  <p><strong>Transport:</strong> ${item.transports.join(', ')}</p>
                  <p><strong>Example:</strong> ${esc(item.example)}</p>
                  <p class="hint"><strong>Remember:</strong> A port number identifies a service endpoint convention; it does not itself encrypt traffic or prove which application is listening.</p>
                </div>`;
            };
            $('#portSearch', p).addEventListener('input', () => {
              clearTimeout(renderPorts.timer);
              renderPorts.timer = setTimeout(renderPorts, 250);
            });
            $('#prevPortRange', p).addEventListener('click', () => {
              portWindowStart = Math.max(0, portWindowStart - 100);
              $('#prevPortRange', p).disabled = portWindowStart === 0;
              $('#nextPortRange', p).disabled = portWindowStart >= 49142;
              loadRange();
            });
            $('#nextPortRange', p).addEventListener('click', () => {
              portWindowStart = Math.min(49142, portWindowStart + 10);
              $('#prevPortRange', p).disabled = portWindowStart === 0;
              $('#nextPortRange', p).disabled = portWindowStart >= 49142;
              loadRange();
            });
            const loadRange = () => {
              $('#portSearch', p).value = '';
              renderPorts();
            };
            $('#portTransportFilters', p).addEventListener('click', event => {
              const button = event.target.closest('[data-transport]');
              if (!button) return;
              activeTransport = button.dataset.transport;
              $$('#portTransportFilters .chipbtn', p).forEach(b => b.classList.toggle('on', b === button));
              renderPorts();
            });
            $('#portCategoryFilters', p).addEventListener('click', event => {
              const button = event.target.closest('[data-category]');
              if (!button) return;
              activeCategory = button.dataset.category;
              $$('#portCategoryFilters .chipbtn', p).forEach(b => b.classList.toggle('on', b === button));
              renderPorts();
            });
            $('#portTable', p).addEventListener('click', event => {
              const button = event.target.closest('[data-port]');
              if (!button) return;
              const item = PORTS.find(entry => entry.port === Number(button.dataset.port));
              if (item) showPortDetail(item);
            });
            $('#portDetail', p).addEventListener('click', async event => {
              const button = event.target.closest('[data-copy-port]');
              if (!button) return;
              const item = PORTS.find(entry => entry.port === Number(button.dataset.copyPort));
              if (!item) return;
              const text = `Service: ${item.service}\nPort: ${item.port}\nTransport: ${item.transports.join(', ')}\nPurpose: ${item.description}\nExample: ${item.example}`;
              try {
                await navigator.clipboard.writeText(text);
                button.textContent = 'Copied!';
              } catch (error) {
                const area = document.createElement('textarea');
                area.value = text;
                area.setAttribute('readonly', '');
                area.className = 'port-copy-fallback';
                p.append(area);
                area.select();
                const copied = document.execCommand('copy');
                area.remove();
                button.textContent = copied ? 'Copied!' : 'Copy unavailable';
              }
            });
            const renderQuiz = () => {
              const item = questions[quizIndex];
              $('#portQuiz', p).innerHTML = `
                <p class="hint">Question ${quizIndex + 1} of ${questions.length}</p>
                <h4>${esc(item.q)}</h4>
                <div class="opts">${item.options.map(option => `<button type="button" class="opt" data-answer="${esc(option)}" ${quizAnswered ? 'disabled' : ''}><span>${esc(option)}</span>${esc(option)}</button>`).join('')}</div>
                <p id="portQuizFeedback" class="hint" aria-live="polite">${quizAnswered ? `${item.why}` : 'Choose an answer to see an explanation.'}</p>
                <button type="button" class="btn sm" id="portQuizNext">${quizIndex === questions.length - 1 ? 'Restart quiz' : 'Next question'} →</button>`;
              if (quizAnswered) {
                $$('#portQuiz [data-answer]', p).forEach(button => {
                  if (button.dataset.answer === item.answer) button.classList.add('right');
                });
              }
            };
            $('#portQuiz', p).addEventListener('click', event => {
              const answerButton = event.target.closest('[data-answer]');
              if (answerButton && !quizAnswered) {
                quizAnswered = true;
                const item = questions[quizIndex];
                const correct = answerButton.dataset.answer === item.answer;
                answerButton.classList.add(correct ? 'right' : 'wrong');
                $('#portQuizFeedback', p).textContent = `${correct ? 'Correct! ' : `Not quite. The answer is ${item.answer}. `}${item.why}`;
                $$('#portQuiz [data-answer]', p).forEach(button => {
                  button.disabled = true;
                  if (button.dataset.answer === item.answer) button.classList.add('right');
                });
              }
              if (event.target.closest('#portQuizNext')) {
                quizIndex = (quizIndex + 1) % questions.length;
                quizAnswered = false;
                renderQuiz();
              }
            });
            const renderStatusCodes = () => {
              const q = $('#sq', p).value.toLowerCase();
              $('#sc', p).innerHTML = tbl(
                ['Code', 'Meaning'],
                CODES.filter(c => !q ||
                  (c[0] + ' ' + c[1]).toLowerCase().includes(q) ||
                  (q === 'error' && c[0] >= 400) ||
                  (q === 'redirect' && c[0] >= 300 && c[0] < 400))
              );
            };
            $('#sq', p).addEventListener('input', renderStatusCodes);
            renderPorts();
            renderQuiz();
            renderStatusCodes();
          },
        },
        {
          label: 'Subnet cheat sheet',
          render(p) {
            const rows = [];
            for (let pl = 16; pl <= 30; pl++)
              rows.push([
                `/${pl}`,
                ip4(mk(pl)),
                fmtN(2 ** (32 - pl)),
                fmtN(2 ** (32 - pl) - 2),
                pl >= 24 ? `${256 / 2 ** (32 - pl)} per /24` : `${2 ** (24 - pl)} × /24`,
              ]);
            p.innerHTML = panel(
              'Prefix lengths',
              tbl(['Prefix', 'Mask', 'Addresses', 'Usable hosts', 'Size'], rows),
              'Each extra prefix bit halves the block. Subtract 2 from the address count for the network and broadcast addresses.'
            );
          },
        },
      ],
      0
    );
    return () => tabs.destroy();
  },
});
