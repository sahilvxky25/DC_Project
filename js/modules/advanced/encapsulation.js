/**
 * learning module: Encapsulation stack
 *
 * Wrap and unwrap one message through nine steps, with options that damage it on the way.
 *
 * This file registers one learning module with regMod(). Its mount(root) function builds the screen inside
 * `root` and attaches event handlers; the function mount() returns (if any) is its cleanup, called by the router
 * when the learner leaves, so timers and listeners do not outlive the screen. The protocol logic lives in
 * ../../simulations/ and ../../core/; this file is the user interface for it.
 *
 * Imports:
 *   - ../../core/ui-helpers.js (shared HTML builders: icons, tables, tabs, ladder diagrams): chipRow, hn, panel, sel, statRow, vd
 *   - ../../core/utils.js (tiny DOM, math and timing helpers): $, esc
 *   - ../../core/state.js (shared in-memory state): S
 *   - ../../core/checksums.js (parity-free error-detection math: Internet checksum, CRC-8, CRC-32): crc32
 *   - ../../core/encoding.js (bytes, hex, bits and UTF-8 helpers): bin8, hex
 *   - ../../simulations/encapsulation.js (builds the layered data unit used by the encapsulation module): buildStack
 *   - ../../simulations/dissector.js (packet dissector: bytes -> layers, fields and integrity checks): parseFrame
 *   - ../registry.js (learning-module registry and group definitions): regMod
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { crc32 } from '../../core/checksums.js';
import { bin8, hex } from '../../core/encoding.js';
import { S } from '../../core/state.js';
import { chipRow, hn, panel, sel, statRow, vd } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { parseFrame } from '../../simulations/dissector.js';
import { buildStack } from '../../simulations/encapsulation.js';
import { regMod } from '../registry.js';

/* Register "Encapsulation stack". The router calls mount(root) when the learner opens #/m/encap and calls the returned function (if any) when they leave. */
regMod({
  id: 'encap',
  group: 'adv',
  title: 'Encapsulation stack',
  desc: 'Wrap your data in a TCP header, an IP header and an Ethernet frame with real bytes, then unwrap and verify it at the receiver.',
  obj: [
    'See exactly which bytes each layer adds.',
    'Compare the overhead of headers against the data they carry.',
    'Damage the packet and see which layer’s check catches it.',
  ],
  mount(root) {
    let step = 0;
    root.innerHTML =
      panel(
        'Data to send',
        `<div class="controls"><div class="field grow"><label for="en">Application data</label><input id="en" type="text" maxlength="200" value="${esc((S.msg || 'Hello').slice(0, 40))}" spellcheck="false"></div>
      <div class="field"><label for="ew">Damage</label>${sel(
        'ew',
        [
          ['none', 'None'],
          ['wire-data', 'Flip a data bit on the wire'],
          ['rtr-data', 'Flip a data bit inside a router'],
          ['rtr-ip', 'Flip a header bit inside a router'],
        ],
        'none'
      )}</div></div>`,
        'A flip on the wire is caught by the Ethernet FCS. A flip inside a router happens after the FCS was checked, so only the IP or TCP checksum can notice it.'
      ) +
      `<div class="panel"><div class="controls"><div class="btnrow"><button class="btn ghost sm" id="eprev">← Back</button><button class="btn" id="enext">Next step →</button><button class="btn ghost sm" id="ereset">Reset</button></div><span class="hint" id="ecnt"></span></div><div id="estack"></div></div><div id="edump"></div><div id="encap-enhanced"></div>`;
    const STEPS = [
      'Application data',
      'Add the TCP header',
      'Add the IP header',
      'Add the Ethernet header and FCS',
      'Bits on the wire',
      'Receiver checks the Ethernet FCS',
      'Receiver checks the IP header',
      'Receiver checks the TCP segment',
      'Data delivered to the application',
    ];

    // Enhanced OSI / TCP-IP learning view. This intentionally reuses the existing
    // byte-accurate buildStack simulation and leaves the original integrity lab intact.
    const enhanced = $('#encap-enhanced', root);
    enhanced.innerHTML = `
      <section class="panel osi-visualizer" aria-labelledby="osi-title">
        <div class="osi-heading">
          <div><p class="osi-eyebrow">INTERACTIVE LEARNING</p><h2 id="osi-title">OSI &amp; TCP/IP Encapsulation Visualizer</h2>
          <p class="muted">Follow the same message as each networking layer adds information.</p></div>
          <div class="osi-model-switch" role="group" aria-label="Networking model">
            <button type="button" class="btn sm" data-model="osi" aria-pressed="true">OSI Model</button>
            <button type="button" class="btn ghost sm" data-model="tcpip" aria-pressed="false">TCP/IP Model</button>
            <button type="button" class="btn ghost sm" id="osi-compare" aria-expanded="false">Compare Models</button>
          </div>
        </div>
        <div id="osi-compare-panel" class="osi-compare-panel" hidden>
          <div><h3>OSI model (7 layers)</h3><ol><li>Application</li><li>Presentation</li><li>Session</li><li>Transport</li><li>Network</li><li>Data Link</li><li>Physical</li></ol></div>
          <div><h3>TCP/IP model (4 layers)</h3><ol><li>Application</li><li>Transport</li><li>Internet</li><li>Network Access</li></ol></div>
          <p class="osi-compare-note">OSI Presentation and Session responsibilities are generally handled by application protocols and libraries in TCP/IP. Network Access combines link-layer and physical-layer responsibilities in this four-layer convention.</p>
        </div>
        <div class="osi-message"><label for="osi-message">Message being sent</label><code id="osi-message-preview">Hello</code><span id="osi-progress" class="hint">Layer 1 of 7</span></div>
        <div class="osi-controls">
          <div class="btnrow"><button type="button" class="btn ghost sm" id="osi-prev">← Previous</button><button type="button" class="btn sm" id="osi-next">Next layer →</button><button type="button" class="btn ghost sm" id="osi-play">▶ Play</button><button type="button" class="btn ghost sm" id="osi-reset">Reset</button></div>
          <label class="osi-speed">Speed <select id="osi-speed"><option value="1500">Slow</option><option value="900" selected>Normal</option><option value="400">Fast</option></select></label>
        </div>
        <div class="osi-stage-grid">
          <div><h3>Layer stack <span class="hint">Select any layer</span></h3><div id="osi-layer-stack" class="osi-layer-stack"></div></div>
          <div class="osi-detail" id="osi-layer-detail" aria-live="polite"></div>
        </div>
        <div class="osi-practice">
          <div><p class="osi-eyebrow">QUICK CHECK</p><h3 id="osi-question">Which layer adds the TCP header?</h3></div>
          <div id="osi-answers" class="osi-answers"></div><p id="osi-feedback" class="osi-feedback" aria-live="polite">Choose an answer to check your understanding.</p>
          <div class="btnrow"><button type="button" class="btn ghost sm" id="osi-next-question">Next question</button><span id="osi-score" class="hint">Score: 0 / 0</span></div>
        </div>
      </section>`;
    const modelLayers = {
      osi: [
        {name:'Application', unit:'Application data', header:'Application protocol information', color:'c0', info:'Applications create the message. HTTP and DNS are examples of application-layer protocols; this layer does not add a universal OSI header.',source:'Application process',destination:'Remote application',preserved:'The original message is the payload passed to lower layers.'},
        {name:'Presentation', unit:'Application data', header:'No separate universal header', color:'c0', info:'Presentation responsibilities include data representation, encoding, compression and encryption. In TCP/IP these are commonly handled by application protocols or libraries such as TLS.',source:'Data representation',destination:'Compatible representation',preserved:'The message content remains the information to be delivered, though its representation may be transformed.'},
        {name:'Session', unit:'Application data', header:'No separate universal header', color:'c0', info:'Session responsibilities include establishing, managing and ending conversations. They do not require a separate header in every TCP/IP packet.',source:'Session / dialog context',destination:'Peer session',preserved:'The application data and its conversation context are carried forward.'},
        {name:'Transport', unit:'TCP segment', header:'TCP header (20 bytes in this example)', color:'c2', info:'TCP identifies application endpoints with ports and carries sequence, acknowledgment, control, window and checksum fields.',source:'TCP source port 49732',destination:'TCP destination port 80',preserved:'The application bytes remain the TCP payload. TCP adds its header around them.'},
        {name:'Network', unit:'IPv4 packet', header:'IPv4 header (20 bytes in this example)', color:'c1', info:'IP provides logical addressing and routing across networks. Routers inspect IP information to forward packets.',source:'10.0.0.2',destination:'93.184.216.34',preserved:'The complete TCP segment becomes the IP payload.'},
        {name:'Data Link', unit:'Ethernet frame', header:'Ethernet header (14 bytes) + FCS trailer (4 bytes)', color:'c3', info:'Ethernet frames carry MAC addresses for the local link, an EtherType and an FCS for error detection.',source:'MAC 3c:22:fb:1a:2b:3c',destination:'MAC 00:1b:44:11:3a:b7 (gateway)',preserved:'The IP packet becomes the Ethernet payload; padding may be added for the minimum frame size.'},
        {name:'Physical', unit:'Bits / signals', header:'No additional network-layer header', color:'c4', info:'The physical layer sends the frame as bits represented by electrical, optical or radio signals. It does not add another packet header.',source:'Local physical interface',destination:'Next-hop physical interface',preserved:'The encoded frame is transmitted over the medium as a sequence of signals.'}
      ],
      tcpip: [
        {name:'Application', unit:'Application data', header:'Application-protocol information (if applicable)', color:'c0', info:'The TCP/IP application layer groups the application, presentation and session responsibilities commonly described by OSI.',source:'Application process',destination:'Remote application',preserved:'The message is passed to the transport layer.'},
        {name:'Transport', unit:'TCP segment', header:'TCP header (20 bytes in this example)', color:'c2', info:'TCP provides process-to-process delivery using ports, sequence and acknowledgment numbers, flags, a window and a checksum.',source:'TCP source port 49732',destination:'TCP destination port 80',preserved:'Application bytes remain the TCP payload.'},
        {name:'Internet', unit:'IPv4 packet', header:'IPv4 header (20 bytes in this example)', color:'c1', info:'The Internet layer adds logical source and destination IP addresses and supports routing between networks.',source:'10.0.0.2',destination:'93.184.216.34',preserved:'The complete TCP segment becomes the IP payload.'},
        {name:'Network Access', unit:'Ethernet frame → bits', header:'Ethernet header (14 bytes) + FCS trailer (4 bytes)', color:'c3', info:'In the four-layer TCP/IP convention, Network Access groups link framing and physical transmission. Ethernet provides framing; the physical medium carries the encoded bits.',source:'Client MAC address',destination:'Next-hop gateway MAC address',preserved:'The IP packet is framed for the local link, then transmitted as bits.'}
      ]
    };
    const quiz = [
      {q:'Which layer adds the TCP header?',a:['Application','Transport','Network','Physical'],correct:1,why:'TCP operates at the transport layer and adds ports, sequence information, flags and other TCP fields.'},
      {q:'Which layer handles logical addressing with IPv4 or IPv6?',a:['Application','Transport','Network / Internet','Data Link'],correct:2,why:'The OSI Network layer and TCP/IP Internet layer handle IP addressing and routing.'},
      {q:'Which OSI layer is responsible for Ethernet framing?',a:['Application','Transport','Network','Data Link'],correct:3,why:'Ethernet framing belongs to the Data Link layer; the frame carries MAC addresses and an FCS trailer.'},
      {q:'What is the TCP segment carried inside?',a:['An IP packet','A DNS record','A physical signal directly','An Ethernet FCS'],correct:0,why:'The IP packet encapsulates the TCP segment. The Ethernet frame then encapsulates the IP packet.'},
      {q:'What happens first during receiver decapsulation?',a:['TCP header is removed','Application receives data','Ethernet frame is checked and processed','IP address is removed'],correct:2,why:'The receiving link layer processes the Ethernet frame first, including FCS verification where supported.'}
    ];
    let activeModel='osi', activeLayer=0, quizIndex=0, score=0, answered=0, timer=null;
    // Shuffle question order for a more useful repeatable practice session.
    for (let i=quiz.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[quiz[i],quiz[j]]=[quiz[j],quiz[i]];}
    const stopPlayback=()=>{if(timer!==null){clearInterval(timer);timer=null;} $('#osi-play',root).textContent='▶ Play';};
    // A small animated packet journey, layered over the conceptual stack.
    const motionMarkup = `
      <div class="osi-packet-journey" aria-label="Animated packet encapsulation journey">
        <div class="osi-journey-track" aria-hidden="true"><span class="osi-journey-packet">DATA</span></div>
        <div class="osi-journey-captions"><span>Sender</span><span id="osi-motion-status">Application data is ready</span><span>Receiver</span></div>
        <div class="osi-journey-actions"><button type="button" class="btn sm" id="osi-motion-run">▶ Animate packet journey</button><span class="hint">Watch headers wrap the payload, then get removed at the receiver.</span></div>
      </div>`;
    const stackHeading = enhanced.querySelector('.osi-stage-grid');
    if(stackHeading) stackHeading.insertAdjacentHTML('beforebegin',motionMarkup);
    const journeyTrack=$('#osi-visualizer-placeholder',root);
    const journey=enhanced.querySelector('.osi-journey-track');
    const journeyPacket=enhanced.querySelector('.osi-journey-packet');
    const journeyStatus=$('#osi-motion-status',root);
    let journeyTimers=[];
    const stopJourney=()=>{
      journeyTimers.forEach(id=>{clearTimeout(id);clearInterval(id);});
      journeyTimers=[];
      if(journey){journey.classList.remove('is-running','is-returning');}
      if(journeyPacket){journeyPacket.className='osi-journey-packet';journeyPacket.textContent='DATA';}
      const run=$('#osi-motion-run',root);if(run)run.textContent='▶ Animate packet journey';
    };
    const animateJourney=()=>{
      stopJourney();
      if(!journey||!journeyPacket||!journeyStatus)return;
      const run=$('#osi-motion-run',root);run.textContent='↻ Replay journey';
      journey.classList.add('is-running');
      const stages=[
        {at:0,label:'1. Application data starts the journey',packet:'DATA',className:'is-data'},
        {at:650,label:'2. Transport adds the TCP header',packet:'TCP + DATA',className:'is-tcp'},
        {at:1300,label:'3. Internet / Network adds the IP header',packet:'IP + TCP + DATA',className:'is-ip'},
        {at:1950,label:'4. Link layer wraps it in an Ethernet frame',packet:'ETH + IP + TCP + DATA + FCS',className:'is-ethernet'},
        {at:2600,label:'5. Bits travel across the link',packet:'101101…',className:'is-bits'},
        {at:3400,label:'6. Receiver checks the frame and removes Ethernet framing',packet:'IP + TCP + DATA',className:'is-ip'},
        {at:4150,label:'7. IP is processed; TCP segment is passed upward',packet:'TCP + DATA',className:'is-tcp'},
        {at:4900,label:'8. TCP is processed; application data is delivered',packet:'DATA ✓',className:'is-data'}
      ];
      stages.forEach(stage=>{
        journeyTimers.push(setTimeout(()=>{
          journeyPacket.className='osi-journey-packet '+stage.className;
          journeyPacket.textContent=stage.packet;
          journeyStatus.textContent=stage.label;
          journey.classList.toggle('is-returning',stage.at>=3400);
          if(stage.at===4900){journey.classList.remove('is-running');run.textContent='↻ Replay journey';}
        },stage.at));
      });
    };
    $('#osi-motion-run',root).addEventListener('click',animateJourney);

    const renderLayerDetail=()=>{
      const layers=modelLayers[activeModel], layer=layers[Math.min(activeLayer,layers.length-1)];
      $('#osi-layer-detail',root).innerHTML=`<p class="osi-eyebrow">SELECTED LAYER</p><h3>${layer.name}</h3><p>${layer.info}</p><dl class="osi-field-list"><dt>Data unit</dt><dd>${layer.unit}</dd><dt>Header / framing</dt><dd>${layer.header}</dd><dt>Source</dt><dd>${layer.source}</dd><dt>Destination</dt><dd>${layer.destination}</dd><dt>What is preserved?</dt><dd>${layer.preserved}</dd></dl><div class="osi-receiver-note"><strong>At the receiver</strong><p>Each receiving layer processes its own information, then passes the remaining payload upward. The application ultimately receives the original message if the data is accepted by the protocol stack.</p></div>`;
    };
    const renderLayers=()=>{
      const stack=$('#osi-layer-stack',root);
      const focusedButton=stack.contains(document.activeElement) ? document.activeElement.getAttribute('data-layer-index') : null;
      const layers=modelLayers[activeModel];
      activeLayer=Math.max(0,Math.min(activeLayer,layers.length-1));
      stack.innerHTML=layers.map((layer,i)=>`<button type="button" class="osi-layer ${layer.color} ${i===activeLayer?'is-selected':''} ${i<=activeLayer?'is-reached':''}" data-layer-index="${i}" aria-pressed="${i===activeLayer}"><span class="osi-layer-number">${activeModel==='osi'?7-i:i+1}</span><span><strong>${layer.name}</strong><small>${layer.unit}</small></span><span class="osi-layer-state">${i<activeLayer?'✓':i===activeLayer?'●':'○'}</span></button>`).join('');
      $('#osi-progress',root).textContent=`Step ${activeLayer+1} of ${layers.length}: ${layers[activeLayer].name}`;
      $('#osi-prev',root).disabled=activeLayer===0;
      $('#osi-next',root).disabled=activeLayer===layers.length-1;
      renderLayerDetail();
      if(focusedButton!==null){const focusTarget=stack.querySelector(`[data-layer-index="${focusedButton}"]`);if(focusTarget)focusTarget.focus({preventScroll:true});}
    };
    const renderQuestion=()=>{
      const q=quiz[quizIndex];
      $('#osi-question',root).textContent=q.q;
      $('#osi-answers',root).innerHTML=q.a.map((answer,i)=>`<button type="button" class="btn ghost sm" data-answer-index="${i}">${answer}</button>`).join('');
      $('#osi-feedback',root).textContent='Choose an answer to check your understanding.';
      $('#osi-feedback',root).className='osi-feedback';
      $('#osi-score',root).textContent=`Score: ${score} / ${answered}`;
    };
    $('#osi-message-preview',root).textContent=$('#en',root).value||' ';
    const updatePreview=()=>{$('#osi-message-preview',root).textContent=$('#en',root).value||'(empty message)';};
    root.querySelectorAll('[data-model]').forEach(button=>button.addEventListener('click',()=>{
      stopPlayback(); activeModel=button.dataset.model; activeLayer=Math.min(activeLayer,modelLayers[activeModel].length-1);
      root.querySelectorAll('[data-model]').forEach(b=>{const on=b.dataset.model===activeModel;b.classList.toggle('ghost',!on);b.setAttribute('aria-pressed',String(on));});
      renderLayers();
    }));
    $('#osi-compare',root).addEventListener('click',()=>{
      const panel=$('#osi-compare-panel',root), opening=panel.hidden; panel.hidden=!opening;
      $('#osi-compare',root).setAttribute('aria-expanded',String(opening));
    });
    $('#osi-layer-stack',root).addEventListener('click',e=>{
      const button=e.target.closest('[data-layer-index]'); if(!button)return;
      stopPlayback(); activeLayer=Number(button.dataset.layerIndex); renderLayers();
    });
    $('#osi-prev',root).addEventListener('click',()=>{stopPlayback();activeLayer=Math.max(0,activeLayer-1);renderLayers();});
    $('#osi-next',root).addEventListener('click',()=>{activeLayer=Math.min(modelLayers[activeModel].length-1,activeLayer+1);renderLayers();});
    $('#osi-reset',root).addEventListener('click',()=>{stopPlayback();activeLayer=0;renderLayers();});
    $('#osi-play',root).addEventListener('click',()=>{
      if(timer!==null){stopPlayback();return;}
      if(activeLayer>=modelLayers[activeModel].length-1)activeLayer=0;
      $('#osi-play',root).textContent='Ⅱ Pause';
      timer=setInterval(()=>{
        if(activeLayer>=modelLayers[activeModel].length-1){stopPlayback();return;}
        activeLayer++;renderLayers();
      },Number($('#osi-speed',root).value));
      renderLayers();
    });
    $('#osi-speed',root).addEventListener('change',()=>{
      if(timer!==null){stopPlayback();$('#osi-play',root).click();}
    });
    $('#en',root).addEventListener('input',updatePreview);
    $('#osi-answers',root).addEventListener('click',e=>{
      const button=e.target.closest('[data-answer-index]');if(!button||button.disabled)return;
      const q=quiz[quizIndex],correct=Number(button.dataset.answerIndex)===q.correct;
      answered++;if(correct)score++;
      $('#osi-answers',root).querySelectorAll('button').forEach((b,i)=>{b.disabled=true;if(i===q.correct)b.classList.add('osi-answer-correct');else if(i===Number(button.dataset.answerIndex))b.classList.add('osi-answer-wrong');});
      $('#osi-feedback',root).textContent=(correct?'Correct! ':'Not quite. ')+q.why;
      $('#osi-feedback',root).className='osi-feedback '+(correct?'is-correct':'is-wrong');
      $('#osi-score',root).textContent=`Score: ${score} / ${answered}`;
    });
    $('#osi-next-question',root).addEventListener('click',()=>{quizIndex=(quizIndex+1)%quiz.length;renderQuestion();});
    renderLayers();renderQuestion();

    const render = () => {
      const text = $('#en', root).value || ' ',
        st = buildStack(text),
        mode = $('#ew', root).value;
      let fr = st.eth.slice();
      if (mode !== 'none') {
        const idx = mode === 'rtr-ip' ? 14 + 8 : 14 + 20 + 20 + st.app.length - 1;
        fr[idx] ^= 1;
        if (mode.startsWith('rtr')) {
          const f = crc32(fr.slice(0, -4));
          fr = [...fr.slice(0, -4), f & 255, (f >>> 8) & 255, (f >>> 16) & 255, (f >>> 24) & 255];
        }
      }
      const pr = parseFrame(fr),
        chk = Object.fromEntries(pr.checks.map(c => [c.layer, c]));
      const nApp = st.app.length,
        hdrE = 14,
        hdrI = 20,
        hdrT = 20,
        fcs = 4;
      const parts = [
        ['Ethernet', hdrE, 'c3', 3],
        ['IP', hdrI, 'c1', 2],
        ['TCP', hdrT, 'c2', 1],
        ['Data', nApp, 'c0', 0],
      ];
      const visible = step <= 3 ? step : 3;
      const layers = [['Application data', nApp, 'c0']];
      if (step >= 1) layers.unshift(['TCP header', hdrT, 'c2']);
      if (step >= 2) layers.unshift(['IP header', hdrI, 'c1']);
      if (step >= 3) layers.unshift(['Ethernet header', hdrE, 'c3']);
      const seg = [],
        endSeg = [];
      if (step >= 3)
        endSeg.push(...(st.pad ? [['padding', st.pad, 'c4']] : []), ['FCS', fcs, 'c3']);
      const total =
        nApp +
        (step >= 1 ? hdrT : 0) +
        (step >= 2 ? hdrI : 0) +
        (step >= 3 ? hdrE + fcs + st.pad : 0);
      void parts;
      void visible;
      void seg;
      const bar = [...layers, ...endSeg]
        .map(
          ([n, b, c]) =>
            `<div class="seg ${c}" style="flex:${Math.max(b, 3)}" title="${n}: ${b} bytes"><b>${n}</b><small>${b} B</small></div>`
        )
        .join('');
      // unwrap state
      let bad = null;
      if (step >= 5) {
        if (!chk['Ethernet FCS'].ok) bad = 5;
      }
      if (!bad && step >= 6 && chk['IPv4 header checksum'] && !chk['IPv4 header checksum'].ok)
        bad = 6;
      if (!bad && step >= 7 && chk['TCP checksum'] && !chk['TCP checksum'].ok) bad = 7;
      const failed = bad !== null && step >= bad;
      $('#ecnt', root).textContent = `Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`;
      $('#estack', root).innerHTML =
        `<div class="segbar">${bar}</div>` +
        statRow([
          [nApp, 'data bytes'],
          [step >= 1 ? total : nApp, 'bytes at this stage'],
          [
            step >= 3
              ? hdrE + hdrI + hdrT + fcs + st.pad
              : step >= 2
                ? hdrI + hdrT
                : step >= 1
                  ? hdrT
                  : 0,
            'overhead bytes',
          ],
          [step >= 1 ? Math.round(((total - nApp) / total) * 100) + '%' : '0%', 'overhead share'],
        ]);
      let note = '';
      if (step === 0)
        note = vd(
          'info',
          'Start with your data.',
          `${nApp} bytes of UTF-8. TCP will number them, IP will address them, and Ethernet will frame them.`
        );
      else if (step === 1)
        note = vd(
          'info',
          'Transport layer.',
          'Ports say which application, the sequence number orders the bytes, and the checksum covers header, data and a pseudo-header with the IP addresses.'
        );
      else if (step === 2)
        note = vd(
          'info',
          'Network layer.',
          'Source and destination addresses, TTL and a header checksum. Routers read this layer.'
        );
      else if (step === 3)
        note =
          vd(
            'info',
            'Link layer.',
            `MAC addresses for the next hop, EtherType 0x0800, ${st.pad ? st.pad + ' padding bytes to reach the 46-byte minimum, ' : ''}and a CRC-32 trailer.`
          ) +
          (st.ip.length > 1500
            ? vd(
                'warn',
                'Too big for one frame.',
                'The IP packet exceeds the 1500-byte MTU, so TCP would really split this into segments of at most 1460 bytes.'
              )
            : '');
      else if (step === 4)
        note =
          vd(
            'info',
            'On the wire.',
            `Preamble and inter-frame gap add 20 more byte-times. The first bytes as bits: ${fr.slice(0, 6).map(bin8).join(' ')} …`
          ) +
          (mode === 'wire-data'
            ? vd('warn', 'A bit flipped in transit.', 'Noise on the cable changed one data bit.')
            : mode.startsWith('rtr')
              ? vd(
                  'warn',
                  'A bit flipped inside a router.',
                  'The router’s memory corrupted the packet after it checked the frame, then built a fresh FCS around the damage.'
                )
              : '');
      else if (step === 5)
        note = chk['Ethernet FCS'].ok
          ? vd(
              'ok',
              'FCS valid.',
              `Stored ${chk['Ethernet FCS'].detail}. The frame header and trailer are removed.`
            )
          : vd(
              'bad',
              'FCS check failed: frame discarded.',
              chk['Ethernet FCS'].detail + '. Nothing above this layer ever sees the damaged data.'
            );
      else if (step === 6)
        note = failed
          ? bad === 5
            ? vd('bad', 'Never reached.', 'The frame was already discarded.')
            : vd(
                'bad',
                'IP header checksum failed: packet discarded.',
                'A router or host drops it silently.'
              )
          : vd(
              'ok',
              'IP header checksum valid.',
              `The destination address matches this host. The IP header is removed. Protocol field: ${pr.f['ip.proto']} (TCP).`
            );
      else if (step === 7)
        note = failed
          ? bad === 7
            ? vd(
                'bad',
                'TCP checksum failed: segment discarded.',
                'The data was damaged after the link-layer checks. TCP drops the segment and the sender will retransmit after a timeout.'
              )
            : vd('bad', 'Never reached.', 'An earlier layer already discarded the data.')
          : vd(
              'ok',
              'TCP checksum valid.',
              'Header, pseudo-header and data add up correctly. The sequence number is in order, so the bytes can be delivered.'
            );
      else
        note = failed
          ? vd(
              'bad',
              'Nothing delivered.',
              'A check failed on the way up, so the application receives nothing and TCP will retransmit.'
            )
          : vd('ok', 'Delivered.', `The application reads: “${esc(text)}”.`);
      $('#estack', root).insertAdjacentHTML('beforeend', note);
      const show = step >= 3 ? fr : step >= 2 ? st.ip : step >= 1 ? st.tcp : st.app,
        lim = 96;
      const cls = i => {
        if (step >= 3) {
          if (i < 14) return 'c3';
          if (i >= show.length - 4) return 'c3';
          if (i < 34) return 'c1';
          if (i < 54) return 'c2';
          return i < 54 + nApp ? 'c0' : 'c4';
        }
        if (step >= 2) return i < 20 ? 'c1' : i < 40 ? 'c2' : 'c0';
        if (step >= 1) return i < 20 ? 'c2' : 'c0';
        return 'c0';
      };
      $('#edump', root).innerHTML = panel(
        'Bytes at this stage',
        chipRow(show.slice(0, lim).map(hex), cls) +
          (show.length > lim
            ? hn(`… and ${show.length - lim} more bytes (${show.length} in total)`)
            : '') +
          `<div class="legend"><span class="c3"><i></i>Ethernet</span><span class="c1"><i></i>IP</span><span class="c2"><i></i>TCP</span><span class="c0"><i></i>data</span><span class="c4"><i></i>padding</span></div>`
      );
      $('#eprev', root).toggleAttribute('disabled', step === 0);
      $('#enext', root).toggleAttribute('disabled', step >= STEPS.length - 1);
    };
    $('#enext', root).onclick = () => {
      step++;
      render();
    };
    $('#eprev', root).onclick = () => {
      step--;
      render();
    };
    $('#ereset', root).onclick = () => {
      step = 0;
      render();
    };
    $('#en', root).oninput = render;
    $('#ew', root).onchange = render;
    render();
    return () => { stopPlayback(); stopJourney(); };
  },
});
