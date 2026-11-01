import { hn, panel } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { regMod } from '../registry.js';

const AGENT = 'http://127.0.0.1:8765';

regMod({
  id: 'local-network-terminal',
  group: 'adv',
  title: 'Local Network Terminal',
  desc: 'Run real ping, traceroute, DNS, interface and routing diagnostics on the computer running the local agent.',
  obj: [
    'Distinguish real OS diagnostics from simulated networking exercises.',
    'Inspect reachability, DNS resolution, local interfaces and routes.',
    'Interpret timeouts and understand when firewalls block diagnostic traffic.',
  ],
  mount(root) {
    root.innerHTML =
      panel('Connect to your local agent', `
        <p>This lab runs real commands on <b>your own computer</b>, not on the website server. Start the Python agent using the setup guide in the repository, then connect below.</p>
        <div class="controls"><button class="btn" id="lnt-connect" type="button">Check local agent</button><span id="lnt-status" role="status" aria-live="polite">Checking…</span></div>
        <details class="lnt-setup"><summary>Setup instructions</summary><ol>
          <li>Install Python 3.10 or newer.</li>
          <li>From the repository root, run <code>python -m pip install -r backend/local-network-agent/requirements.txt</code>.</li>
          <li>Run <code>python -m uvicorn main:app --app-dir backend/local-network-agent --host 127.0.0.1 --port 8765</code>.</li>
          <li>Keep that terminal open and press <b>Check local agent</b>.</li>
        </ol><p>Full instructions: <code>backend/local-network-agent/README.md</code>.</p></details>`) +
      panel('Run a diagnostic', `
        <div class="lnt-form">
          <label class="field"><span>Destination hostname or IP</span><input id="lnt-host" value="example.com" maxlength="253" autocomplete="off" spellcheck="false" placeholder="example.com or 192.168.1.1"></label>
          <label class="field"><span>Ping packets (1–10)</span><input id="lnt-count" type="number" min="1" max="10" value="4"></label>
          <label class="field"><span>Traceroute max hops (1–20)</span><input id="lnt-hops" type="number" min="1" max="20" value="12"></label>
        </div>
        <div class="btnrow lnt-actions">
          <button class="btn" data-action="ping" type="button">Ping</button>
          <button class="btn" data-action="traceroute" type="button">Traceroute / tracert</button>
          <button class="btn" data-action="dns" type="button">DNS lookup</button>
          <button class="btn ghost" data-action="interfaces" type="button">My interfaces</button>
          <button class="btn ghost" data-action="routes" type="button">My routes</button>
        </div>
        <p class="muted">These commands run on the computer where the Python agent is running. Arbitrary shell commands are not supported.</p>`) +
      panel('Command output', `<div class="lnt-output-head"><span id="lnt-command">No command run yet</span><span id="lnt-duration"></span></div><pre class="lnt-output" id="lnt-output" aria-live="polite">Check the local agent, then choose a diagnostic.</pre>`) +
      panel('What this means', '<div id="lnt-explain">Ping measures ICMP reachability when supported. Traceroute shows route hops. DNS lookup asks your system resolver for addresses. A timeout does not always mean the host is offline.</div>');

    const status = $('#lnt-status', root);
    const output = $('#lnt-output', root);
    const commandLabel = $('#lnt-command', root);
    let connected = false;

    async function request(path, options = {}) {
      const response = await fetch(AGENT + path, { ...options, signal: AbortSignal.timeout(32000) });
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(data.detail || `Agent returned HTTP ${response.status}`);
      return data;
    }
    async function checkAgent() {
      status.textContent = 'Checking…';
      connected = false;
      try {
        const data = await request('/api/health');
        connected = Boolean(data.ok);
        status.textContent = connected ? `Connected · ${data.platform || 'local computer'}` : 'Agent unavailable';
        status.dataset.state = connected ? 'ok' : 'bad';
        return connected;
      } catch {
        status.textContent = 'Not reachable — start the local agent';
        status.dataset.state = 'bad';
        output.textContent = 'Cannot reach http://127.0.0.1:8765. Start the Python agent and retry. If this page is hosted over HTTPS, the browser may restrict local-network requests.';
        return false;
      }
    }
    $('#lnt-connect', root).addEventListener('click', checkAgent);
    const explain = {
      ping: 'Real ICMP echo requests originate from this computer. Packet loss or timeouts can be caused by filtering, not just a down host.',
      traceroute: 'Traceroute discovers route hops using OS utilities. Asterisks mean a hop did not reply in time; routers often suppress these replies.',
      dns: 'DNS lookup uses this computer’s configured system resolver. VPNs and local DNS settings can make results differ from public DNS tools.',
      interfaces: 'Interface output may include private addresses and adapter names. Avoid sharing it publicly.',
      routes: 'The routing table shows how this computer chooses an interface and next hop.',
    };
    root.addEventListener('click', async e => {
      const button = e.target.closest('[data-action]');
      if (!button || !root.contains(button)) return;
      const action = button.dataset.action;
      const host = $('#lnt-host', root).value.trim();
      const count = Number($('#lnt-count', root).value);
      const hops = Number($('#lnt-hops', root).value);
      if (['ping', 'traceroute', 'dns'].includes(action) && !host) { output.textContent = 'Enter a hostname or IP address first.'; return; }
      if (action === 'ping' && (!Number.isInteger(count) || count < 1 || count > 10)) { output.textContent = 'Ping packet count must be between 1 and 10.'; return; }
      if (action === 'traceroute' && (!Number.isInteger(hops) || hops < 1 || hops > 20)) { output.textContent = 'Maximum hops must be between 1 and 20.'; return; }
      root.querySelectorAll('[data-action]').forEach(b => b.disabled = true);
      commandLabel.textContent = `Running ${action}…`;
      output.textContent = 'Waiting for the local operating system…';
      const start = performance.now();
      try {
        if (!connected && !(await checkAgent())) throw new Error('Start the local agent before running diagnostics.');
        let data;
        if (action === 'interfaces' || action === 'routes') data = await request('/api/' + action);
        else if (action === 'ping') data = await request('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, count }) });
        else if (action === 'traceroute') data = await request('/api/traceroute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, max_hops: hops }) });
        else data = await request('/api/dns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host }) });
        commandLabel.textContent = data.command || action;
        output.textContent = data.output || (data.addresses || []).join('\n') || 'No output returned.';
        $('#lnt-duration', root).textContent = `${Math.round(performance.now() - start)} ms`;
        $('#lnt-explain', root).textContent = explain[action];
        output.dataset.state = data.ok ? 'ok' : 'warn';
      } catch (error) {
        commandLabel.textContent = 'Diagnostic failed';
        output.textContent = error.name === 'TimeoutError' ? 'The request timed out. The destination may be slow or blocked.' : error.message;
        $('#lnt-duration', root).textContent = `${Math.round(performance.now() - start)} ms`;
        output.dataset.state = 'bad';
      } finally {
        root.querySelectorAll('[data-action]').forEach(b => b.disabled = false);
      }
    });
    checkAgent();
  },
});
