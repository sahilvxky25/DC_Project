/**
 * Interactive OSI Layer Journey
 *
 * A guided sender-to-receiver walkthrough of the seven-layer OSI reference model.
 * This is an educational conceptual simulation; it does not transmit real network traffic.
 */
import { esc } from '../../core/utils.js';
import { regMod } from '../registry.js';

/**
 * Layer data is kept separate from rendering for maintainability:
 * role = core responsibility; send/receive = direction-specific explanation;
 * keyFunctions = technical duties; realWorld = practical context and caveats;
 * header/example/analogy = quick reference material for learners.
 *
 * Entries are ordered Layer 7 to Layer 1 (sender encapsulation order).
 * Receiver traversal reverses the order through currentLayer().
 */
const LAYERS = [
  { n: 7, name: 'Application', pdu: 'Data', tcp: 'Application', protocols: 'HTTP · HTTPS · DNS · SMTP', role: 'Provides network services used by applications. It defines how application processes request and exchange information.', send: 'Your message is prepared as application data. For this example, the browser creates an HTTP request.', receive: 'The application receives the reconstructed data and interprets it as an HTTP response or message.', header: 'Application protocol fields', example: 'HTTP method, path and host', keyFunctions: 'Accepts application requests; identifies the application protocol; defines request and response formats; exposes services such as web, email and name resolution.', realWorld: 'When you open a website, the browser creates an HTTP request containing a method, resource path and host information. DNS is also an application-layer protocol even though it supports a lower-level network task.', analogy: 'The letter content and the service you are using' },
  { n: 6, name: 'Presentation', pdu: 'Data', tcp: 'Application', protocols: 'UTF-8 · JSON · JPEG · TLS concepts', role: 'Deals with data representation, character encoding, serialization, compression and encryption-related presentation.', send: 'The data is represented in a format the other endpoint can interpret. This example uses UTF-8 text; encryption may also be applied by a secure protocol.', receive: 'The receiver interprets the representation and, where applicable, decrypts or decompresses data before passing it upward.', header: 'Representation / security metadata (when used)', example: 'UTF-8 encoding; JSON or image format', keyFunctions: 'Encodes characters; serializes structured data; represents images, audio and video; may compress or encrypt data as part of an application security design.', realWorld: 'UTF-8 gives both endpoints a consistent way to interpret text bytes. JSON defines a structured representation. TLS is commonly implemented above TCP or integrated with transport stacks; it is not simply a separate OSI presentation header.', analogy: 'Choosing a shared language and format' },
  { n: 5, name: 'Session', pdu: 'Data', tcp: 'Application', protocols: 'Session control · RPC concepts · dialogs', role: 'Coordinates dialogs between applications, including establishing, managing and ending logical sessions.', send: 'A logical conversation is coordinated. Real Internet applications often implement these responsibilities within application protocols or libraries.', receive: 'The receiving application uses the conversation context to continue or close the logical exchange.', header: 'Session / dialog state (implementation-dependent)', example: 'A logical request-response conversation', keyFunctions: 'Coordinates dialog state; associates related exchanges; supports checkpoints or recovery concepts in some systems; defines when a logical conversation begins and ends.', realWorld: 'Modern Internet applications often manage session state using application protocols, cookies, tokens, RPC frameworks or libraries rather than a distinct Session-layer protocol.', analogy: 'Keeping track of which conversation is taking place' },
  { n: 4, name: 'Transport', pdu: 'Segment (TCP) / Datagram (UDP)', tcp: 'Transport', protocols: 'TCP · UDP · QUIC (over UDP)', role: 'Provides process-to-process delivery. Ports identify application endpoints; transport protocols define delivery, ordering and reliability behavior.', send: 'The transport layer identifies source and destination ports. TCP adds sequence and acknowledgment information; UDP uses a smaller datagram header without built-in delivery guarantees.', receive: 'The destination port helps deliver data to the right application. TCP processes ordering and reliability; UDP delivers datagrams without promising retransmission or order.', header: 'Transport header', example: 'TCP source port 51514 → destination port 443', keyFunctions: 'Uses port numbers for process addressing; segments application data; multiplexes multiple conversations; TCP provides ordered reliable byte-stream delivery while UDP provides connectionless datagrams.', realWorld: 'A browser may connect from an ephemeral source port to server port 443. TCP sequence numbers and acknowledgements support reliable ordered delivery; UDP does not itself guarantee delivery, ordering or retransmission.', analogy: 'Adding sender and recipient department details' },
  { n: 3, name: 'Network', pdu: 'Packet', tcp: 'Internet', protocols: 'IPv4 · IPv6 · ICMP · routing', role: 'Provides logical addressing and routing between networks. Routers use network-layer information to forward packets toward a destination.', send: 'An IP header is added with source and destination IP addresses. The packet can cross multiple networks; routers may update fields such as IPv4 TTL.', receive: 'The destination host checks the IP packet and passes its payload to the protocol identified by the IP header.', header: 'IP header', example: '10.0.0.2 → 203.0.113.20', keyFunctions: 'Adds logical source and destination IP addresses; selects a route; forwards packets between networks; supports diagnostics and control messaging through protocols such as ICMP.', realWorld: 'A router examines the destination IP address and forwarding table to choose the next hop. The link-layer frame is rebuilt for each outgoing link, while the IP source and destination normally remain end-to-end (subject to mechanisms such as NAT).', analogy: 'Writing the destination street address on the envelope' },
  { n: 2, name: 'Data Link', pdu: 'Frame', tcp: 'Network Access / Link', protocols: 'Ethernet · Wi-Fi (802.11) · PPP', role: 'Moves frames across a local link. Link-layer addressing and error detection are specific to the link technology.', send: 'The packet is placed inside a link-layer frame for the next hop. The frame includes local-link addressing and may include an error-detection trailer such as an Ethernet FCS.', receive: 'The receiving interface checks the frame for the local link, validates supported error checks, removes the link framing and passes the packet upward.', header: 'Frame header + possible trailer', example: 'Source and next-hop destination MAC addresses; Ethernet FCS', keyFunctions: 'Frames packets for a local link; uses link-layer addresses; detects some transmission errors; controls access to a shared medium depending on the link technology.', realWorld: 'On Ethernet, a frame includes source and destination MAC addresses and a Frame Check Sequence (FCS). On a routed path, the next-hop MAC address is usually the router interface, not the final remote server.', analogy: 'Putting the envelope inside the local delivery bag' },
  { n: 1, name: 'Physical', pdu: 'Bits / symbols', tcp: 'Network Access / Link', protocols: 'Copper · Fibre · Radio · PHY standards', role: 'Carries raw bits as electrical, optical or radio signals over a physical medium.', send: 'The frame is represented as a stream of bits and symbols and encoded as signals on copper, fibre or radio.', receive: 'The receiving medium and interface recover symbols and bits, then pass the resulting frame to the data-link layer.', header: 'No OSI packet header; signal encoding and framing details depend on the medium', example: 'Electrical, light or radio signals', keyFunctions: 'Defines electrical, optical or radio signalling; line coding and modulation; symbol timing; connectors, frequencies and physical transmission characteristics.', realWorld: 'A network interface converts frame bits into signals suitable for copper, fibre or radio. The receiver synchronizes to the signal and recovers bits; this layer does not inspect IP addresses or application content.', analogy: 'The physical journey of the delivery vehicle' }
];

