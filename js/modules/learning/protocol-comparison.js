import { esc } from '../../core/utils.js';
import { regMod } from '../registry.js';

const DATA = [
{id:'tcp-udp',title:'TCP vs UDP',category:'Transport',tags:'ports reliability connection handshake datagram stream',summary:'Reliable ordered byte-stream delivery versus lightweight best-effort datagrams.',left:'TCP',right:'UDP',diagram:'transport',rows:[['Connection','Connection-oriented; establishes a connection','Connectionless; no transport handshake'],['Delivery','Acknowledgments and retransmissions','Best effort; loss recovery is left to the application'],['Ordering','Delivers bytes in order','Datagrams may arrive out of order'],['Flow / congestion control','Built-in flow and congestion control','No built-in transport flow or congestion control'],['Header size','20 bytes minimum','8 bytes'],['Common uses','HTTPS, SSH, email, file transfer','DNS queries, voice/video, games; QUIC uses UDP']],use:'Use TCP when an application needs a reliable ordered stream. UDP suits some latency-sensitive traffic or protocols that implement their own reliability.',quiz:[['Which protocol provides an ordered byte stream?',['UDP','TCP','Both always','Neither'],1,'TCP presents a reliable, ordered byte stream; UDP does not guarantee delivery or order.'],['What is the UDP header size?',['4 bytes','8 bytes','20 bytes','40 bytes'],1,'The UDP header is 8 bytes.'],['Why might an application use UDP?',['Guaranteed delivery','Low-latency real-time traffic','Built-in ordered stream','No packet loss'],1,'Real-time applications may prefer low overhead and handle loss at the application layer.']]},
{id:'ipv4-ipv6',title:'IPv4 vs IPv6',category:'Network',tags:'address subnet ip internet 32-bit 128-bit',summary:'Compare address formats and packet-header design across the two Internet Protocol versions.',left:'IPv4',right:'IPv6',diagram:'address',rows:[['Address size','32 bits','128 bits'],['Example','192.0.2.10','2001:db8::10'],['Notation','Four decimal octets','Hexadecimal groups separated by colons'],['Base header','20 bytes minimum; options can extend it','Fixed 40-byte base header; extension headers are separate'],['Broadcast','Supports broadcast','No broadcast; multicast and anycast are used'],['Configuration','Manual, DHCP, and other methods','SLAAC, DHCPv6, and manual configuration']],use:'IPv4 remains widely deployed. IPv6 expands the address space and changes header and neighbor-discovery behavior; networks often operate both during transition.',quiz:[['How long is an IPv6 address?',['32 bits','48 bits','64 bits','128 bits'],3,'IPv6 addresses are 128 bits long; IPv4 addresses are 32 bits.'],['Which is an IPv6 characteristic?',['Uses broadcast for all-host delivery','Base header is 40 bytes','Written only in dotted decimal','Smaller address space'],1,'IPv6 has a fixed 40-byte base header and does not use broadcast.'],['What is 2001:db8::/32 reserved for?',['Documentation examples','Public DNS root service','Private IPv4','TCP ports'],0,'The 2001:db8::/32 prefix is reserved for IPv6 documentation.']]},
{id:'http-https',title:'HTTP vs HTTPS',category:'Application',tags:'web tls encryption certificate port 80 443 secure',summary:'Understand what TLS adds to HTTP communication.',left:'HTTP',right:'HTTPS',diagram:'secure',rows:[['Default port','80','443'],['Transport protection','HTTP itself provides no TLS protection','HTTP is carried inside a TLS-protected connection'],['Confidentiality','Not provided by HTTP itself','TLS encrypts application data in transit'],['Integrity','No TLS integrity protection','TLS detects tampering with protected records'],['Server authentication','No TLS certificate authentication','Typically authenticates the server using a certificate'],['Typical use','Unencrypted web communication or local testing','Modern websites, sign-in flows, and APIs']],use:'Use HTTPS for websites and APIs. TLS protection depends on correct certificate validation and configuration; HTTPS does not protect an application from every attack.',quiz:[['What does HTTPS add to HTTP?',['TLS protection','A different HTML language','Malware-free content guarantee','A larger IP address'],0,'HTTPS carries HTTP over TLS, providing confidentiality, integrity, and server authentication when correctly configured.'],['What is the default HTTPS port?',['21','53','80','443'],3,'TCP port 443 is the conventional default for HTTPS.'],['Does HTTPS guarantee a site is trustworthy in every respect?',['Yes, always','No; it protects the connection, not every application behavior','Only on port 80','Only over IPv4'],1,'A malicious or vulnerable website can still use HTTPS.']]},
{id:'dns-udp-tcp',title:'DNS over UDP vs TCP',category:'Application',tags:'domain name resolution port 53 truncation zone transfer',summary:'Explore why DNS commonly uses UDP but also relies on TCP in important cases.',left:'DNS over UDP',right:'DNS over TCP',diagram:'dns',rows:[['Connection setup','No transport connection setup','TCP connection establishment'],['Common use','Many ordinary queries and responses','Zone transfers and responses requiring TCP'],['Message size','EDNS(0) can advertise larger UDP payloads','Reliable byte stream supports larger responses'],['Reliability','Resolver may retry after loss or truncation','TCP provides ordered reliable delivery'],['Truncation','A truncated response can prompt a TCP retry','Can carry the full response if needed'],['Port','UDP port 53 commonly','TCP port 53 commonly']],use:'DNS is not UDP-only. TCP is used for truncated answers, zone transfers, and other circumstances. Encrypted DNS transports also exist.',quiz:[['Which statement about DNS transport is accurate?',['Always UDP','Always TCP','Can use UDP and TCP','Only ICMP'],2,'DNS commonly uses UDP but also uses TCP in important situations.'],['What may a resolver do after a truncated UDP response?',['Retry using TCP','Change answer to NXDOMAIN','Disable routing','Switch to ARP'],0,'The TC bit indicates truncation; a resolver may retry over TCP.'],['Which DNS task commonly uses TCP?',['Ethernet switching','Zone transfer','IPv6 neighbor discovery','Wi-Fi association'],1,'DNS zone transfers commonly use TCP.']]},
{id:'static-dynamic-routing',title:'Static vs Dynamic Routing',category:'Network',tags:'route router ospf bgp rip network path failover',summary:'Compare manually configured routes with routes learned and updated by routing protocols.',left:'Static routing',right:'Dynamic routing',diagram:'routing',rows:[['Configuration','Administrator configures routes manually','Routers learn routes using a routing protocol'],['Topology changes','Usually needs manual updates unless paired with tracking/failover','Can recalculate routes after convergence'],['Overhead','Low protocol and CPU overhead','Uses CPU, memory, and network messages'],['Scalability','Useful for small or stable networks','Useful for larger or changing networks'],['Predictability','Directly controlled by administrator','Depends on metrics, policy, and convergence'],['Examples','Default route, stub network route','OSPF, IS-IS, RIP, BGP']],use:'Static routes suit simple, stable paths and default routes. Dynamic routing helps networks learn routes and adapt to topology changes.',quiz:[['Which approach usually requires manually configuring routes?',['Dynamic routing','Static routing','DNS','Ethernet switching'],1,'Static routes are explicitly configured by an administrator.'],['Which is a dynamic routing protocol?',['OSPF','HTTP','ARP','TLS'],0,'OSPF is a link-state dynamic routing protocol.'],['What is a caveat after a dynamic-routing link failure?',['Instant convergence always','It may take time to converge','Removes all IPs','Disables all static routes'],1,'Dynamic protocols adapt, but convergence is not necessarily instantaneous.']]},
{id:'hub-switch-router',title:'Hub vs Switch vs Router',category:'Devices',tags:'ethernet mac ip layer 1 layer 2 layer 3 forwarding lan',summary:'See how network devices differ in the information they use to forward traffic.',left:'Hub / Switch / Router',right:'Forwarding behavior',diagram:'devices',rows:[['Typical layer','Hub: Physical (L1); switch: Data Link (L2)','Router: Network (L3)'],['Decision basis','Hub repeats signals; switch uses MAC address table','Router uses destination IP and routing table'],['Forwarding','Hub repeats to other ports; switch selectively forwards frames','Router forwards packets toward a selected next hop'],['Collision domains','Hub shares one; switch ports typically separate them','Router interfaces separate Layer 2 segments'],['Broadcast domains','Hub/basic switch forwards Layer 2 broadcasts within the LAN/VLAN','Routers do not normally forward Layer 2 broadcasts between interfaces'],['Typical use','Hub: legacy Ethernet; switch: connect LAN devices','Router: connect IP networks']],use:'A switch connects devices within a LAN; a router forwards packets between IP networks. Hubs are legacy devices and are rarely used in modern Ethernet.',quiz:[['Which device forwards frames using a MAC address table?',['Hub','Switch','Router only','DNS resolver'],1,'A Layer 2 switch uses a MAC address forwarding table.'],['Which device primarily forwards packets between IP networks?',['Hub','Repeater','Router','Ethernet cable'],2,'Routers use IP addressing and routing information.'],['What does a traditional Ethernet hub do?',['Routes by IP prefix','Repeats signals out other ports','Encrypts with TLS','Learns a routing table'],1,'A hub is a physical-layer repeater.']]},
{id:'stop-wait-sliding-window',title:'Stop-and-Wait vs Sliding Window ARQ',category:'Data Link',tags:'reliable transfer acknowledgment ack frame retransmission go-back-n selective repeat',summary:'Compare one outstanding frame at a time with pipelined transmission using a window.',left:'Stop-and-Wait',right:'Sliding Window',diagram:'arq',rows:[['Outstanding frames','At most one unacknowledged frame','Several frames may be in flight'],['Throughput','Can be low when round-trip delay is large','Pipelining can better utilize a link'],['Buffering','Simple sender and receiver state','Needs window state and often more buffering'],['Loss recovery','Retransmits outstanding frame after timeout','Depends on variant, e.g. Go-Back-N or Selective Repeat'],['Complexity','Simple to implement and reason about','More state and sequence-number/window rules'],['Good fit','Simple links or teaching examples','Higher bandwidth-delay product links']],use:'Sliding windows keep a high-delay link busy by allowing multiple frames in flight. Exact retransmission behavior depends on the ARQ variant.',quiz:[['How many unacknowledged frames can Stop-and-Wait normally have in flight?',['One','Four','Unlimited','Zero'],0,'The sender waits for an acknowledgment before sending the next frame.'],['Why can sliding-window ARQ improve throughput?',['Removes all errors','Allows multiple frames in flight','Eliminates ACKs in every variant','Changes IPv4 into IPv6'],1,'Pipelining uses link capacity while earlier frames await acknowledgments.'],['Which is a sliding-window ARQ variant?',['HTTPS','Go-Back-N','IPv6','DNS'],1,'Go-Back-N and Selective Repeat are sliding-window ARQ strategies.']]}

{id:'osi-tcpip',title:'OSI Model vs TCP/IP Model',category:'Models',tags:'osi tcp ip layers application presentation session transport network internet data link physical encapsulation pdu',summary:'Compare the seven-layer OSI reference model with the four-layer TCP/IP model and see how their responsibilities map in real networks.',left:'OSI reference model',right:'TCP/IP model',diagram:'osi-tcpip',rows:[['Number of layers','7 layers','4 layers in the common Internet model'],['Purpose','A detailed reference model for describing network functions','A practical protocol suite and layered architecture used by the Internet'],['Upper layers','Application, Presentation, Session','Combined into the Application layer'],['Transport','Transport: end-to-end communication','Transport: TCP, UDP and related transport protocols'],['Network internetworking','Network: logical addressing and routing','Internet: IP addressing and routing'],['Lower layers','Data Link and Physical are separate layers','Usually grouped as Network Access / Link'],['Protocol examples','A conceptual model; not a protocol suite itself','HTTP, DNS, TCP, UDP, IP, Ethernet and Wi-Fi']],use:'Use OSI as a detailed framework for learning and troubleshooting. TCP/IP describes the practical architecture behind Internet communication. The mapping is conceptual: the models do not align perfectly in every implementation, and protocols do not always fit neatly into one box.',quiz:[['How many layers are in the common OSI reference model?',['4','5','7','8'],2,'OSI defines seven layers, from Physical through Application.'],['Which TCP/IP layer commonly groups OSI Application, Presentation, and Session responsibilities?',['Internet','Transport','Network Access','Application'],3,'The TCP/IP Application layer combines responsibilities commonly separated into the top three OSI layers.'],['Which statement about the layer mapping is most accurate?',['Every OSI layer has an exact one-to-one TCP/IP equivalent','The mapping is conceptual and some responsibilities overlap','TCP/IP does not use IP','OSI is a physical cable standard'],1,'The models have different goals and their layer mapping is useful but not a perfect one-to-one match.']]},
];

