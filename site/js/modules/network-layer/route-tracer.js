/**
 * Live route: trace the real network path from the BitSecure server to a public IPv4 address and,
 * if a BitSecure receiver (receiver.py) is running there, deliver a message to it.
 * All text that comes from the server or the network is inserted with textContent only.
 */
import { ApiError, authedRequest, streamNdjson } from '../../auth/api.js';
import { panel } from '../../core/ui-helpers.js';
import { $ } from '../../core/utils.js';
import { regMod } from '../registry.js';

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const BADGES = { route_only: 'Route only', delivered: 'Delivered', delivery_failed: 'Delivery failed', unreachable: 'No reply' };

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

regMod({
  id: 'live-route',
  group: 'net',
  title: 'Live route',
  desc: 'Send a message to a real public IP address and watch the actual path it takes, hop by hop.',
  obj: [
    'See the real routers between the BitSecure server and any public IPv4 address.',
    'Learn why some hops show no reply and why private hops hide their addresses.',
    'Deliver a message to a BitSecure receiver and verify it arrived intact with a checksum.',
  ],
  mount(root) {
    root.innerHTML =
      panel('Send to a real IP address', `
        <div class="controls">
          <div class="field"><label for="lr-ip">Target IPv4 address</label>
            <input id="lr-ip" type="text" inputmode="decimal" placeholder="8.8.8.8" spellcheck="false" autocomplete="off"></div>
        </div>
        <div class="field"><label for="lr-msg">Message (optional)</label>
          <textarea id="lr-msg" rows="3" placeholder="Hello from BitSecure"></textarea>
          <small id="lr-count" class="lr-hint">0 bytes</small></div>
        <div class="btnrow"><button class="btn" id="lr-go" type="button">Send</button>
          <button class="btn ghost" id="lr-stop" type="button" hidden>Stop</button></div>
        <p id="lr-status" class="lr-hint" role="status" aria-live="polite"></p>
        <p class="lr-hint">The route shown is from the <b id="lr-server">BitSecure server</b> to the target, not from your device.
          Without a BitSecure receiver at the target, only the route is shown and nothing is delivered.</p>`) +
      panel('Route', `<ol id="lr-path" class="lr-path" aria-label="Network path"></ol><div id="lr-summary"></div>`) +
      `<div id="lr-receiver"></div>`;

    const ipIn = $('#lr-ip', root), msgIn = $('#lr-msg', root), go = $('#lr-go', root), stop = $('#lr-stop', root);
    const statusEl = $('#lr-status', root), path = $('#lr-path', root), summary = $('#lr-summary', root);
    const recv = $('#lr-receiver', root), count = $('#lr-count', root);
    let ctrl = null, limit = 1024, receiverName = '', target = '';

    const say = (t) => { statusEl.textContent = t; };
    const bytes = () => new TextEncoder().encode(msgIn.value).length;
    const updateCount = () => {
      count.textContent = `${bytes()} / ${limit} bytes`;
      count.classList.toggle('lr-bad', bytes() > limit);
    };
    msgIn.addEventListener('input', updateCount);

    authedRequest('/api/route/config').then((c) => {
      limit = c.max_message_bytes;
      $('#lr-server', root).textContent = c.server_label;
      if (!c.receiver_detection) say('Receiver detection is off on this server, so only routes can be traced.');
      updateCount();
    }).catch(() => {});

    function node(cls, n, main, note, rtt) {
      const li = el('li', `lr-node ${cls}`);
      li.append(el('span', 'lr-n', n), el('span', 'lr-ip', main));
      if (note) li.append(el('span', 'lr-note', note));
      if (rtt != null) {
        li.append(el('span', 'lr-rtt', `${rtt} ms`));
        const bar = el('span', 'lr-bar');
        bar.style.setProperty('--w', `${Math.min(100, rtt / 2)}%`);
        li.append(bar);
      }
      return li;
    }
    const markNow = (li) => { path.querySelector('.lr-now')?.classList.remove('lr-now'); li.classList.add('lr-now'); };

    function reset() {
      path.replaceChildren(node('lr-end', 'You', 'Your browser'), node('lr-end', '→', 'BitSecure server'));
      summary.replaceChildren();
      recv.replaceChildren();
      receiverName = '';
    }

    function addHop(h) {
      const cls = h.timeout ? 'lr-timeout' : h.private ? 'lr-private' : '';
      const li = node(cls, String(h.hop), h.timeout ? 'no reply' : h.ip,
        h.timeout ? '' : h.private ? 'private network' : '', h.rtt_ms == null ? null : Math.round(h.rtt_ms * 10) / 10);
      if (!h.timeout && h.ip === target) li.classList.add('lr-target');
      path.append(li);
      markNow(li);
    }

    function showDelivery(d) {
      const box = el('section', 'panel');
      box.append(el('h3', null, `Receiver${receiverName ? ': ' + receiverName : ''}`));
      const rows = [
        ['Status', d.ok ? 'Delivered, checksum matched' : 'Delivery failed'],
        ['Received text', d.text || '(nothing)'],
        ['Bytes', d.bytes == null ? '-' : String(d.bytes)],
        ['Checksum (SHA-256) matched', d.sha256_ok ? 'Yes' : 'No'],
        ['Round trip to receiver', d.ack_ms == null ? '-' : `${d.ack_ms} ms`],
      ];
      const dl = el('dl', 'lr-dl');
      for (const [k, v] of rows) dl.append(el('dt', null, k), el('dd', null, v));
      box.append(dl);
      recv.replaceChildren(box);
    }

    function onLine(l) {
      if (l.type === 'hop') addHop(l);
      else if (l.type === 'receiver') receiverName = l.found ? l.name || '' : '';
      else if (l.type === 'delivery') showDelivery(l);
      else if (l.type === 'done') {
        path.querySelector('.lr-now')?.classList.remove('lr-now');
        if (!l.reached) path.append(node('lr-timeout', '?', `${target}: no reply`));
        const badge = el('span', `lr-badge lr-${l.status}`, BADGES[l.status] || l.status);
        summary.replaceChildren(badge, el('span', 'lr-sumtext', `${l.hops} hops. ${l.message}`));
      } else if (l.type === 'error') say(l.message);
    }

    async function run() {
      const ip = ipIn.value.trim();
      if (!IPV4.test(ip)) return say('Enter a valid IPv4 address such as 8.8.8.8.');
      if (bytes() > limit) return say(`The message is too long (max ${limit} bytes).`);
      target = ip;
      reset();
      say('Tracing the route...');
      ctrl = new AbortController();
      go.disabled = true; stop.hidden = false;
      try {
        await streamNdjson('/api/route/run', { target: ip, message: msgIn.value.trim() ? msgIn.value : null }, onLine, ctrl.signal);
        if (statusEl.textContent === 'Tracing the route...') say('');
      } catch (err) {
        say(err.name === 'AbortError' ? 'Stopped.' : err instanceof ApiError ? err.message : 'Something went wrong.');
      } finally {
        go.disabled = false; stop.hidden = true; ctrl = null;
      }
    }

    go.addEventListener('click', run);
    stop.addEventListener('click', () => ctrl?.abort());
    ipIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    reset();
    updateCount();
    return () => ctrl?.abort();
  },
});