const escape = value => esc(String(value ?? ''));
const tcpMapping = layer => layer.tcp;
const pduFor = (layer, protocol) => layer.n === 4 ? (protocol === 'UDP' ? 'UDP datagram' : 'TCP segment') : layer.pdu;

function renderLayer(layer, active, direction) {
  return '<button type="button" class="osi-step-card' + (active ? ' is-active' : '') + '" data-layer="' + layer.n + '" aria-pressed="' + String(active) + '">' +
    '<span class="osi-step-number">' + layer.n + '</span><span class="osi-step-copy"><strong>' + escape(layer.name) + '</strong><small>' + escape(layer.pdu) + '</small></span>' +
    '<span class="osi-step-state">' + (active ? '●' : (direction === 'send' ? '↓' : '↑')) + '</span></button>';
}


const TCP_UDP_STAGES = [
  { title: '1. Connection setup', tcp: 'TCP begins with a three-way handshake: SYN → SYN-ACK → ACK. Both endpoints synchronize initial sequence numbers before application data is exchanged.', udp: 'UDP sends without establishing a transport connection. There is no built-in handshake; an application can begin sending datagrams immediately.', insight: 'TCP spends a round trip establishing connection state. UDP avoids that transport handshake, which can reduce startup delay, but the application must handle any setup it needs.' },
  { title: '2. Data transfer', tcp: 'TCP treats application data as a byte stream. It numbers bytes with sequence numbers, acknowledges received data and retransmits missing data when needed.', udp: 'UDP sends independent datagrams. Each datagram carries source and destination ports, length and checksum fields, but UDP itself does not retransmit lost data.', insight: 'TCP provides a reliable, ordered byte stream. UDP preserves message boundaries as datagrams but leaves loss handling to the application.' },
  { title: '3. Delivery & ordering', tcp: 'The receiver reassembles the byte stream in order and acknowledges received bytes. Duplicate or out-of-order segments are handled by TCP; missing data can delay later bytes from being delivered to the application.', udp: 'Datagrams may arrive late, out of order, more than once, or not at all. UDP passes received datagrams to the application without an in-built ordering or recovery mechanism.', insight: 'Choose TCP when the application needs a reliable ordered stream. Choose UDP when low overhead or timely delivery matters and the application can tolerate or manage loss and reordering.' },
  { title: '4. Connection close', tcp: 'TCP endpoints exchange FIN and ACK control segments to close each direction of the connection. A reset (RST) can abort a connection instead.', udp: 'UDP has no transport connection to close. When the application has no more datagrams to send, it simply stops sending; application-level session cleanup may still be needed.', insight: 'TCP maintains connection state and performs an orderly close. UDP has no handshake or transport teardown, though the application may still maintain its own session.' }
];