const norm = value => String(value || '').toLocaleLowerCase().trim();
const safe = value => esc(String(value));
const matches = (item, query, category) => (!query || norm([item.title,item.category,item.summary,item.tags,item.rows.flat().join(' '),item.use].join(' ')).includes(query)) && (category === 'All' || item.category === category);

function diagram(item) {
  if (item.diagram === 'osi-tcpip') return layerMappingMarkup();
  const definitions = {
    transport: [['Sender','Application data'],['Receiver','Application data'],'Data / ACK','TCP: ACK + retransmit · UDP: best effort'],
    address: [['IPv4','32-bit address'],['IPv6','128-bit address'],'','Different address formats and header designs'],
    secure: [['HTTP','No TLS protection'],['HTTPS','HTTP + TLS'],'','TLS protects data in transit when configured correctly'],
    dns: [['Resolver','DNS query'],['DNS server','UDP or TCP :53'],'Query / answer','Truncation may trigger a TCP retry'],
    routing: [['Network A','Source'],['Router','Route lookup'],['Network B','Destination'],'','Static: configured · Dynamic: learned and updated'],
    devices: [['Hub','Repeats signal'],['Switch','MAC address'],['Router','IP route'],'','Physical · Data Link · Network'],
    arq: [['Stop-and-Wait','One frame in flight'],['Sliding Window','Multiple frames'],'Pipelining','More frames in flight can improve link utilization']
  };
  const d = definitions[item.diagram];
  const boxes = d.slice(0, item.diagram === 'devices' || item.diagram === 'routing' ? 3 : 2);
  const positions = boxes.length === 3 ? [4, 124, 244] : [18, 188];
  let svg = '<svg class="npc-diagram" viewBox="0 0 350 112" role="img" aria-label="' + safe(item.title + ' concept diagram') + '">';
  boxes.forEach((box, i) => {
    const x = positions[i], w = boxes.length === 3 ? 102 : 144;
    svg += '<rect x="' + x + '" y="20" width="' + w + '" height="48" rx="9" class="npc-svg-box"/>';
    svg += '<text x="' + (x+w/2) + '" y="40" text-anchor="middle" class="npc-svg-label">' + safe(box[0]) + '</text>';
    svg += '<text x="' + (x+w/2) + '" y="55" text-anchor="middle" class="npc-svg-sub">' + safe(box[1]) + '</text>';
  });
  if (boxes.length === 2) {
    svg += '<path d="M162 35 L188 35" class="npc-svg-arrow"/><path d="M182 30 L188 35 L182 40" class="npc-svg-arrow"/>';
    if (d[2]) svg += '<text x="175" y="13" text-anchor="middle" class="npc-svg-sub">' + safe(d[2]) + '</text>';
  } else {
    svg += '<path d="M106 44 L124 44 M118 39 L124 44 L118 49 M226 44 L244 44 M238 39 L244 44 L238 49" class="npc-svg-arrow"/>';
  }
  svg += '<text x="175" y="91" text-anchor="middle" class="npc-svg-sub">' + safe(d[d.length-1]) + '</text></svg>';
  return '<div class="npc-diagram-wrap">' + svg + '</div>';
}


