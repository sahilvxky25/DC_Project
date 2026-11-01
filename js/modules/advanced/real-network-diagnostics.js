/**
 * Authenticated real network diagnostics.
 *
 * This module calls a separately hosted API. It never runs shell commands in the browser;
 * the backend runs a small allowlist of fixed operations from its own network location.
 */
import { panel } from '../../core/ui-helpers.js';
import { $ } from '../../core/utils.js';
import { regMod } from '../registry.js';
import { auth } from '../../auth/firebase-client.js';
import { getIdToken } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';

const API_BASE = () => String(window.BITSECURE_DIAGNOSTICS_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const OPERATIONS = {
  ping: { label: 'Ping', placeholder: 'example.com', help: 'Send a small number of real ICMP echo requests.' },
  traceroute: { label: 'Traceroute', placeholder: 'example.com', help: 'Trace the route from the backend server to the target.' },
  dns: { label: 'DNS lookup', placeholder: 'example.com', help: 'Resolve public DNS records using the backend host resolver.' },
  http: { label: 'HTTP HEAD', placeholder: 'https://example.com', help: 'Request response headers from a public HTTP(S) URL.' },
};

regMod({
  id: 'real-network-diagnostics',
  group: 'adv',
  title: 'Real Network Diagnostics',
  desc: 'Run authenticated ping, traceroute, DNS, and HTTP checks from a real backend server.',
  obj: [
    'Distinguish real network diagnostics from simulated terminal output.',
    'Compare DNS, reachability, route, and HTTP response results.',
    'Understand that results come from the backend server, not this device.',
  ],
  mount(root) {
    root.innerHTML =
      panel('Real network diagnostics', `
        <div class="verdict info"><b>Real operations, remote location.</b> These checks run on the configured backend server, not on your laptop or phone. Only the supported operations below are accepted; arbitrary shell commands are never executed.</div>
        <div class="controls" style="margin-top:1rem">
          <div class="field"><label for="rnd-operation">Diagnostic</label>
            <select id="rnd-operation">
              <option value="ping">Ping</option><option value="traceroute">Traceroute</option>
              <option value="dns">DNS lookup</option><option value="http">HTTP HEAD</option>
            </select>
          </div>
          <div class="field" style="grid-column:span 2"><label for="rnd-target">Target host or URL</label>
            <input id="rnd-target" value="example.com" placeholder="example.com" autocomplete="url" spellcheck="false" />
          </div>
        </div>
        <p class="hint" id="rnd-help">Send a small number of real ICMP echo requests.</p>
        <div class="btnrow"><button class="btn" id="rnd-run" type="button">Run diagnostic</button><button class="btn ghost" id="rnd-clear" type="button">Clear output</button></div>
        <p class="hint" id="rnd-status" role="status" aria-live="polite">Ready. Sign in and configure the backend URL to begin.</p>
      `) +
      panel('Command output', `
        <div class="term" id="rnd-output" aria-label="Real diagnostic output" aria-live="polite">No diagnostic has run yet.</div>
        <div class="btnrow"><button class="btn ghost sm" id="rnd-copy" type="button">Copy output</button></div>
      `) +
      panel('Before you run it', `
        <ul>
          <li>Targets must resolve to public IP addresses; private, loopback, and link-local destinations are blocked.</li>
          <li>Traceroute or ICMP may be unavailable on some cloud hosts.</li>
          <li>HTTP checks use HEAD and do not download page content.</li>
          <li>Do not enter private addresses, credentials, or sensitive internal hostnames.</li>
        </ul>
      `);
    const operation = $('#rnd-operation', root);
    const target = $('#rnd-target', root);
    const help = $('#rnd-help', root);
    const runButton = $('#rnd-run', root);
    const output = $('#rnd-output', root);
    const status = $('#rnd-status', root);
    const setOutput = text => { output.textContent = text; };
    operation.addEventListener('change', () => {
      help.textContent = OPERATIONS[operation.value].help;
      target.placeholder = OPERATIONS[operation.value].placeholder;
      if (operation.value === 'http' && target.value === 'example.com') target.value = 'https://example.com';
      if (operation.value !== 'http' && target.value.startsWith('http')) target.value = 'example.com';
    });
    runButton.addEventListener('click', async () => {
      const kind = operation.value;
      const value = target.value.trim();
      if (!value) { status.textContent = 'Enter a target first.'; target.focus(); return; }
      if (!auth.currentUser) { status.textContent = 'Please sign in again before running diagnostics.'; return; }
      runButton.disabled = true;
      status.textContent = 'Running a real diagnostic on the backend server…';
      setOutput('$ ' + OPERATIONS[kind].label + ' ' + value + '\n');
      try {
        const token = await getIdToken(auth.currentUser);
        const response = await fetch(API_BASE() + '/api/diagnostics/' + kind, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(kind === 'http' ? { url: value } : { target: value }),
          signal: AbortSignal.timeout(20000),
        });
        let data = {};
        try { data = await response.json(); } catch {}
        if (!response.ok) throw new Error(data.detail || 'Request failed (' + response.status + ').');
        setOutput(data.output || data.result || 'Completed with no output.');
        status.textContent = 'Completed on backend: ' + (data.executed_on || 'remote server') + '.';
      } catch (error) {
        const message = error?.name === 'TimeoutError'
          ? 'The request timed out. Try again or check the backend host.'
          : (error?.message || 'Unable to reach the diagnostics backend.');
        setOutput('Diagnostic unavailable\n' + message + '\n\nCheck the backend deployment, API URL, Firebase Admin credentials, and allowed origins.');
        status.textContent = 'Diagnostic failed.';
      } finally {
        runButton.disabled = false;
      }
    });
    $('#rnd-clear', root).addEventListener('click', () => { setOutput('Output cleared.'); status.textContent = 'Ready.'; });
    $('#rnd-copy', root).addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(output.textContent); status.textContent = 'Output copied.'; }
      catch { status.textContent = 'Clipboard access was denied by this browser.'; }
    });
  },
});