function markup() {
  return '<div class="osi-journey">' +
    '<header class="osi-hero"><p class="eyebrow">GUIDED NETWORK WALKTHROUGH</p><h2>Interactive OSI Layer Journey</h2><p>Follow one message through all seven OSI layers, then watch it move back up the stack at the receiver.</p><div class="osi-hero-tags"><span>7 OSI layers</span><span>Sender + receiver</span><span>Local simulation</span></div></header>' +
    '<section class="panel osi-setup"><div class="osi-setup-grid"><div class="field"><label for="osi-message">Message to send</label><input id="osi-message" type="text" maxlength="120" value="Hello, BitSecure!" autocomplete="off"></div><div class="field"><label for="osi-transport">Transport protocol</label><select id="osi-transport"><option value="TCP">TCP</option><option value="UDP">UDP</option></select></div></div><p class="hint">Example endpoints: 10.0.0.2:51514 → 203.0.113.20:443. These are illustrative values, not a live connection.</p></section>' +
    '<section class="panel osi-workspace"><div class="osi-workspace-head"><div><p class="eyebrow">MESSAGE PATH</p><h3 data-journey-title>Sender · Encapsulation</h3></div><div class="osi-direction" role="group" aria-label="Journey direction"><button type="button" data-direction="send" class="is-active" aria-pressed="true">↑ Sender</button><button type="button" data-direction="receive" aria-pressed="false">↓ Receiver</button></div></div>' +
    '<div class="osi-progress"><div class="osi-progress-track"><i data-progress></i></div><span data-step-count>Step 1 of 7</span></div>' +
    '<div class="osi-main-grid"><div class="osi-stack"><div class="osi-stack-title"><strong>OSI reference model</strong><small data-stack-hint>Application → Physical</small></div><div data-layer-list>' + LAYERS.map((layer,i) => renderLayer(layer, i === 0, 'send')).join('') + '</div></div>' +
    '<div class="osi-detail" aria-live="polite"><div class="osi-detail-top"><span class="osi-layer-badge" data-layer-number>Layer 7</span><span class="osi-pdu-badge" data-pdu>Data</span></div><h3 data-layer-name>Application</h3><p data-layer-role></p><div class="osi-mapping"><small>TCP/IP correspondence</small><strong data-tcp-layer>Application</strong></div><div class="osi-step-explanation"><strong data-action-title>What happens at this layer</strong><p data-action-text></p></div><div class="osi-example"><small>EXAMPLE</small><code data-example></code></div><div class="osi-header"><small data-header-label>Information added / handled</small><strong data-header></strong></div><div class="osi-key-functions"><strong>Key responsibilities</strong><p data-functions></p></div><div class="osi-real-world"><strong>How this appears in real networks</strong><p data-real-world></p></div><div class="osi-analogy"><span>💡</span><p data-analogy></p></div></div></div>' +
    '<div class="osi-controls"><button class="btn ghost" type="button" data-prev disabled>← Previous</button><button class="btn" type="button" data-next>Next layer →</button><button class="btn ghost" type="button" data-auto>▶ Auto play</button><button class="btn ghost" type="button" data-reset>↺ Restart</button></div>' +
    '<div class="osi-complete" data-complete hidden><strong data-complete-title>Message ready for transmission</strong><p data-complete-text></p><button class="btn" type="button" data-switch>Continue to receiver →</button></div></section>' +
    '<section class="panel osi-tcp-udp-lab"><div class="osi-compare-heading"><div><p class="eyebrow">TRANSPORT LAYER DEEP DIVE</p><h3>TCP vs UDP · Side-by-side journey</h3><p class="hint">Compare what happens during connection setup, data transfer, delivery and connection close. This is a conceptual sequence, not a live socket connection.</p></div><span class="osi-compare-layer">OSI Layer 4</span></div>' +
    '<div class="osi-compare-stagebar"><div><small>JOURNEY STAGE</small><strong data-compare-stage-title>1. Connection setup</strong></div><div class="osi-compare-stage-actions"><button class="btn ghost" type="button" data-compare-prev disabled>← Previous</button><button class="btn" type="button" data-compare-next>Next stage →</button></div></div>' +
    '<div class="osi-compare-track" data-compare-track></div>' +
    '<div class="osi-compare-grid"><article class="osi-protocol-card osi-tcp-card"><div class="osi-protocol-title"><span class="osi-protocol-mark">T</span><div><h4>TCP</h4><small>Transmission Control Protocol</small></div><b>Connection-oriented</b></div><div class="osi-protocol-visual" data-tcp-visual></div><p data-tcp-stage-copy></p><div class="osi-protocol-facts"><div><small>Reliability</small><strong>Built-in</strong></div><div><small>Ordering</small><strong>In order</strong></div><div><small>Flow control</small><strong>Yes</strong></div><div><small>Handshake</small><strong>3-way</strong></div></div><div class="osi-protocol-use"><small>COMMON USES</small><span>Web traffic (HTTP/1.1, HTTP/2), email, file transfer, SSH</span></div></article>' +
    '<article class="osi-protocol-card osi-udp-card"><div class="osi-protocol-title"><span class="osi-protocol-mark">U</span><div><h4>UDP</h4><small>User Datagram Protocol</small></div><b>Connectionless</b></div><div class="osi-protocol-visual" data-udp-visual></div><p data-udp-stage-copy></p><div class="osi-protocol-facts"><div><small>Reliability</small><strong>No guarantee</strong></div><div><small>Ordering</small><strong>Not guaranteed</strong></div><div><small>Flow control</small><strong>No built-in</strong></div><div><small>Handshake</small><strong>None</strong></div></div><div class="osi-protocol-use"><small>COMMON USES</small><span>DNS queries, voice/video, gaming, real-time telemetry</span></div></article></div>' +
    '<div class="osi-compare-insight"><strong>Key takeaway</strong><p data-compare-insight></p></div>' +
    '<div class="osi-compare-footnote">Important: applications can add their own reliability, ordering or congestion-control mechanisms over UDP. QUIC, for example, runs over UDP and implements reliable streams itself.</div></section>' +
    '<section class="panel osi-encapsulation"><div class="osi-encap-head"><div><p class="eyebrow">DATA UNIT TRANSFORMATION</p><h3>What is added along the way?</h3></div><span data-encap-direction>Encapsulation</span></div><div class="osi-pdu-flow" data-pdu-flow></div><p class="hint">Simplified conceptual view: not every OSI layer adds a separate wire header. Real Internet protocols combine responsibilities, and the TCP/IP mapping is approximate.</p></section>' +
    '<section class="panel osi-model-map"><p class="eyebrow">MODEL COMPARISON</p><h3>Where does this fit in TCP/IP?</h3><div class="osi-tcp-map" data-tcp-map></div><p class="hint">TCP/IP commonly uses four layers. Its Application layer combines responsibilities described separately by OSI Layers 5–7; its Network Access / Link layer commonly groups OSI Layers 1–2.</p></section>' +
    '<section class="panel osi-takeaway"><strong>Important distinction</strong><p>OSI is a conceptual reference model. TCP/IP describes the practical Internet architecture. Their mapping helps explain responsibilities, but it is not a strict one-to-one conversion.</p></section>' +
    '</div>';
}