const LAYER_MAP = [
  { osi: ['7 · Application','6 · Presentation','5 · Session'], tcp: 'Application', detail: 'User-facing protocols and data representation/session responsibilities live here. Examples include HTTP, DNS, SMTP, TLS-related application usage, and formats such as JSON. TCP/IP combines the responsibilities that OSI describes as three separate upper layers.' },
  { osi: ['4 · Transport'], tcp: 'Transport', detail: 'End-to-end process communication, ports, segmentation, and transport behavior. TCP provides a reliable ordered byte stream; UDP provides datagrams without built-in delivery or ordering guarantees.' },
  { osi: ['3 · Network'], tcp: 'Internet', detail: 'Logical IP addressing and routing packets between networks. IP operates here; routers make forwarding decisions using network-layer information.' },
  { osi: ['2 · Data Link','1 · Physical'], tcp: 'Network Access / Link', detail: 'Local-link delivery and the signals or media that carry bits. Ethernet and Wi-Fi cover link-layer functions, while copper, fibre, and radio provide physical transmission. TCP/IP references often group these responsibilities together.' }
];

function layerMappingMarkup() {
  return '<section class="npc-layer-lab panel" aria-labelledby="npc-layer-title">' +
    '<div class="npc-layer-heading"><div><p class="eyebrow">Interactive layer map</p><h3 id="npc-layer-title">How the layers line up</h3></div><span class="npc-layer-count" data-layer-count>Step 1 of 4</span></div>' +
    '<p class="npc-layer-intro">Select a mapping or step through the model. Highlighting shows a useful correspondence, not a strict one-to-one equivalence.</p>' +
    '<div class="npc-layer-map" data-layer-map>' +
    '<div class="npc-layer-column"><h4>OSI · 7 layers</h4><div class="npc-layer-stack">' + LAYER_MAP.map((group,i) => '<button type="button" class="npc-layer-card npc-osi-card' + (i===0?' is-active':'') + '" data-layer-index="' + i + '" aria-pressed="' + (i===0) + '">' + group.osi.map(layer => '<span>' + safe(layer) + '</span>').join('') + '</button>').join('') + '</div></div>' +
    '<div class="npc-layer-connector" aria-hidden="true"><span>↔</span><span>Conceptual mapping</span></div>' +
    '<div class="npc-layer-column"><h4>TCP/IP · 4 layers</h4><div class="npc-layer-stack">' + LAYER_MAP.map((group,i) => '<button type="button" class="npc-layer-card npc-tcp-card' + (i===0?' is-active':'') + '" data-layer-index="' + i + '" aria-pressed="' + (i===0) + '"><span>' + safe(group.tcp) + '</span></button>').join('') + '</div></div>' +
    '</div><div class="npc-layer-detail" aria-live="polite"><strong data-layer-detail-title>OSI Application / Presentation / Session ↔ TCP/IP Application</strong><p data-layer-detail-text>' + safe(LAYER_MAP[0].detail) + '</p></div>' +
    '<div class="npc-layer-controls"><button class="btn ghost" type="button" data-layer-prev disabled>← Previous</button><button class="btn" type="button" data-layer-play aria-pressed="false">▶ Play mapping</button><button class="btn ghost" type="button" data-layer-next>Next layer →</button><button class="btn ghost" type="button" data-layer-reset>Reset</button></div>' +
    '<p class="npc-layer-note"><strong>Remember:</strong> OSI is a seven-layer reference model; TCP/IP is the practical Internet architecture. Their layers are related, but not identical.</p></section>';
}

