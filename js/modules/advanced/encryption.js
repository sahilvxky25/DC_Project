/**
 * Advanced learning module: Encryption and decryption lab.
 *
 * Demonstrates optional payload encryption before packetization and authenticated
 * decryption after reassembly. Uses the browser Web Crypto API; no keys leave the browser.
 */
import { regMod } from '../registry.js';
import { panel, hn, chipRow, vd, statRow } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { hex } from '../../core/encoding.js';

const bytesHex = bytes => Array.from(bytes).slice(0, 96).map(hex).join(' ') +
  (bytes.length > 96 ? ' …' : '');

regMod({
  id: 'encryption',
  group: 'adv',
  title: 'Encryption and decryption lab',
  desc: 'Encrypt text or files, send ciphertext in packets, reassemble it and verify it at the receiver.',
  obj: [
    'Compare plaintext transmission with AES-GCM encryption.',
    'See how ECDH establishes a shared key for AES-GCM.',
    'Observe authentication failure when ciphertext is changed.',
  ],
  mount(root) {
    const supported = typeof crypto !== 'undefined' && !!crypto.subtle;
    root.innerHTML = panel(
      'Protect a message before it enters the network',
      (supported
        ? '<p class="hint">Choose a payload and security mode. The sender encrypts the bytes, splits the result into packets, and the receiver reassembles and decrypts them. Encryption is optional so you can compare both paths.</p>'
        : '<p class="hint">Web Crypto is unavailable. Open the site over HTTPS or localhost to use this lab.</p>') +
      (supported ? `
        <div class="controls">
          <div class="field grow"><label for="enc-message">Text message</label><textarea id="enc-message" rows="3">Meet at the network lab.</textarea></div>
          <div class="field grow"><label for="enc-file">Or choose a file (image, video, audio, or document)</label><input id="enc-file" type="file"></div>
        </div>
        <div class="controls">
          <div class="field"><label for="enc-mode">Security mode</label><select id="enc-mode">
            <option value="none">No encryption (plain bytes)</option>
            <option value="aes">AES-256-GCM (shared key)</option>
            <option value="ecdh">ECDH P-256 + AES-256-GCM (hybrid)</option>
          </select></div>
          <div class="field"><label for="enc-size">Packet payload size</label><input id="enc-size" type="number" min="8" max="1024" value="16"></div>
        </div>
        <div class="btnrow"><button class="btn" id="enc-run">Encrypt and transmit</button><button class="btn ghost" id="enc-tamper" disabled>Tamper with ciphertext</button></div>
        <div id="enc-output" aria-live="polite"></div>`
      : ''),
      'AES-GCM provides confidentiality and authenticated integrity. Packet CRCs detect accidental transmission errors; the GCM tag detects unauthorized changes.'
    );
    if (!supported) return;
    let last = null, downloadUrl = null;
    const out = $('#enc-output', root);
    const show = html => { out.innerHTML = html; };
    const run = async tamper => {
      const file = $('#enc-file', root).files[0];
      const source = file ? new Uint8Array(await file.arrayBuffer()) : new TextEncoder().encode($('#enc-message', root).value);
      if (!source.length) { show(vd('warn', 'Nothing to send.', 'Enter a message or choose a non-empty file.')); return; }
      const mode = $('#enc-mode', root).value;
      const packetSize = Math.max(8, Math.min(1024, Number($('#enc-size', root).value) || 16));
      let payload = source, iv = null, key = null, exchange = '';
      if (mode !== 'none') {
        if (mode === 'aes') {
          key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
          exchange = '<p class="hint">A fresh AES-256-GCM key was generated for this demonstration. In a real protocol, both peers need a secure key-establishment mechanism.</p>';
        } else {
          const pairA = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
          const pairB = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
          const derive = (privateKey, publicKey) => crypto.subtle.deriveKey(
            { name: 'ECDH', public: publicKey }, privateKey,
            { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
          );
          const [keyA, keyB] = await Promise.all([
            derive(pairA.privateKey, pairB.publicKey), derive(pairB.privateKey, pairA.publicKey)
          ]);
          key = keyA;
          const pubA = new Uint8Array(await crypto.subtle.exportKey('raw', pairA.publicKey));
          const pubB = new Uint8Array(await crypto.subtle.exportKey('raw', pairB.publicKey));
          exchange = '<p class="hint">ECDH P-256: client and server exchange public keys only. Both independently derive the same AES-256-GCM key; private keys stay local. Public-key fingerprints: ' +
            esc(bytesHex(pubA.slice(0, 8))) + ' / ' + esc(bytesHex(pubB.slice(0, 8))) + '.</p>';
          // Keep the receiver's independently derived key for the decryption step.
          last = { receiverKey: keyB };
        }
        iv = crypto.getRandomValues(new Uint8Array(12));
        payload = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, source));
      }
      const originalPayload = payload.slice();
      const packets = [];
      for (let offset = 0; offset < payload.length; offset += packetSize) {
        packets.push(payload.slice(offset, Math.min(offset + packetSize, payload.length)));
      }
      // Reassemble in sequence order to model the receiver's packet buffer.
      let received = new Uint8Array(packets.reduce((sum, packet) => sum + packet.length, 0));
      let cursor = 0;
      packets.forEach(packet => { received.set(packet, cursor); cursor += packet.length; });
      if (tamper && mode !== 'none' && received.length) received[0] ^= 1;
      let restored = null, errorText = '';
      if (mode === 'none') restored = received;
      else {
        try {
          const receiverKey = mode === 'ecdh' && last?.receiverKey ? last.receiverKey : key;
          restored = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, receiverKey, received));
        } catch (error) { errorText = 'Authentication failed: ciphertext or authentication tag was changed.'; }
      }
      if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
      const preview = restored
        ? (file ? 'File bytes restored successfully. <a class="btn sm" id="enc-download" download="' + esc(file.name) + '">Save restored file</a>' :
            '“' + esc(new TextDecoder().decode(restored).slice(0, 240)) + '”')
        : 'The receiver rejected the payload. No plaintext is released.';
      const packetRows = packets.slice(0, 12).map((packet, index) =>
        '<tr><td>' + (index + 1) + '</td><td>' + packet.length + '</td><td><code>' + esc(bytesHex(packet)) + '</code></td></tr>'
      ).join('');
      show(panel('Sender → network → receiver',
        exchange +
        statRow([[source.length + ' bytes', 'original payload'], [payload.length + ' bytes', mode === 'none' ? 'transmitted payload' : 'ciphertext + GCM tag'], [packets.length, 'packets created']]) +
        '<h4>Original bytes</h4>' + hn(esc(bytesHex(source))) +
        '<h4>' + (mode === 'none' ? 'Plain transmitted bytes' : 'Encrypted bytes') + '</h4>' +
        hn(mode === 'none' ? 'Encryption is disabled. These bytes are readable by anyone who can inspect the traffic.' : 'Nonce (12 bytes): ' + esc(bytesHex(iv)) + '. The final 16 bytes of AES-GCM output are the authentication tag.') +
        chipRow(Array.from(payload).slice(0, 64).map(hex), i => i >= payload.length - 16 && mode !== 'none' ? 'c2' : 'c0') +
        '<h4>Packetization</h4><div class="tscroll"><table class="tb"><thead><tr><th>Packet</th><th>Bytes</th><th>Payload preview</th></tr></thead><tbody>' + packetRows + '</tbody></table></div>' +
        (packets.length > 12 ? '<p class="hint">Showing the first 12 of ' + packets.length + ' packets.</p>' : '') +
        '<h4>Receiver</h4>' +
        (restored ? vd('ok', 'Reassembly and decryption successful.', preview) :
          vd('bad', 'Decryption refused.', errorText || 'The payload could not be restored.')) +
        (mode === 'none' ? '<p class="hint">No cryptographic authentication is present in plain mode.</p>' : '')
      ));
      last = { source, payload: originalPayload, iv, key, receiverKey: mode === 'ecdh' ? last?.receiverKey : key, mode, packetSize };
      if (restored && file) {
        downloadUrl = URL.createObjectURL(new Blob([restored], { type: file.type || 'application/octet-stream' }));
        const download = $('#enc-download', out);
        if (download) download.href = downloadUrl;
      }
      $('#enc-tamper', root).disabled = mode === 'none';
      $('#enc-tamper', root).textContent = 'Tamper with ciphertext and retry';
    };
    $('#enc-run', root).onclick = () => run(false).catch(error => show(vd('bad', 'Encryption could not run.', esc(error.message))));
    $('#enc-tamper', root).onclick = async () => {
      if (!last || last.mode === 'none') return;
      const received = last.payload.slice();
      if (received.length) received[0] ^= 1;
      try {
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: last.iv }, last.receiverKey || last.key, received);
        show(vd('bad', 'Unexpected result.', 'The modified payload was accepted; inspect the browser crypto implementation.'));
      } catch (error) {
        show(vd('ok', 'Tampering detected.', 'AES-GCM authentication failed, so the receiver rejected the altered ciphertext.'));
      }
    };
    return () => { last = null; if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
  },
});
