/**
 * Network Topology Builder — a small browser-only visual network lab.
 * Drag devices onto the board, connect them, configure IPv4 and test a virtual packet.
 */
import { regMod } from '../registry.js';
import { $, esc } from '../../core/utils.js';
import { formatDeviceAddress, packetRoute, testConnectivity, validateTopology } from '../../simulations/topology-simulation.js';

const TYPES = {
  pc: { label: 'PC', icon: '▣' },
  router: { label: 'Router', icon: '⇄' },
  switch: { label: 'Switch', icon: '▤' },
  server: { label: 'Server', icon: '▥' },
};
const STORE_KEY = 'bitsecure-topology-builder-v1';
const uid = () => 'dev-' + Math.random().toString(36).slice(2, 9);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const defaultTopology = () => ({
  devices: [
    { id: 'pc-a', type: 'pc', name: 'PC 1', x: 110, y: 120, config: { ip: '192.168.1.10', prefix: 24, gateway: '' } },
    { id: 'switch-a', type: 'switch', name: 'Switch 1', x: 310, y: 170, config: { ip: '', prefix: 24, gateway: '' } },
    { id: 'pc-b', type: 'pc', name: 'PC 2', x: 510, y: 120, config: { ip: '192.168.1.20', prefix: 24, gateway: '' } },
  ],
  links: [
    { id: 'link-a', source: 'pc-a', target: 'switch-a', status: 'up' },
    { id: 'link-b', source: 'switch-a', target: 'pc-b', status: 'up' },
  ],
});
function loadTopology() {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (value && Array.isArray(value.devices) && Array.isArray(value.links)) return value;
  } catch (_) {}
  return defaultTopology();
}