function cardList(query, category) {
  const items = DATA.filter(item => matches(item, query, category));
  const cards = items.map(item => '<button type="button" class="npc-card" data-comparison="' + item.id + '"><span class="npc-card-top"><span class="npc-category">' + safe(item.category) + '</span><span aria-hidden="true">↗</span></span><strong>' + safe(item.title) + '</strong><span>' + safe(item.summary) + '</span><span class="npc-card-link">Compare details →</span></button>').join('');
  return '<div class="npc-cards">' + (cards || '<p class="npc-empty">No comparisons match your search. Try TCP, DNS, IPv6, router, or ARQ.</p>') + '</div><p class="npc-result-count" aria-live="polite">Showing ' + items.length + ' of ' + DATA.length + ' comparisons</p>';
}

function questionMarkup(item, index) {
  if (index >= item.quiz.length) return '<p class="npc-quiz-complete">Quiz complete. Try again to practise once more.</p><button class="btn" type="button" data-action="retry">Try again</button>';
  const q = item.quiz[index];
  return '<fieldset class="npc-question"><legend>' + (index+1) + '. ' + safe(q[0]) + '</legend><div class="npc-options">' + q[1].map((option,i) => '<label class="npc-option"><input type="radio" name="npc-answer" value="' + i + '"><span>' + safe(option) + '</span></label>').join('') + '</div><div class="npc-feedback" data-feedback aria-live="polite" hidden></div><div class="npc-quiz-actions"><button class="btn" type="button" data-action="check">Check answer</button><button class="btn ghost" type="button" data-action="next" hidden>' + (index === item.quiz.length-1 ? 'Finish quiz' : 'Next question →') + '</button></div></fieldset>';
}

