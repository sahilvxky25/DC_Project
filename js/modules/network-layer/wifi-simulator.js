/**
 * Wi-Fi and Wireless Networking Simulator.
 * All signal and interference values are simplified educational scores, not live radio readings.
 */
import { regMod } from '../registry.js';
import { esc } from '../../core/utils.js';
import {
  calculateDistance, calculateSignalStrength, calculateInterference,
  getConnectionStatus, compareWifiBands, clamp
} from '../../simulations/wifi-simulation.js';

const STORE_KEY = 'bitsecure-wifi-simulator-v1';
const DEVICE_TYPES = {
  ap: { label: 'Access point', icon: '⌁' },
  laptop: { label: 'Laptop', icon: '▣' },
  phone: { label: 'Smartphone', icon: '▯' },
  tablet: { label: 'Tablet', icon: '▭' },
  ethernet: { label: 'Ethernet PC', icon: '▤' },
};
const uid = () => 'wifi-' + Math.random().toString(36).slice(2, 9);
const DEFAULTS = () => ({
  devices: [
    { id: 'ap-1', type: 'ap', name: 'Access Point 1', x: 48, y: 45, ssid: 'Campus_WiFi', band: '2.4 GHz', channel: 6, power: 88 },
    { id: 'laptop-1', type: 'laptop', name: 'Laptop', x: 28, y: 28, ssid: 'Campus_WiFi', band: '2.4 GHz' },
    { id: 'phone-1', type: 'phone', name: 'Smartphone', x: 72, y: 28, ssid: 'Campus_WiFi', band: '2.4 GHz' },
    { id: 'tablet-1', type: 'tablet', name: 'Tablet', x: 73, y: 72, ssid: 'Campus_WiFi', band: '2.4 GHz' },
    { id: 'ap-2', type: 'ap', name: 'Access Point 2', x: 82, y: 52, ssid: 'Guest_WiFi', band: '2.4 GHz', channel: 6, power: 78 },
  ],
  obstacles: [{ id: 'wall-1', name: 'Wall', x: 45, y: 17, w: 5, h: 24, loss: 18 }]
});
function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (value && Array.isArray(value.devices) && Array.isArray(value.obstacles)) return value;
  } catch (_) {}
  return DEFAULTS();
}
const escAttr = value => esc(String(value ?? ''));