regMod({
  id: 'osi-journey',
  group: 'learn',
  title: 'Interactive OSI Layer Journey',
  desc: 'Follow a message through all seven OSI layers with guided encapsulation, receiver-side decapsulation and TCP/IP mapping.',
  obj: ['Identify the responsibility and PDU at each OSI layer.','Step through sender-side encapsulation and receiver-side decapsulation.','Relate the seven OSI layers to the four-layer TCP/IP model.'],
  revision: [
    'OSI has seven layers, from Physical (Layer 1) to Application (Layer 7).',
    'Sender-side encapsulation moves from Application down to Physical.',
    'Receiver-side decapsulation moves from Physical up to Application.',
    'Transport PDUs are commonly called TCP segments or UDP datagrams.',
    'Network-layer data is a packet; data-link data is a frame; the physical layer carries bits or symbols.',
    'TCP/IP commonly groups OSI Layers 5–7 as Application and Layers 1–2 as Network Access / Link.'
  ],
  mount(root) {
    const controller = new AbortController();
    const { signal } = controller;
    let direction = 'send', index = 0, timer = null, compareStage = 0;
    const $ = selector => root.querySelector(selector);
    const stopAuto = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
      const button = $('[data-auto]');
      if (button) { button.textContent = '▶ Auto play'; button.setAttribute('aria-pressed','false'); }
    };
    const currentLayer = () => LAYERS[direction === 'send' ? index : 6 - index];
    const render = () => {
      const layer = currentLayer();
      const protocol = $('#osi-transport').value;
      const step = index + 1;
      $('[data-journey-title]').textContent = direction === 'send' ? 'Sender · Encapsulation' : 'Receiver · Decapsulation';
      $('[data-stack-hint]').textContent = direction === 'send' ? 'Application → Physical' : 'Physical → Application';
      $('[data-step-count]').textContent = 'Step ' + step + ' of 7';
      $('[data-progress]').style.width = (step / 7 * 100) + '%';
      $('[data-layer-list]').innerHTML = LAYERS.map(item => renderLayer(item, item.n === layer.n, direction)).join('');
      $('[data-layer-number]').textContent = 'Layer ' + layer.n;
      $('[data-pdu]').textContent = pduFor(layer, protocol);
      $('[data-layer-name]').textContent = layer.name;
      $('[data-layer-role]').textContent = layer.role;
      $('[data-tcp-layer]').textContent = tcpMapping(layer);
      $('[data-action-title]').textContent = direction === 'send' ? 'Encapsulation step' : 'Decapsulation step';
      $('[data-action-text]').textContent = direction === 'send' ? layer.send : layer.receive;
      // Display the learner's own message as the application payload.
      const message = $('#osi-message').value.trim() || '(empty message)';
      $('[data-example]').textContent = layer.n === 7 ? 'Payload: "' + message + '" · ' + layer.example : layer.example;
      $('[data-header-label]').textContent = direction === 'send' ? 'Information added / handled' : 'Information examined / removed';
      $('[data-header]').textContent = layer.header;
      $('[data-functions]').textContent = layer.keyFunctions;
      $('[data-real-world]').textContent = layer.realWorld;
      $('[data-analogy]').textContent = layer.analogy;
      if (layer.n === 7) {
        $('[data-action-text]').textContent = direction === 'send'
          ? 'The application prepares this message as data: "' + message + '". ' + layer.send
          : 'The receiving application gets the reconstructed message: "' + message + '". ' + layer.receive;
      }
      $('[data-prev]').disabled = index === 0;
      $('[data-next]').disabled = index === 6;
      $('[data-complete]').hidden = index !== 6;
      if (index === 6) {
        $('[data-complete-title]').textContent = direction === 'send' ? 'The message has reached the physical medium' : 'The message has reached the application';
        $('[data-complete-text]').textContent = direction === 'send' ? 'The frame is represented as signals on the medium. The receiver can now begin decapsulation.' : 'The application data has been reconstructed and delivered to the receiving application.';
        $('[data-switch]').textContent = direction === 'send' ? 'Continue to receiver →' : 'Restart journey ↺';
      }
      $('[data-encap-direction]').textContent = direction === 'send' ? 'Encapsulation' : 'Decapsulation';
      renderPduFlow(protocol);
      renderTcpMap(layer);
    };

    const renderTcpUdpComparison = () => {
      const stage = TCP_UDP_STAGES[compareStage];
      $('[data-compare-stage-title]').textContent = stage.title;
      $('[data-tcp-stage-copy]').textContent = stage.tcp;
      $('[data-udp-stage-copy]').textContent = stage.udp;
      $('[data-compare-insight]').textContent = stage.insight;
      $('[data-compare-prev]').disabled = compareStage === 0;
      $('[data-compare-next]').disabled = compareStage === TCP_UDP_STAGES.length - 1;
      $('[data-compare-track]').innerHTML = TCP_UDP_STAGES.map((item, i) =>
        '<button type="button" class="osi-compare-stage' + (i === compareStage ? ' is-active' : '') + (i < compareStage ? ' is-done' : '') + '" data-compare-step="' + i + '" aria-pressed="' + String(i === compareStage) + '"><span>' + (i < compareStage ? '✓' : String(i + 1)) + '</span><small>' + escape(item.title.replace(/^\\d+\\. /, '')) + '</small></button>'
      ).join('');
      const tcpVisual = compareStage === 0
        ? ['Client  SYN','Server  SYN-ACK','Client  ACK']
        : compareStage === 3 ? ['FIN →','← ACK','← FIN','ACK →'] : ['SEQ 1000 →','← ACK 1500','SEQ 1500 →'];
      const udpVisual = compareStage === 0
        ? ['No handshake','Datagram ready','Send immediately']
        : compareStage === 3 ? ['No transport close','Stop sending','Application cleanup'] : ['Datagram 1 →','Datagram 2 →','Datagram 3 →'];
      $('[data-tcp-visual]').innerHTML = tcpVisual.map((item, i) => '<span class="osi-packet-chip">' + escape(item) + '</span>').join('');
      $('[data-udp-visual]').innerHTML = udpVisual.map((item, i) => '<span class="osi-packet-chip">' + escape(item) + '</span>').join('');
    };
\n    const renderPduFlow = protocol => {
      const labels = direction === 'send'
        ? [{name:'Application data',pdu:'Data'},{name:protocol === 'UDP' ? 'UDP header' : 'TCP header',pdu:protocol === 'UDP' ? 'UDP datagram' : 'TCP segment'},{name:'IP header',pdu:'Packet'},{name:'Link header + trailer',pdu:'Frame'},{name:'Signals on medium',pdu:'Bits / symbols'}]
        : [{name:'Signals recovered',pdu:'Bits / symbols'},{name:'Link header + trailer removed',pdu:'Frame'},{name:'IP header examined / removed',pdu:'Packet'},{name:protocol === 'UDP' ? 'UDP header examined / removed' : 'TCP header examined / removed',pdu:protocol === 'UDP' ? 'UDP datagram' : 'TCP segment'},{name:'Application data delivered',pdu:'Data'}];
      const reached = direction === 'send' ? [1, 1, 2, 2, 3, 4, 5][index] : [1, 2, 3, 4, 5, 5, 5][index];
      const count = reached;
      $('[data-pdu-flow]').innerHTML = labels.map((item,i) => '<div class="osi-pdu-node' + (i < count ? ' is-reached' : '') + '"><small>' + escape(item.name) + '</small><strong>' + escape(item.pdu) + '</strong></div>').join('<span class="osi-pdu-arrow" aria-hidden="true">→</span>');
    };
    const renderTcpMap = active => {
      const groups = [
        {name:'Application',layers:[7,6,5],detail:'HTTP, DNS, SMTP and representation/session responsibilities'},
        {name:'Transport',layers:[4],detail:'TCP and UDP process-to-process delivery'},
        {name:'Internet',layers:[3],detail:'IP addressing and routing'},
        {name:'Network Access / Link',layers:[2,1],detail:'Ethernet, Wi-Fi and physical media'}
      ];
      $('[data-tcp-map]').innerHTML = groups.map(group => '<div class="osi-tcp-group' + (group.layers.includes(active.n) ? ' is-active' : '') + '"><strong>' + escape(group.name) + '</strong><span>OSI ' + group.layers.join(' · ') + '</span><small>' + escape(group.detail) + '</small></div>').join('');
    };
    root.innerHTML = markup();
    render();
    root.addEventListener('click', event => {
      const layerButton = event.target.closest('[data-layer]');
      if (layerButton) {
        stopAuto();
        const layerNumber = Number(layerButton.dataset.layer);
        index = direction === 'send' ? 7 - layerNumber : layerNumber - 1;
        render();
        return;
      }
      const compareStep = event.target.closest('[data-compare-step]');
      if (compareStep) { compareStage = Number(compareStep.dataset.compareStep); renderTcpUdpComparison(); return; }
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-compare-prev')) {
        compareStage = Math.max(0, compareStage - 1); renderTcpUdpComparison();
      } else if (button.hasAttribute('data-compare-next')) {
        compareStage = Math.min(TCP_UDP_STAGES.length - 1, compareStage + 1); renderTcpUdpComparison();
      } else if (button.hasAttribute('data-direction')) {
        stopAuto();
        direction = button.dataset.direction;
        index = 0;
        root.querySelectorAll('[data-direction]').forEach(item => {
          const active = item.dataset.direction === direction;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        render();
      } else if (button.hasAttribute('data-prev')) {
        stopAuto(); index = Math.max(0, index - 1); render();
      } else if (button.hasAttribute('data-next')) {
        stopAuto(); index = Math.min(6, index + 1); render();
      } else if (button.hasAttribute('data-reset')) {
        stopAuto(); index = 0; render();
      } else if (button.hasAttribute('data-switch')) {
        stopAuto();
        if (direction === 'send') direction = 'receive';
        else direction = 'send';
        index = 0;
        root.querySelectorAll('[data-direction]').forEach(item => {
          const active = item.dataset.direction === direction;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        render();
      } else if (button.hasAttribute('data-auto')) {
        if (timer) { stopAuto(); return; }
        if (index === 6) index = -1;
        button.textContent = 'Ⅱ Pause'; button.setAttribute('aria-pressed','true');
        timer = window.setInterval(() => {
          if (index >= 6) { stopAuto(); return; }
          index += 1; render();
          const auto = $('[data-auto]');
          if (auto && index < 6) { auto.textContent = 'Ⅱ Pause'; auto.setAttribute('aria-pressed','true'); }
          else stopAuto();
        }, 1700);
      }
    }, { signal });
    root.addEventListener('change', event => {
      if (event.target.id === 'osi-transport' || event.target.id === 'osi-message') render();
    }, { signal });
    return () => { stopAuto(); controller.abort(); };
  }
});
