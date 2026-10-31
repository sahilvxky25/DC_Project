/**
 * Firewall and Access Control Lab.
 * All traffic is simulated locally for learning; no real network packets are sent.
 */
import { evaluatePacket, DEFAULT_RULES, validatePacket, validateRule, createRuleId } from '../../simulations/firewall.js';
import { regMod } from '../registry.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

regMod({
  id: 'firewall-lab',
  group: 'net',
  title: 'Firewall and Access Control Lab',
  desc: 'Build ordered firewall rules, test simulated packets, and inspect first-match decisions.',
  obj: [
    'Create and manage firewall rules for TCP, UDP, ICMP, and any protocol.',
    'Test packets and explain which rule determines the outcome.',
    'Explore how rule order and default-deny behavior affect traffic.',
    'Use optional IPv4 addresses and CIDR ranges in access rules.',
  ],
  mount(root) {
    let rules = DEFAULT_RULES.map(rule => ({ ...rule }));
    let history = [];
    let sequence = 0;
    let timers = [];
    let lastResult = null;
    let editingId = null;

    root.innerHTML = `
      <section class="firewall-lab">
        <header class="firewall-heading">
          <div><p class="eyebrow">NETWORK SECURITY · INTERACTIVE SIMULATION</p>
            <h2>Firewall &amp; Access Control</h2>
            <p>Create ordered rules, send virtual packets through them, and learn why traffic is allowed or denied.</p>
          </div>
          <div class="firewall-actions"><button class="btn ghost" type="button" data-action="reset">Reset rules</button></div>
        </header>
        <div class="firewall-notice"><strong>Simulation only:</strong> this lab does not change your device firewall or send real network traffic.</div>
        <section class="panel firewall-panel">
          <div class="firewall-section-heading"><div><h3>1. Firewall rules</h3><p class="hint">Rules are evaluated from top to bottom. The first enabled match wins.</p></div><span class="firewall-count" id="fw-count"></span></div>
          <div class="firewall-table-wrap"><table class="firewall-table">
            <thead><tr><th>Order</th><th>Rule</th><th>Protocol</th><th>Port</th><th>Source IP / CIDR</th><th>Destination IP / CIDR</th><th>Action</th><th>Controls</th></tr></thead>
            <tbody id="fw-rules"></tbody>
          </table></div>
          <details class="firewall-rule-editor" id="fw-editor">
            <summary id="fw-editor-summary">＋ Add a firewall rule</summary>
            <form id="fw-rule-form" class="firewall-form">
              <label>Rule name<input name="name" maxlength="60" required placeholder="e.g. Allow internal web"></label>
              <label>Protocol<select name="protocol"><option>TCP</option><option>UDP</option><option>ICMP</option><option>ANY</option></select></label>
              <label>Destination port<input name="port" value="443" placeholder="443 or Any"></label>
              <label>Action<select name="action"><option value="ALLOW">Allow</option><option value="DENY">Deny</option></select></label>
              <label>Source IP / CIDR <input name="sourceIp" placeholder="Any or 192.168.1.0/24"></label>
              <label>Destination IP / CIDR <input name="destinationIp" placeholder="Any or 10.0.0.10"></label>
              <div class="firewall-form-actions"><button class="btn" type="submit" id="fw-save-rule">Add rule</button><button class="btn ghost" type="button" data-action="cancel-edit">Cancel</button></div>
              <p class="firewall-form-error" id="fw-rule-error" role="alert"></p>
            </form>
          </details>
        </section>
        <div class="firewall-two-col">
          <section class="panel firewall-panel">
            <div class="firewall-section-heading"><div><h3>2. Packet tester</h3><p class="hint">Enter a virtual packet to test against the current rules.</p></div></div>
            <form id="fw-packet-form" class="firewall-form">
              <label>Protocol<select name="protocol"><option>TCP</option><option>UDP</option><option>ICMP</option></select></label>
              <label>Destination port<input name="port" value="443" placeholder="1–65535 (blank for ICMP)"></label>
              <label>Source IP (optional)<input name="sourceIp" placeholder="192.168.1.25"></label>
              <label>Destination IP (optional)<input name="destinationIp" placeholder="10.0.0.10"></label>
              <div class="firewall-form-actions"><button class="btn" type="submit">▶ Test packet</button><button class="btn ghost" type="button" data-action="example" data-protocol="TCP" data-port="22">Try SSH</button><button class="btn ghost" type="button" data-action="example" data-protocol="UDP" data-port="53">Try DNS</button></div>
              <p class="firewall-form-error" id="fw-packet-error" role="alert"></p>
            </form>
            <div id="fw-result" class="firewall-result" aria-live="polite"><p class="hint">Test a packet to see its decision and evaluation trace.</p></div>
          </section>
          <section class="panel firewall-panel">
            <div class="firewall-section-heading"><div><h3>3. Evaluation trace</h3><p class="hint">Watch each rule being checked in priority order.</p></div></div>
            <ol id="fw-trace" class="firewall-trace"><li class="hint">The evaluation steps will appear here.</li></ol>
            <div class="firewall-tip"><strong>Why order matters</strong><p>A broad rule such as TCP / Any can match before a more specific TCP / 22 rule. Reorder the rules and test again to compare outcomes.</p></div>
          </section>
        </div>
        <section class="panel firewall-panel">
          <div class="firewall-section-heading"><div><h3>4. Packet history</h3><p class="hint">Recent tests reflect the rule configuration at the time each packet was tested.</p></div><button class="btn ghost sm" type="button" data-action="clear-history">Clear history</button></div>
          <div class="firewall-table-wrap"><table class="firewall-table firewall-history-table"><thead><tr><th>Packet</th><th>Decision</th><th>Matched rule</th><th>Rules checked</th></tr></thead><tbody id="fw-history"><tr><td colspan="4" class="hint">No packets tested yet.</td></tr></tbody></table></div>
        </section>
      </section>`;

    const $ = (selector, scope = root) => scope.querySelector(selector);
    const $$ = (selector, scope = root) => [...scope.querySelectorAll(selector)];
    const rulesBody = $('#fw-rules');
    const historyBody = $('#fw-history');

    function renderRules(highlightId = null) {
      $('#fw-count').textContent = `${rules.length} rule${rules.length === 1 ? '' : 's'}`;
      rulesBody.innerHTML = rules.map((rule, index) => `
        <tr class="${highlightId === rule.id ? 'is-current' : ''} ${rule.enabled ? '' : 'is-disabled'}">
          <td><span class="firewall-priority">${index + 1}</span></td>
          <td><strong>${esc(rule.name)}</strong><small>${rule.enabled ? 'Enabled' : 'Disabled'}</small></td>
          <td>${esc(rule.protocol)}</td><td>${esc(rule.port)}</td>
          <td>${esc(rule.sourceIp || 'Any')}</td><td>${esc(rule.destinationIp || 'Any')}</td>
          <td><span class="firewall-badge ${rule.action === 'ALLOW' ? 'is-allow' : 'is-deny'}">${rule.action}</span></td>
          <td><div class="firewall-row-actions">
            <button class="btn ghost sm" data-action="up" data-id="${esc(rule.id)}" aria-label="Move ${esc(rule.name)} up" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn ghost sm" data-action="down" data-id="${esc(rule.id)}" aria-label="Move ${esc(rule.name)} down" ${index === rules.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn ghost sm" data-action="toggle" data-id="${esc(rule.id)}">${rule.enabled ? 'Disable' : 'Enable'}</button>
            <button class="btn ghost sm" data-action="edit" data-id="${esc(rule.id)}">Edit</button>
            <button class="btn ghost sm" data-action="delete" data-id="${esc(rule.id)}">Delete</button>
          </div></td>
        </tr>`).join('');
    }

    function renderHistory() {
      historyBody.innerHTML = history.length ? history.map(item => `
        <tr><td>${esc(item.packet.protocol)} / ${esc(item.packet.port || 'no port')}${item.packet.destinationIp ? ` → ${esc(item.packet.destinationIp)}` : ''}</td>
        <td><span class="firewall-badge ${item.result.action === 'ALLOW' ? 'is-allow' : 'is-deny'}">${item.result.action}</span></td>
        <td>${esc(item.result.ruleName)}</td><td>${item.result.trace.length}</td></tr>`).join('') : '<tr><td colspan="4" class="hint">No packets tested yet.</td></tr>';
    }

    function renderTrace(result, packet) {
      const trace = $('#fw-trace');
      trace.innerHTML = result.trace.map((step, index) => {
        const rule = rules.find(item => item.id === step.ruleId);
        return `<li class="firewall-trace-step ${step.status === 'matched' ? 'is-matched' : ''} ${step.status === 'skipped' ? 'is-skipped' : ''}" data-trace-index="${index}">
          <span class="firewall-trace-number">${index + 1}</span><div><strong>${esc(rule?.name || 'Rule')}</strong><p>${esc(step.explanation)}</p></div><span class="firewall-trace-status">${step.status === 'matched' ? 'MATCH' : step.status === 'skipped' ? 'SKIPPED' : 'NO MATCH'}</span>
        </li>`;
      }).join('');
      if (!result.ruleId) trace.insertAdjacentHTML('beforeend', '<li class="firewall-trace-step is-default"><span class="firewall-trace-number">✓</span><div><strong>Default deny</strong><p>No enabled rule matched the packet.</p></div><span class="firewall-trace-status">DENY</span></li>');
      const matchedRule = rules.find(item => item.id === result.ruleId);
      renderRules(result.ruleId);
      // Sequential highlight is intentionally brief and cleaned up when leaving this module.
      $$('.firewall-trace-step', trace).forEach((step, index) => {
        const timer = setTimeout(() => step.classList.add('has-animated'), 100 + index * 170);
        timers.push(timer);
      });
      $('#fw-result').innerHTML = `
        <div class="firewall-decision ${result.action === 'ALLOW' ? 'is-allow' : 'is-deny'}"><span class="firewall-decision-icon">${result.action === 'ALLOW' ? '✓' : '✕'}</span><div><small>FIREWALL DECISION</small><strong>${result.action === 'ALLOW' ? 'PACKET ALLOWED' : 'PACKET DENIED'}</strong></div></div>
        <dl class="firewall-result-details"><div><dt>Packet</dt><dd>${esc(packet.protocol)} / ${esc(packet.port || 'no port')}${packet.destinationIp ? ` → ${esc(packet.destinationIp)}` : ''}</dd></div><div><dt>Matching rule</dt><dd>${esc(matchedRule?.name || 'Default policy')}</dd></div><div><dt>Rules evaluated</dt><dd>${result.trace.length}</dd></div></dl>
        <p class="firewall-reason">${esc(result.reason)}</p>`;
    }

    function testPacket(packet) {
      const error = validatePacket(packet);
      $('#fw-packet-error').textContent = error;
      if (error) return;
      timers.forEach(clearTimeout);
      timers = [];
      const result = evaluatePacket(packet, rules);
      lastResult = result;
      renderTrace(result, packet);
      history.unshift({ packet: { ...packet }, result, id: ++sequence });
      history = history.slice(0, 30);
      renderHistory();
    }

    function resetEditor() {
      editingId = null;
      $('#fw-rule-form').reset();
      $('#fw-rule-form [name="port"]').value = '443';
      $('#fw-editor-summary').textContent = '＋ Add a firewall rule';
      $('#fw-save-rule').textContent = 'Add rule';
      $('#fw-rule-error').textContent = '';
      $('#fw-editor').open = false;
    }

    $('#fw-rule-form').addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      data.name = data.name.trim();
      data.port = data.port.trim() || 'ANY';
      data.protocol = data.protocol.toUpperCase();
      data.action = data.action.toUpperCase();
      data.sourceIp = data.sourceIp.trim();
      data.destinationIp = data.destinationIp.trim();
      const error = validateRule(data);
      const validCidr = value => !value || value.toUpperCase() === 'ANY' || /^\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?$/.test(value);
      if (error || !validCidr(data.sourceIp) || !validCidr(data.destinationIp)) {
        $('#fw-rule-error').textContent = error || 'IP criteria must be Any, an IPv4 address, or an IPv4 CIDR range.';
        return;
      }
      for (const key of ['sourceIp', 'destinationIp']) {
        if (data[key] && data[key].toUpperCase() !== 'ANY') {
          const [ip, prefix] = data[key].split('/');
          const octets = ip.split('.');
          if (octets.length !== 4 || octets.some(part => Number(part) > 255 || part === '') || (prefix !== undefined && Number(prefix) > 32)) {
            $('#fw-rule-error').textContent = 'Enter a valid IPv4 address or CIDR range (prefix 0–32).';
            return;
          }
        }
      }
      const rule = { ...data, id: editingId || createRuleId(), enabled: editingId ? (rules.find(item => item.id === editingId)?.enabled ?? true) : true };
      if (editingId) rules = rules.map(item => item.id === editingId ? rule : item);
      else {
        // Insert before the final catch-all default rule where possible.
        const catchAllIndex = rules.findIndex(item => item.name.toLowerCase() === 'default deny');
        rules.splice(catchAllIndex < 0 ? rules.length : catchAllIndex, 0, rule);
      }
      renderRules();
      resetEditor();
    });

    $('#fw-packet-form').addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      testPacket({ protocol: data.protocol, port: data.protocol === 'ICMP' ? '' : data.port.trim(), sourceIp: data.sourceIp.trim(), destinationIp: data.destinationIp.trim() });
    });

    root.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button || !root.contains(button)) return;
      const { action, id } = button.dataset;
      const index = rules.findIndex(rule => rule.id === id);
      if (action === 'reset') {
        rules = DEFAULT_RULES.map(rule => ({ ...rule }));
        history = [];
        lastResult = null;
        $('#fw-result').innerHTML = '<p class="hint">Rules reset. Test a packet to see the new decision.</p>';
        $('#fw-trace').innerHTML = '<li class="hint">The evaluation steps will appear here.</li>';
        renderRules(); renderHistory(); resetEditor();
      } else if (action === 'clear-history') {
        history = []; renderHistory();
      } else if (action === 'cancel-edit') resetEditor();
      else if (action === 'example') {
        const form = $('#fw-packet-form');
        form.elements.protocol.value = button.dataset.protocol;
        form.elements.port.value = button.dataset.port;
        form.elements.sourceIp.value = '';
        form.elements.destinationIp.value = '';
        testPacket({ protocol: button.dataset.protocol, port: button.dataset.port, sourceIp: '', destinationIp: '' });
      } else if (index >= 0 && action === 'up' && index > 0) {
        [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]]; renderRules();
      } else if (index >= 0 && action === 'down' && index < rules.length - 1) {
        [rules[index + 1], rules[index]] = [rules[index], rules[index + 1]]; renderRules();
      } else if (index >= 0 && action === 'toggle') {
        rules[index].enabled = !rules[index].enabled; renderRules();
      } else if (index >= 0 && action === 'delete') {
        rules.splice(index, 1); renderRules();
      } else if (index >= 0 && action === 'edit') {
        const rule = rules[index];
        editingId = rule.id;
        const form = $('#fw-rule-form');
        for (const key of ['name', 'protocol', 'port', 'action', 'sourceIp', 'destinationIp']) form.elements[key].value = rule[key] ?? '';
        $('#fw-editor-summary').textContent = `✎ Edit rule: ${rule.name}`;
        $('#fw-save-rule').textContent = 'Save changes';
        $('#fw-rule-error').textContent = '';
        $('#fw-editor').open = true;
        $('#fw-editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    renderRules();
    return () => { timers.forEach(clearTimeout); };
  },
});