regMod({
  id: 'wifi-simulator',
  group: 'net',
  title: 'Wi-Fi and wireless networking simulator',
  desc: 'Build a wireless network and experiment with SSIDs, channels, coverage, interference, and obstacles.',
  obj: [
    'Place access points and wireless devices in a visual workspace.',
    'Configure SSIDs, frequency bands, channels, and transmit power.',
    'Explore simulated signal coverage, channel overlap, and obstacle attenuation.',
    'Compare 2.4 GHz and 5 GHz Wi-Fi with wired Ethernet.',
  ],
  mount(root) {
    let state = loadState();
    let selectedId = state.devices[0]?.id || null;
    let showCoverage = true;
    let showLinks = true;
    let drag = null;

    root.innerHTML = `
      <section class="wifi-simulator">
        <header class="wifi-heading">
          <div><p class="eyebrow">Network layer · Interactive lab</p><h2>Wi-Fi and wireless networking simulator</h2>
          <p class="hint">Build a virtual wireless network and see how distance, channels, and obstacles affect it.</p></div>
          <div class="wifi-actions"><button class="btn ghost sm" id="wifi-save">Save layout</button><button class="btn ghost sm" id="wifi-reset">Reset example</button></div>
        </header>
        <div class="wifi-toolbar panel">
          <div class="wifi-add-controls"><label for="wifi-add-type">Add device</label><select id="wifi-add-type">${Object.entries(DEVICE_TYPES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select><button class="btn sm" id="wifi-add">＋ Add</button></div>
          <div class="wifi-toggle-controls"><label><input type="checkbox" id="wifi-coverage" checked> Show coverage</label><label><input type="checkbox" id="wifi-links" checked> Show links</label><button class="btn ghost sm" id="wifi-add-wall">＋ Add wall</button></div>
        </div>
        <div class="wifi-layout">
          <section class="wifi-board-panel panel">
            <div class="wifi-board-top"><strong>Wireless workspace</strong><span class="hint">Select or drag a device · tap an empty area to move the selected device</span></div>
            <div class="wifi-board" id="wifi-board" aria-label="Wireless network workspace">
              <svg class="wifi-overlay" id="wifi-overlay" aria-hidden="true"></svg>
              <div class="wifi-obstacles" id="wifi-obstacles"></div>
              <div class="wifi-nodes" id="wifi-nodes"></div>
            </div>
            <div class="wifi-legend"><span><i class="wifi-dot strong"></i>Strong</span><span><i class="wifi-dot medium"></i>Moderate</span><span><i class="wifi-dot weak"></i>Weak</span><span><i class="wifi-dot none"></i>Disconnected</span><span class="hint">Coverage and signal are illustrative scores.</span></div>
          </section>
          <aside class="wifi-side panel"><div class="wifi-panel-title"><div><h3>Device settings</h3><p class="hint">Select a device on the workspace.</p></div><button class="btn danger sm" id="wifi-remove">Remove</button></div><div id="wifi-config"></div></aside>
        </div>
        <div class="wifi-insights">
          <section class="panel"><div class="wifi-panel-title"><div><h3>Signal and connection status</h3><p class="hint">Estimated from distance, band, obstacles, and nearby channel overlap.</p></div></div><div id="wifi-status" class="wifi-status-grid" aria-live="polite"></div></section>
          <section class="panel"><div class="wifi-panel-title"><div><h3>Channel interference</h3><p class="hint">Nearby access points on overlapping channels increase the simulated score.</p></div></div><div id="wifi-interference" aria-live="polite"></div></section>
        </div>
        <div class="wifi-lessons">
          <section class="panel"><h3>2.4 GHz vs 5 GHz</h3><p class="hint">Switch a selected access point's band and compare the model. Real performance depends on equipment, channel width, regulations, and the environment.</p><div id="wifi-band-compare"></div></section>
          <section class="panel"><h3>Wired Ethernet vs Wi-Fi</h3><div class="wifi-ethernet-compare"><div><b>Wired Ethernet</b><p>Uses a physical cable. This simulation's radio interference and wall penalties do not affect the wired link.</p><span class="wifi-badge good">Unaffected by simulated Wi-Fi interference</span></div><div><b>Wi-Fi</b><p>Uses radio waves and supports mobility, but signal strength can vary with distance, obstacles, and other networks.</p><span class="wifi-badge info">Signal and channel conditions modeled</span></div></div></section>
        </div>
        <p class="wifi-disclaimer hint">Educational simulation only: no real Wi-Fi networks are scanned or changed. Signal values are normalized 0–100 scores, not measured dBm; security settings are configuration labels, not real encryption.</p>
      </section>`;

    const $ = (selector) => root.querySelector(selector);
    const board = $('#wifi-board');
    const nodesEl = $('#wifi-nodes');
    const obstaclesEl = $('#wifi-obstacles');
    const overlay = $('#wifi-overlay');
    const config = $('#wifi-config');
    const safe = (value) => escAttr(value);
    const selected = () => state.devices.find(d => d.id === selectedId) || null;
    const aps = () => state.devices.filter(d => d.type === 'ap');
    const wireless = () => state.devices.filter(d => d.type !== 'ap' && d.type !== 'ethernet');
    const apFor = device => aps().find(ap => ap.ssid === device.ssid && ap.band === device.band &&
      getConnectionStatus(ap, device, state.obstacles, aps()) === 'Connected');
    const position = device => ({ x: Number(device.x) / 100 * board.clientWidth, y: Number(device.y) / 100 * board.clientHeight });
    const signalFor = device => {
      const ap = apFor(device);
      return ap ? calculateSignalStrength(ap, device, state.obstacles, aps()) : 0;
    };
    const signalClass = score => score >= 65 ? 'strong' : score >= 35 ? 'medium' : score >= 12 ? 'weak' : 'none';

    function renderBoard() {
      nodesEl.innerHTML = state.devices.map(device => {
        const meta = DEVICE_TYPES[device.type] || DEVICE_TYPES.laptop;
        const score = device.type === 'ap' ? 100 : signalFor(device);
        const status = device.type === 'ap' ? 'Access point' : device.type === 'ethernet' ? 'Wired link' : apFor(device) ? 'Connected' : 'Not connected';
        return `<button type="button" class="wifi-node ${device.type === 'ap' ? 'is-ap' : ''} ${device.id === selectedId ? 'is-selected' : ''}" data-id="${safe(device.id)}" style="left:${device.x}%;top:${device.y}%" aria-pressed="${device.id === selectedId}">
          <span class="wifi-node-icon" aria-hidden="true">${meta.icon}</span><strong>${safe(device.name)}</strong><small>${status}</small>${device.type !== 'ap' && device.type !== 'ethernet' ? `<span class="wifi-node-signal ${signalClass(score)}">${score}%</span>` : ''}
        </button>`;
      }).join('');
      obstaclesEl.innerHTML = state.obstacles.map(ob => `<button type="button" class="wifi-obstacle" data-obstacle="${safe(ob.id)}" style="left:${ob.x}%;top:${ob.y}%;width:${ob.w}%;height:${ob.h}%" title="${safe(ob.name)} — click to remove"><span>${safe(ob.name)} · click to remove</span></button>`).join('');
      renderOverlay();
      renderConfig();
      renderStatus();
      renderInterference();
      renderBandComparison();
    }

    function renderOverlay() {
      const w = board.clientWidth, h = board.clientHeight;
      overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
      overlay.innerHTML = '';
      if (showCoverage) {
        for (const ap of aps()) {
          const p = position(ap);
          const radius = (ap.power || 85) * (ap.band === '5 GHz' ? 1.8 : 2.15);
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y); circle.setAttribute('r', radius);
          circle.setAttribute('class', 'wifi-coverage-ring');
          circle.setAttribute('fill', ap.band === '5 GHz' ? 'rgba(167,139,250,.10)' : 'rgba(56,189,248,.10)');
          circle.setAttribute('stroke', ap.band === '5 GHz' ? '#a78bfa' : '#38bdf8');
          overlay.append(circle);
        }
      }
      if (showLinks) {
        for (const device of wireless()) {
          const ap = apFor(device);
          if (!ap) continue;
          const a = position(ap), b = position(device), line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
          line.setAttribute('class', 'wifi-link ' + signalClass(signalFor(device)));
          overlay.append(line);
        }
      }
    }

    function renderConfig() {
      const device = selected();
      $('#wifi-remove').disabled = !device;
      if (!device) { config.innerHTML = '<p class="hint">Select a device to edit its settings.</p>'; return; }
      const isAp = device.type === 'ap';
      config.innerHTML = `
        <form id="wifi-config-form" class="wifi-config-form">
          <div class="field"><label for="wifi-name">Device name</label><input id="wifi-name" name="name" maxlength="32" value="${safe(device.name)}" required></div>
          ${isAp ? `
            <div class="field"><label for="wifi-ssid">Network SSID</label><input id="wifi-ssid" name="ssid" maxlength="32" value="${safe(device.ssid)}" required></div>
            <div class="field"><label for="wifi-band">Frequency band</label><select id="wifi-band" name="band"><option ${device.band === '2.4 GHz' ? 'selected' : ''}>2.4 GHz</option><option ${device.band === '5 GHz' ? 'selected' : ''}>5 GHz</option></select></div>
            <div class="field"><label for="wifi-channel">Channel</label><select id="wifi-channel" name="channel">${(device.band === '5 GHz' ? [36,40,44,48,149,153,157,161] : [1,2,3,4,5,6,7,8,9,10,11,12,13]).map(c=>`<option value="${c}" ${Number(device.channel)===c?'selected':''}>${c}</option>`).join('')}</select><small class="hint">Available channels depend on country and equipment.</small></div>
            <div class="field"><label for="wifi-power">Transmit power: <output id="wifi-power-value">${device.power}</output></label><input id="wifi-power" name="power" type="range" min="35" max="100" value="${device.power}"></div>
            <div class="field"><label for="wifi-security">Security (educational label)</label><select id="wifi-security" name="security"><option>WPA2-Personal</option><option>WPA3-Personal</option><option>Open (not recommended)</option></select></div>
          ` : device.type === 'ethernet' ? '<p class="hint">This device represents a wired Ethernet endpoint and is not affected by the simulated radio link.</p>' : `
            <div class="field"><label for="wifi-device-ssid">SSID to join</label><input id="wifi-device-ssid" name="ssid" maxlength="32" value="${safe(device.ssid)}" required></div>
            <div class="field"><label for="wifi-device-band">Compatible band</label><select id="wifi-device-band" name="band"><option ${device.band === '2.4 GHz' ? 'selected' : ''}>2.4 GHz</option><option ${device.band === '5 GHz' ? 'selected' : ''}>5 GHz</option></select></div>
          `}
          <button class="btn sm" type="submit">Apply settings</button>
        </form>`;
      const form = $('#wifi-config-form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        device.name = String(data.get('name') || device.name).trim().slice(0, 32) || device.name;
        if (data.has('ssid')) device.ssid = String(data.get('ssid')).trim().slice(0, 32);
        if (data.has('band')) device.band = String(data.get('band'));
        if (data.has('channel')) device.channel = Number(data.get('channel'));
        if (data.has('power')) device.power = Number(data.get('power'));
        renderBoard();
      });
      const band = $('#wifi-band');
      if (band) band.addEventListener('change', () => {
        device.band = band.value;
        device.channel = band.value === '5 GHz' ? 36 : 6;
        renderBoard();
      });
      const power = $('#wifi-power');
      if (power) power.addEventListener('input', () => { $('#wifi-power-value').value = power.value; device.power = Number(power.value); renderBoard(); });
    }

    function renderStatus() {
      $('#wifi-status').innerHTML = state.devices.map(device => {
        if (device.type === 'ap') return '';
        if (device.type === 'ethernet') return `<article class="wifi-status-card"><b>${safe(device.name)}</b><span class="wifi-badge good">Wired Ethernet</span><small>Radio signal model does not apply.</small></article>`;
        const ap = apFor(device), score = signalFor(device), status = ap ? 'Connected' : 'Not connected';
        return `<article class="wifi-status-card"><b>${safe(device.name)}</b><span class="wifi-badge ${ap ? 'good' : 'bad'}">${status}</span><div class="wifi-meter"><span class="${signalClass(score)}" style="width:${score}%"></span></div><small>Signal: ${score}% ${ap ? '· ' + safe(ap.name) : '· Check SSID, band, distance, and obstacles'}</small></article>`;
      }).join('') || '<p class="hint">Add a device to see its signal status.</p>';
    }

    function renderInterference() {
      const points = aps();
      if (!points.length) { $('#wifi-interference').innerHTML = '<p class="hint">Add an access point to evaluate channels.</p>'; return; }
      $('#wifi-interference').innerHTML = points.map(ap => {
        const score = Math.round(calculateInterference(ap, points, ap.band));
        const overlapping = points.filter(other => other.id !== ap.id && other.band === ap.band && Math.abs(Number(other.channel)-Number(ap.channel)) < (ap.band === '2.4 GHz' ? 5 : 5) && calculateDistance(ap, other) < 360);
        return `<div class="wifi-interference-row"><div><b>${safe(ap.name)}</b><small>${safe(ap.band)} · Channel ${ap.channel}</small></div><div class="wifi-interference-meter"><span class="${score >= 55 ? 'high' : score >= 25 ? 'mid' : 'low'}" style="width:${score}%"></span></div><strong>${score}%</strong><small>${score >= 55 ? 'High' : score >= 25 ? 'Moderate' : 'Low'} simulated interference${overlapping.length ? ' · ' + overlapping.length + ' overlapping nearby AP(s)' : ''}</small></div>`;
      }).join('');
    }

    function renderBandComparison() {
      const device = selected();
      const distance = device && device.type !== 'ap' ? calculateDistance(device, aps()[0] || {x:50,y:50}) : 120;
      const result = compareWifiBands(distance, state.obstacles);
      $('#wifi-band-compare').innerHTML = Object.entries(result).map(([band, score]) => `<div class="wifi-band-row"><b>${band}</b><div class="wifi-meter"><span class="${signalClass(score)}" style="width:${score}%"></span></div><strong>${score}%</strong></div>`).join('') + '<p class="hint">This simplified comparison illustrates a common tendency, not a universal performance guarantee.</p>';
    }

    function addDevice(type) {
      const meta = DEVICE_TYPES[type] || DEVICE_TYPES.laptop;
      const isAp = type === 'ap';
      const count = state.devices.filter(d => d.type === type).length + 1;
      const device = { id: uid(), type, name: meta.label + ' ' + count, x: 20 + Math.random() * 60, y: 20 + Math.random() * 60 };
      if (isAp) Object.assign(device, { ssid: 'WiFi_Network_' + count, band: '2.4 GHz', channel: count % 3 === 0 ? 11 : count % 2 === 0 ? 6 : 1, power: 85 });
      else if (type !== 'ethernet') Object.assign(device, { ssid: aps()[0]?.ssid || 'Campus_WiFi', band: aps()[0]?.band || '2.4 GHz' });
      state.devices.push(device); selectedId = device.id; renderBoard();
    }

    $('#wifi-add').addEventListener('click', () => addDevice($('#wifi-add-type').value));
    $('#wifi-remove').addEventListener('click', () => {
      if (!selectedId) return;
      const item = selected();
      if (item?.type === 'ap') {
        // Devices remain on the board and become disconnected if their AP is removed.
      }
      state.devices = state.devices.filter(d => d.id !== selectedId);
      selectedId = state.devices[0]?.id || null; renderBoard();
    });
    $('#wifi-add-wall').addEventListener('click', () => {
      const n = state.obstacles.length + 1;
      state.obstacles.push({ id: uid(), name: 'Wall ' + n, x: 40, y: 35, w: 5, h: 25, loss: 18 });
      renderBoard();
    });
    $('#wifi-coverage').addEventListener('change', e => { showCoverage = e.target.checked; renderOverlay(); });
    $('#wifi-links').addEventListener('change', e => { showLinks = e.target.checked; renderOverlay(); });
    $('#wifi-save').addEventListener('click', () => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); $('#wifi-save').textContent = 'Saved ✓'; }
      catch (_) { $('#wifi-save').textContent = 'Save unavailable'; }
      setTimeout(() => { if ($('#wifi-save')) $('#wifi-save').textContent = 'Save layout'; }, 1500);
    });
    $('#wifi-reset').addEventListener('click', () => {
      state = DEFAULTS(); selectedId = state.devices[0]?.id || null;
      try { localStorage.removeItem(STORE_KEY); } catch (_) {}
      renderBoard();
    });
    nodesEl.addEventListener('click', event => {
      const node = event.target.closest('[data-id]');
      if (!node || drag?.moved) return;
      selectedId = node.dataset.id; renderBoard();
    });
    obstaclesEl.addEventListener('click', event => {
      const obstacle = event.target.closest('[data-obstacle]');
      if (!obstacle) return;
      state.obstacles = state.obstacles.filter(o => o.id !== obstacle.dataset.obstacle);
      renderBoard();
    });
    nodesEl.addEventListener('pointerdown', event => {
      const node = event.target.closest('[data-id]');
      if (!node) return;
      const device = state.devices.find(d => d.id === node.dataset.id);
      if (!device) return;
      selectedId = device.id;
      drag = { id: device.id, startX: event.clientX, startY: event.clientY, x: device.x, y: device.y, moved: false };
      node.setPointerCapture?.(event.pointerId);
    });
    nodesEl.addEventListener('pointermove', event => {
      if (!drag) return;
      const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      const device = state.devices.find(d => d.id === drag.id);
      if (!device) return;
      const bounds = board.getBoundingClientRect();
      device.x = clamp(drag.x + dx / Math.max(bounds.width, 1) * 100, 4, 96);
      device.y = clamp(drag.y + dy / Math.max(bounds.height, 1) * 100, 7, 93);
      const node = nodesEl.querySelector('[data-id="' + drag.id + '"]');
      if (node) { node.style.left = device.x + '%'; node.style.top = device.y + '%'; }
      renderOverlay();
      renderStatus();
      renderInterference();
    });
    const finishDrag = () => { if (drag?.moved) renderBoard(); drag = null; };
    nodesEl.addEventListener('pointerup', finishDrag);
    nodesEl.addEventListener('pointercancel', finishDrag);
    board.addEventListener('click', event => {
      if (event.target.closest('.wifi-node, .wifi-obstacle')) return;
      const device = selected();
      if (!device) return;
      const bounds = board.getBoundingClientRect();
      device.x = clamp((event.clientX - bounds.left) / bounds.width * 100, 4, 96);
      device.y = clamp((event.clientY - bounds.top) / bounds.height * 100, 7, 93);
      renderBoard();
    });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => renderOverlay()) : null;
    resizeObserver?.observe(board);
    renderBoard();
    return () => resizeObserver?.disconnect();
  }
});