regMod({
  id: 'topology-builder',
  group: 'net',
  title: 'Network topology builder',
  desc: 'Build a virtual network, configure IPv4 devices, diagnose links and test connectivity.',
  obj: [
    'Place PCs, routers, switches and servers on a visual topology board.',
    'Connect devices with virtual cables and configure IPv4 addresses.',
    'Validate common mistakes and simulate a packet delivery test.',
  ],
  mount(root) {
    let topology = loadTopology();
    let selectedId = topology.devices[0]?.id || null;
    let selectedLinkId = null;
    let connectMode = false;
    let connectFrom = null;
    let drag = null;
    let packetTimer = null;
    let packetNode = null;
    let messages = ['Ready. Select a device to configure it, or choose Connect to draw a cable.'];

    root.innerHTML = `
      <section class="topology-builder">
        <div class="topology-heading">
          <div><p class="eyebrow">Network layer · Interactive lab</p><h2>Network topology builder</h2><p class="hint">Create a virtual network and test whether devices can communicate.</p></div>
          <div class="topology-actions"><button class="btn ghost sm" id="topology-save">Save</button><button class="btn ghost sm" id="topology-export">Export JSON</button><button class="btn ghost sm" id="topology-reset">Reset example</button></div>
        </div>
        <div class="topology-workspace">
          <aside class="topology-palette panel">
            <h3>Devices</h3><p class="hint">Tap or drag a device onto the board.</p>
            <div class="topology-device-palette">
              ${Object.entries(TYPES).map(([type, item]) => `<button type="button" class="topology-palette-item" draggable="true" data-device-type="${type}"><span aria-hidden="true">${item.icon}</span><b>${item.label}</b><small>Add device</small></button>`).join('')}
            </div>
            <button class="btn ${connectMode ? '' : 'ghost'}" id="topology-connect" aria-pressed="${connectMode}">${connectMode ? 'Cancel connect' : '＋ Connect devices'}</button>
            <p class="hint" id="topology-connect-hint">${connectMode ? 'Select the first device, then the second.' : 'Choose Connect devices, then select two devices.'}</p>
            <hr>
            <h3>IP configuration</h3><div id="topology-config"><p class="hint">Select a PC, router or server.</p></div>
          </aside>
          <div class="topology-board-wrap">
            <div class="topology-board-toolbar"><span class="topology-status-dot"></span><span>Virtual workspace</span><span class="topology-toolbar-spacer"></span><span class="hint">Drag devices to reposition</span></div>
            <div class="topology-board" id="topology-board" aria-label="Network topology workspace">
              <svg class="topology-cables" id="topology-cables" role="img" aria-label="Virtual network cables"></svg>
              <div class="topology-nodes" id="topology-nodes"></div>
              <div class="topology-empty" id="topology-empty" hidden>Choose a device from the palette to begin.</div>
            </div>
            <div class="topology-legend"><span><i class="is-up"></i> Cable up</span><span><i class="is-down"></i> Cable down</span><span>Red outline = configuration issue</span></div>
            <div class="topology-connection-actions" id="topology-connection-actions" hidden><span id="topology-selected-connection" class="hint"></span><button type="button" class="btn danger sm" id="topology-delete-connection">Delete connection</button><button type="button" class="btn ghost sm" id="topology-cancel-connection">Cancel</button></div>
          </div>
        </div>
        <div class="topology-lower-grid">
          <section class="panel topology-test-panel"><div class="topology-panel-heading"><div><h3>Connectivity test</h3><p class="hint">Test a virtual packet between two end devices.</p></div><button class="btn" id="topology-test">Test connection</button></div>
            <div class="controls"><div class="field grow"><label for="topology-source">Source</label><select id="topology-source"></select></div><div class="field grow"><label for="topology-target">Destination</label><select id="topology-target"></select></div></div>
            <div id="topology-test-result" aria-live="polite"><p class="hint">Run a test to see whether a virtual packet can reach its destination.</p></div>
          </section>
          <section class="panel"><div class="topology-panel-heading"><div><h3>Diagnostics</h3><p class="hint">Configuration and cable checks.</p></div><button class="btn ghost sm" id="topology-validate">Validate</button></div><div id="topology-diagnostics" aria-live="polite"></div></section>
        </div>
        <section class="panel topology-log-panel"><div class="topology-panel-heading"><div><h3>Packet event log</h3><p class="hint">A simplified educational simulation, not real network traffic.</p></div><button class="btn ghost sm" id="topology-clear-log">Clear log</button></div><ol id="topology-log" class="topology-log"></ol></section>
        <p class="hint topology-disclaimer">Simulation note: this lab models cable reachability and basic IPv4 subnet checks. It does not send packets over your real network and does not implement full router interfaces or routing tables.</p>
      </section>`;

    const board = $('#topology-board', root);
    const nodes = $('#topology-nodes', root);
    const cables = $('#topology-cables', root);
    const config = $('#topology-config', root);
    const diagnostics = $('#topology-diagnostics', root);
    const log = $('#topology-log', root);
    const findDevice = id => topology.devices.find(device => device.id === id);
    const endDevices = () => topology.devices.filter(device => device.type === 'pc' || device.type === 'server');

    function persist() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(topology)); } catch (_) {}
    }
    function addLog(message) {
      messages.unshift(new Date().toLocaleTimeString() + ' — ' + message);
      messages = messages.slice(0, 30);
      renderLog();
    }
    function renderLog() {
      log.innerHTML = messages.map(message => `<li>${escapeHtml(message)}</li>`).join('');
    }
    function point(device) {
      return { x: device.x + 48, y: device.y + 32 };
    }
    function renderBoard() {
      const width = Math.max(board.clientWidth, 520);
      const height = Math.max(board.clientHeight, 400);
      cables.setAttribute('viewBox', `0 0 ${width} ${height}`);
      cables.setAttribute('width', width);
      cables.setAttribute('height', height);
      cables.innerHTML = topology.links.map(link => {
        const a = findDevice(link.source), b = findDevice(link.target);
        if (!a || !b) return '';
        const p1 = point(a), p2 = point(b);
        const selected = link.id === selectedLinkId;
        return `<g class="topology-link-group"><line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="topology-link ${link.status === 'down' ? 'is-down' : 'is-up'} ${selected ? 'is-selected' : ''}" data-link-id="${link.id}" /><text x="${(p1.x + p2.x) / 2}" y="${(p1.y + p2.y) / 2 - 7}" class="topology-link-label">${link.status === 'down' ? 'DOWN' : ''}</text></g>`;
      }).join('');
      nodes.innerHTML = topology.devices.map(device => {
        const issue = validateTopology(topology.devices, topology.links).some(error => error.deviceId === device.id);
        return `<button type="button" class="topology-node type-${device.type} ${device.id === selectedId ? 'is-selected' : ''} ${issue ? 'has-issue' : ''}" data-device-id="${device.id}" style="left:${device.x}px;top:${device.y}px" aria-label="${escapeHtml(device.name)}, ${TYPES[device.type].label}">
          <span class="topology-node-icon" aria-hidden="true">${TYPES[device.type].icon}</span><strong>${escapeHtml(device.name)}</strong><small>${device.type === 'switch' ? 'Layer 2' : escapeHtml(formatDeviceAddress(device))}</small>
        </button>`;
      }).join('');
      $('#topology-empty', root).hidden = topology.devices.length > 0;
      const selectedLink = topology.links.find(link => link.id === selectedLinkId);
      const connectionActions = $('#topology-connection-actions', root);
      connectionActions.hidden = !selectedLink;
      if (selectedLink) $('#topology-selected-connection', root).textContent = (findDevice(selectedLink.source)?.name || 'Device') + ' ↔ ' + (findDevice(selectedLink.target)?.name || 'Device');
      renderSelects();
    }
    function renderSelects() {
      const list = endDevices();
      for (const id of ['topology-source', 'topology-target']) {
        const select = $('#' + id, root);
        const previous = select.value;
        select.innerHTML = list.map(device => `<option value="${device.id}">${escapeHtml(device.name)} — ${escapeHtml(device.config.ip || 'no IP')}</option>`).join('');
        if (list.some(device => device.id === previous)) select.value = previous;
      }
      if (list.length > 1 && $('#topology-source', root).value === $('#topology-target', root).value) {
        $('#topology-target', root).value = list[1].id;
      }
    }
    function renderConfig() {
      const device = findDevice(selectedId);
      if (!device) {
        config.innerHTML = '<p class="hint">Select a device on the board.</p>';
        return;
      }
      config.innerHTML = `
        <form id="topology-device-form" class="topology-device-form">
          <div class="field"><label for="topology-device-name">Device name</label><input id="topology-device-name" name="name" maxlength="32" value="${escapeHtml(device.name)}" required></div>
          ${device.type === 'switch' ? '<p class="hint">A basic switch forwards frames between connected devices. It does not need an IP address in this introductory lab.</p>' : `
          <div class="field"><label for="topology-device-ip">IPv4 address</label><input id="topology-device-ip" name="ip" value="${escapeHtml(device.config.ip)}" placeholder="192.168.1.10" inputmode="decimal" autocomplete="off"></div>
          <div class="field"><label for="topology-device-prefix">Prefix length</label><select id="topology-device-prefix" name="prefix">${Array.from({length: 32}, (_, i) => 32 - i).map(prefix => `<option value="${prefix}" ${Number(device.config.prefix) === prefix ? 'selected' : ''}>/${prefix}</option>`).join('')}</select></div>
          <div class="field"><label for="topology-device-gateway">Default gateway (optional)</label><input id="topology-device-gateway" name="gateway" value="${escapeHtml(device.config.gateway)}" placeholder="192.168.1.1" inputmode="decimal" autocomplete="off"></div>`}
          <button class="btn sm" type="submit">Apply settings</button>
          <button class="btn ghost sm" type="button" id="topology-delete-device">Delete device</button>
        </form>`;
      $('#topology-device-form', root).addEventListener('submit', event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        device.name = String(form.get('name') || '').trim() || TYPES[device.type].label;
        if (device.type !== 'switch') {
          device.config.ip = String(form.get('ip') || '').trim();
          device.config.prefix = Number(form.get('prefix'));
          device.config.gateway = String(form.get('gateway') || '').trim();
        }
        addLog(`Updated settings for ${device.name}.`);
        persist(); render();
      });
      $('#topology-delete-device', root).addEventListener('click', () => {
        topology.devices = topology.devices.filter(item => item.id !== device.id);
        topology.links = topology.links.filter(link => link.source !== device.id && link.target !== device.id);
        selectedId = topology.devices[0]?.id || null;
        addLog(`Deleted ${device.name} and its attached cables.`);
        persist(); render();
      });
    }
    function renderDiagnostics() {
      const errors = validateTopology(topology.devices, topology.links);
      const downLinks = topology.links.filter(link => link.status === 'down');
      const items = [
        ...errors.map(error => ({ bad: true, text: `${findDevice(error.deviceId)?.name || 'Cable'}: ${error.message}` })),
        ...downLinks.map(link => ({ bad: true, text: `Cable between ${findDevice(link.source)?.name || 'unknown'} and ${findDevice(link.target)?.name || 'unknown'} is down.` })),
      ];
      diagnostics.innerHTML = items.length
        ? `<ul class="topology-diagnostic-list">${items.map(item => `<li class="is-error">${escapeHtml(item.text)}</li>`).join('')}</ul>`
        : '<p class="topology-success">✓ No basic IP or cable configuration errors found.</p>';
    }
    function render() {
      renderBoard();
      renderConfig();
      renderDiagnostics();
      renderLog();
    }
    function addDevice(type, x, y) {
      if (!TYPES[type]) return;
      const count = topology.devices.filter(device => device.type === type).length + 1;
      const device = {
        id: uid(), type, name: `${TYPES[type].label} ${count}`,
        x: Math.max(8, Math.min(x, Math.max(8, board.clientWidth - 110))),
        y: Math.max(8, Math.min(y, Math.max(8, board.clientHeight - 85))),
        config: { ip: type === 'router' ? '192.168.1.1' : type === 'server' ? '192.168.1.30' : type === 'pc' ? '192.168.1.40' : '', prefix: 24, gateway: '' },
      };
      topology.devices.push(device);
      selectedId = device.id;
      addLog(`Added ${device.name}.`);
      persist(); render();
    }
    function connectDevices(a, b) {
      if (a === b) { addLog('A device cannot be connected to itself.'); return; }
      if (topology.links.some(link => (link.source === a && link.target === b) || (link.source === b && link.target === a))) {
        addLog('Those devices already have a cable.'); return;
      }
      topology.links.push({ id: uid(), source: a, target: b, status: 'up' });
      addLog(`Connected ${findDevice(a)?.name} to ${findDevice(b)?.name}.`);
      connectMode = false; connectFrom = null;
      $('#topology-connect', root).textContent = '＋ Connect devices';
      $('#topology-connect', root).classList.add('ghost');
      $('#topology-connect', root).setAttribute('aria-pressed', 'false');
      $('#topology-connect-hint', root).textContent = 'Choose Connect devices, then select two devices.';
      persist(); render();
    }
    function boardPoint(event) {
      const rect = board.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    root.querySelectorAll('[data-device-type]').forEach(button => {
      button.addEventListener('dragstart', event => event.dataTransfer.setData('text/device-type', button.dataset.deviceType));
      button.addEventListener('click', () => addDevice(button.dataset.deviceType, 24 + Math.random() * Math.max(20, board.clientWidth - 150), 24 + Math.random() * Math.max(20, board.clientHeight - 100)));
    });
    board.addEventListener('dragover', event => event.preventDefault());
    board.addEventListener('drop', event => {
      event.preventDefault();
      const type = event.dataTransfer.getData('text/device-type');
      const pos = boardPoint(event);
      if (type) addDevice(type, pos.x - 48, pos.y - 32);
    });
    nodes.addEventListener('pointerdown', event => {
      const node = event.target.closest('[data-device-id]');
      if (!node || connectMode) return;
      const device = findDevice(node.dataset.deviceId);
      if (!device) return;
      const pos = boardPoint(event);
      drag = { id: device.id, offsetX: pos.x - device.x, offsetY: pos.y - device.y, moved: false };
      node.setPointerCapture?.(event.pointerId);
    });
    board.addEventListener('pointermove', event => {
      if (!drag) return;
      const device = findDevice(drag.id);
      if (!device) return;
      const pos = boardPoint(event);
      if (Math.abs(pos.x - (device.x + drag.offsetX)) + Math.abs(pos.y - (device.y + drag.offsetY)) > 3) drag.moved = true;
      device.x = Math.max(0, Math.min(board.clientWidth - 100, pos.x - drag.offsetX));
      device.y = Math.max(0, Math.min(board.clientHeight - 75, pos.y - drag.offsetY));
      renderBoard();
    });
    board.addEventListener('pointerup', () => {
      if (drag) { if (drag.moved) persist(); drag = null; render(); }
    });
    nodes.addEventListener('click', event => {
      const node = event.target.closest('[data-device-id]');
      if (!node) return;
      const id = node.dataset.deviceId;
      if (connectMode) {
        if (!connectFrom) {
          connectFrom = id;
          $('#topology-connect-hint', root).textContent = `First device: ${findDevice(id)?.name}. Now select the second device.`;
          addLog(`Selected ${findDevice(id)?.name} as the first cable endpoint.`);
        } else connectDevices(connectFrom, id);
        return;
      }
      if (drag?.moved) return;
      selectedId = id; selectedLinkId = null; render();
    });
    cables.addEventListener('click', event => {
      const line = event.target.closest('[data-link-id]');
      if (!line) return;
      const link = topology.links.find(item => item.id === line.dataset.linkId);
      if (!link) return;
      selectedLinkId = link.id;
      selectedId = null;
      render();
    });
    $('#topology-delete-connection', root).addEventListener('click', () => {
      const link = topology.links.find(item => item.id === selectedLinkId);
      if (!link) return;
      const sourceName = findDevice(link.source)?.name || 'Device';
      const targetName = findDevice(link.target)?.name || 'Device';
      topology.links = topology.links.filter(item => item.id !== link.id);
      selectedLinkId = null;
      addLog(`Deleted connection between ${sourceName} and ${targetName}.`);
      persist(); render();
    });
    $('#topology-cancel-connection', root).addEventListener('click', () => {
      selectedLinkId = null;
      renderBoard();
    });
    $('#topology-connect', root).addEventListener('click', event => {
      connectMode = !connectMode; connectFrom = null;
      event.currentTarget.textContent = connectMode ? 'Cancel connect' : '＋ Connect devices';
      event.currentTarget.classList.toggle('ghost', !connectMode);
      event.currentTarget.setAttribute('aria-pressed', String(connectMode));
      $('#topology-connect-hint', root).textContent = connectMode ? 'Select the first device, then the second.' : 'Choose Connect devices, then select two devices.';
    });
    $('#topology-save', root).addEventListener('click', () => { persist(); addLog('Topology saved in this browser.'); });
    $('#topology-export', root).addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(topology, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'bitsecure-topology.json'; a.click();
      URL.revokeObjectURL(url);
      addLog('Exported topology JSON.');
    });
    $('#topology-reset', root).addEventListener('click', () => {
      if (!window.confirm('Reset the board to the example topology? Your current board will be replaced.')) return;
      topology = defaultTopology(); selectedId = topology.devices[0].id; messages = ['Example topology restored.'];
      persist(); render();
    });
    $('#topology-validate', root).addEventListener('click', () => {
      const errors = validateTopology(topology.devices, topology.links);
      addLog(errors.length ? `Validation found ${errors.length} issue(s).` : 'Validation passed: no basic IP configuration errors.');
      renderDiagnostics();
    });
    $('#topology-test', root).addEventListener('click', () => {
      const source = $('#topology-source', root).value, target = $('#topology-target', root).value;
      const result = packetRoute(topology.devices, topology.links, source, target);
      const resultBox = $('#topology-test-result', root);
      resultBox.innerHTML = `<div class="topology-test-result ${result.message.startsWith('Packet delivered') ? 'is-ok' : 'is-error'}"><strong>${result.message.startsWith('Packet delivered') ? 'Packet delivered' : 'Packet not delivered'}</strong><p>${escapeHtml(result.message)}</p></div>`;
      addLog(`Packet test ${findDevice(source)?.name || 'source'} → ${findDevice(target)?.name || 'destination'}: ${result.message}`);
      if (packetTimer) clearTimeout(packetTimer);
      if (packetNode) packetNode.remove();
      if (result.path && result.message.startsWith('Packet delivered')) {
        const first = findDevice(source), last = findDevice(target);
        if (first && last) {
          const p1 = point(first), p2 = point(last);
          packetNode = document.createElement('span');
          packetNode.className = 'topology-packet';
          packetNode.style.left = p1.x + 'px'; packetNode.style.top = p1.y + 'px';
          board.append(packetNode);
          packetNode.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${p2.x - p1.x}px,${p2.y - p1.y}px)` }], { duration: 900, easing: 'ease-in-out' });
          packetTimer = setTimeout(() => { packetNode?.remove(); packetNode = null; }, 1000);
        }
      }
    });
    $('#topology-clear-log', root).addEventListener('click', () => { messages = []; renderLog(); });
    render();
    const onResize = () => renderBoard();
    window.addEventListener('resize', onResize);
    return () => {
      if (packetTimer) clearTimeout(packetTimer);
      window.removeEventListener('resize', onResize);
    };
  },
});