function detailMarkup(item) {
  const rows = item.rows.map(row => '<tr><th scope="row">' + safe(row[0]) + '</th><td>' + safe(row[1]) + '</td><td>' + safe(row[2]) + '</td></tr>').join('');
  return '<div class="npc-detail"><div class="npc-detail-top"><button class="btn ghost" type="button" data-action="back">← All comparisons</button><span class="npc-category">' + safe(item.category) + '</span></div><h2>' + safe(item.title) + '</h2><p class="npc-summary">' + safe(item.summary) + '</p><div class="npc-table-wrap"><table class="npc-table"><thead><tr><th>Feature</th><th>' + safe(item.left) + '</th><th>' + safe(item.right) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + diagram(item) + '<section class="panel npc-use"><h3>Real-world guidance</h3><p>' + safe(item.use) + '</p></section><section class="panel npc-quiz"><div class="npc-quiz-heading"><div><p class="eyebrow">Knowledge check</p><h3>Test your understanding</h3></div><span class="npc-quiz-progress" data-quiz-score>0 / ' + item.quiz.length + '</span></div><div data-quiz-area>' + questionMarkup(item,0) + '</div></section></div>';
}

regMod({
  id: 'protocolcompare',
  group: 'learn',
  title: 'Network Protocol Comparison Lab',
  desc: 'Search and compare networking protocols, devices, reference models, and reliable-transfer methods with diagrams and quizzes.',
  obj: ['Compare eight networking concepts, including OSI and TCP/IP models.','Use search and category filters to find a comparison.','Explore the interactive layer map and test your understanding with quizzes.'],
  mount(root) {
    const controller = new AbortController();
    const signal = controller.signal;
    let query = '', category = 'All', selected = null, quizIndex = 0, quizScore = 0, answered = false, layerIndex = 0, layerTimer = null;
    const categories = ['All','Models','Transport','Network','Application','Devices','Data Link'];
    root.innerHTML = '<div class="npc-lab"><header class="npc-hero"><p class="eyebrow">Interactive reference</p><h2>Network Protocol Comparison Lab</h2><p>Find the differences, understand the trade-offs, and practise with quick quizzes. All activities are local learning simulations.</p><div class="npc-stats"><span><strong>8</strong> comparisons</span><span><strong>3</strong> questions each</span><span><strong>0</strong> network requests</span></div></header><div class="npc-browser" data-browser><div class="npc-search"><label for="npc-search-input">Search comparisons</label><input id="npc-search-input" type="search" placeholder="Try OSI, TCP/IP, TCP, DNS, router, or ARQ" autocomplete="off"><p class="hint">Search names, categories, features, and use cases.</p></div><div class="npc-filters" role="group" aria-label="Filter comparisons by category">' + categories.map(c => '<button type="button" class="npc-filter' + (c === category ? ' is-active' : '') + '" data-category="' + c + '" aria-pressed="' + (c === category) + '">' + c + '</button>').join('') + '</div><div data-list>' + cardList(query,category) + '</div></div><div data-detail hidden></div></div>';
    const list = root.querySelector('[data-list]'), detail = root.querySelector('[data-detail]'), browser = root.querySelector('[data-browser]');
    const renderCards = () => {
      list.innerHTML = cardList(query,category);
      root.querySelectorAll('[data-category]').forEach(button => {
        const active = button.dataset.category === category;
        button.classList.toggle('is-active',active); button.setAttribute('aria-pressed',String(active));
      });
    };
    const stopLayerPlayback = () => {
      if (layerTimer) window.clearInterval(layerTimer);
      layerTimer = null;
      const play = detail.querySelector('[data-layer-play]');
      if (play) { play.textContent = '▶ Play mapping'; play.setAttribute('aria-pressed','false'); }
    };
    const renderLayerStep = () => {
      const item = LAYER_MAP[layerIndex];
      if (!item || !detail.querySelector('[data-layer-map]')) return;
      detail.querySelectorAll('[data-layer-index]').forEach(button => {
        const active = Number(button.dataset.layerIndex) === layerIndex;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      detail.querySelector('[data-layer-count]').textContent = 'Step ' + (layerIndex + 1) + ' of ' + LAYER_MAP.length;
      detail.querySelector('[data-layer-detail-title]').textContent = item.osi.join(' / ') + ' ↔ TCP/IP ' + item.tcp;
      detail.querySelector('[data-layer-detail-text]').textContent = item.detail;
      detail.querySelector('[data-layer-prev]').disabled = layerIndex === 0;
      detail.querySelector('[data-layer-next]').disabled = layerIndex === LAYER_MAP.length - 1;
    };
    const showQuestion = () => {
      const item = DATA.find(entry => entry.id === selected);
      if (!item) return;
      detail.querySelector('[data-quiz-area]').innerHTML = questionMarkup(item,quizIndex);
      detail.querySelector('[data-quiz-score]').textContent = quizScore + ' / ' + item.quiz.length;
      answered = false;
    };
    root.addEventListener('input', event => {
      if (event.target.id === 'npc-search-input') { query = norm(event.target.value); renderCards(); }
    }, {signal});
    root.addEventListener('click', event => {
      const filter = event.target.closest('[data-category]');
      if (filter) { category = filter.dataset.category; renderCards(); return; }
      const card = event.target.closest('[data-comparison]');
      if (card) {
        stopLayerPlayback(); selected = card.dataset.comparison; quizIndex = 0; quizScore = 0; answered = false; layerIndex = 0;
        const item = DATA.find(entry => entry.id === selected);
        browser.hidden = true; detail.hidden = false; detail.innerHTML = detailMarkup(item);
        renderLayerStep(); detail.querySelector('[data-action="back"]').focus(); return;
      }
      const button = event.target.closest('[data-action]');
      if (!button) return;
      if (button.hasAttribute('data-layer-index')) { stopLayerPlayback(); layerIndex = Number(button.dataset.layerIndex); renderLayerStep(); return; }
      if (button.hasAttribute('data-layer-prev')) { stopLayerPlayback(); layerIndex = Math.max(0, layerIndex - 1); renderLayerStep(); return; }
      if (button.hasAttribute('data-layer-next')) { stopLayerPlayback(); layerIndex = Math.min(LAYER_MAP.length - 1, layerIndex + 1); renderLayerStep(); return; }
      if (button.hasAttribute('data-layer-reset')) { stopLayerPlayback(); layerIndex = 0; renderLayerStep(); return; }
      if (button.hasAttribute('data-layer-play')) {
        if (layerTimer) { stopLayerPlayback(); return; }
        if (layerIndex === LAYER_MAP.length - 1) layerIndex = -1;
        button.textContent = 'Ⅱ Pause mapping'; button.setAttribute('aria-pressed','true');
        layerTimer = window.setInterval(() => {
          if (layerIndex >= LAYER_MAP.length - 1) { stopLayerPlayback(); return; }
          layerIndex += 1; renderLayerStep();
          const play = detail.querySelector('[data-layer-play]');
          if (play && layerIndex < LAYER_MAP.length - 1) { play.textContent = 'Ⅱ Pause mapping'; play.setAttribute('aria-pressed','true'); }
          else stopLayerPlayback();
        }, 1400);
        layerIndex += 1; renderLayerStep(); return;
      }
      const action = button.dataset.action, item = DATA.find(entry => entry.id === selected);
      if (action === 'back') { stopLayerPlayback(); selected = null; detail.hidden = true; browser.hidden = false; renderCards(); root.querySelector('#npc-search-input').focus(); return; }
      if (action === 'retry') { quizIndex = 0; quizScore = 0; showQuestion(); return; }
      if (!item) return;
      if (action === 'check' && !answered) {
        const choice = detail.querySelector('input[name="npc-answer"]:checked'), feedback = detail.querySelector('[data-feedback]');
        if (!choice) { feedback.hidden = false; feedback.className = 'npc-feedback is-prompt'; feedback.textContent = 'Choose an answer before checking.'; return; }
        const q = item.quiz[quizIndex], correct = Number(choice.value) === q[2];
        if (correct) quizScore += 1;
        answered = true; feedback.hidden = false; feedback.className = 'npc-feedback ' + (correct ? 'is-correct' : 'is-incorrect');
        feedback.textContent = (correct ? 'Correct! ' : 'Not quite. ') + q[3];
        detail.querySelectorAll('input[name="npc-answer"]').forEach(input => { input.disabled = true; });
        button.hidden = true; detail.querySelector('[data-action="next"]').hidden = false;
        detail.querySelector('[data-quiz-score]').textContent = quizScore + ' / ' + item.quiz.length; return;
      }
      if (action === 'next' && answered) { quizIndex += 1; showQuestion(); }
    }, {signal});
    return () => { stopLayerPlayback(); controller.abort(); };
  }
});
