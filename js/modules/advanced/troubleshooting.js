/**
 * learning module: Troubleshooting lab
 *
 * A terminal with simulated practice plus optional authenticated cloud diagnostics.
 *
 * This file registers one learning module with regMod(). Its mount(root) function builds the screen inside
 * `root` and attaches event handlers; the function mount() returns (if any) is its cleanup, called by the router
 * when the learner leaves, so timers and listeners do not outlive the screen. The protocol logic lives in
 * ../../simulations/ and ../../core/; this file is the user interface for it.
 *
 * Imports:
 *   - ../../core/ui-helpers.js (shared HTML builders: icons, tables, tabs, ladder diagrams): hn, panel, sel, vd
 *   - ../../core/utils.js (tiny DOM, math and timing helpers): $, $$, esc
 *   - ../../simulations/troubleshooting.js (fault scenarios and a simulated network for the troubleshooting lab): FAULTS, TROUBLE, netsim
 *   - ../registry.js (learning-module registry and group definitions): regMod
 *   - ../../app/progress.js (achievements, flags and statistics): flag
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { hn, panel, sel, vd } from '../../core/ui-helpers.js';
import { $, $$, esc } from '../../core/utils.js';
import { FAULTS, netsim, TROUBLE } from '../../simulations/troubleshooting.js';
import { regMod } from '../registry.js';
import { flag } from '../../app/progress.js';
import { auth } from '../../auth/firebase-client.js';

// Set window.BITSECURE_DIAGNOSTICS_URL to the deployed backend origin (no trailing slash).
const CLOUD_API_BASE = String(window.BITSECURE_DIAGNOSTICS_URL || '').replace(/\/$/, '');

/* Register "Troubleshooting lab". The router calls mount(root) when the learner opens #/m/trouble and calls the returned function (if any) when they leave. */
regMod({
  id: 'trouble',
  group: 'adv',
  title: 'Troubleshooting lab',
  desc: 'Investigate network faults with simulations or authenticated real diagnostics executed by a cloud server.',
  obj: [
    'Form a hypothesis from the symptoms.',
    'Test it with the right tool instead of guessing.',
    'Separate name resolution, routing and port filtering problems.',
  ],
  mount(root) {
    let cur = 0,
      mode = 'simulation',
      ran = 0,
      hint = 0,
      done = false,
      hist = [],
      hi = 0,
      sim;
    root.innerHTML =
      panel(
        'Choose a case',
        `<div class="presets" id="tcases">${TROUBLE.map((t, i) => `<button class="chipbtn${i === 0 ? ' on' : ''}" data-i="${i}">Case ${i + 1}</button>`).join('')}</div><div id="tbrief"></div>`
      ) +
      panel(
        'Troubleshooting terminal',
        `<div class="controls" style="margin-bottom:12px">
          <div class="btnrow" role="group" aria-label="Terminal mode">
            <button class="btn sm" id="tmode-sim" type="button" aria-pressed="true">Simulation</button>
            <button class="btn ghost sm" id="tmode-real" type="button" aria-pressed="false">Cloud diagnostics</button>
          </div>
          <span id="tagent-status" class="hint" role="status">Simulation mode · no real network commands run.</span>
        </div>
        <p class="hint" id="tmode-note">Simulation uses the built-in fault scenario. Choose Cloud diagnostics to run supported commands from the remote diagnostics server.</p>
        <div class="term" id="tterm" aria-label="Terminal output" aria-live="polite"></div>
        <div class="termin"><span>$</span><input id="tin" type="text" spellcheck="false" autocomplete="off" aria-label="Command"><button class="btn sm" id="trun">Run</button></div><div class="presets" id="tq"></div>`
      ) +
      panel(
        'Your diagnosis',
        `<div class="controls"><div class="field grow"><label for="tdx">What is the fault?</label>${sel('tdx', [['', 'Choose…'], ...FAULTS], '')}</div><div class="btnrow"><button class="btn" id="tsub">Submit</button><button class="btn ghost" id="thint">Hint</button><button class="btn ghost" id="tshow">Reveal answer</button></div></div><div id="tfb"></div>`
      );
    const term = $('#tterm', root);
    const print = (lines, cls = '') => {
      term.insertAdjacentHTML(
        'beforeend',
        lines.map(l => `<div class="${cls}">${esc(l) || '&nbsp;'}</div>`).join('')
      );
      term.scrollTop = term.scrollHeight;
    };
    const renderShortcuts = () => {
      const q = mode === 'real'
        ? ['ping example.com', 'traceroute example.com', 'nslookup example.com']
        : [
            'ip route',
            'cat /etc/resolv.conf',
            'ping 93.184.216.34',
            'ping example.com',
            'traceroute example.com',
            'nslookup example.com',
            'curl https://example.com',
            'curl http://example.com',
            cur === 4 ? 'nslookup intranet.local' : 'ping 10.0.1.5',
            cur === 4 ? 'curl http://intranet.local' : 'ip addr',
          ];
      if (mode !== 'real' && cur === 4) q.push('curl http://10.0.1.5');
      $('#tq', root).innerHTML = q.map(x => `<button class="chipbtn">${x}</button>`).join('');
    };
    const load = i => {
      cur = i;
      ran = 0;
      hint = 0;
      done = false;
      sim = netsim(TROUBLE[i]);
      $$('#tcases .chipbtn', root).forEach(b => b.classList.toggle('on', +b.dataset.i === i));
      $('#tbrief', root).innerHTML =
        hn(`<b>${TROUBLE[i].title}.</b> ${TROUBLE[i].brief}`) +
        hn(
          `The laptop is ${TROUBLE[i].cli.ip}/${TROUBLE[i].cli.p}. Use the terminal to investigate.`
        );
      term.innerHTML = '';
      print(['Type a command, or press one of the shortcuts below. Type help for the list.']);
      renderShortcuts();
      $('#tfb', root).innerHTML = '';
      $('#tdx', root).value = '';
    };
    const setMode = async nextMode => {
      mode = nextMode;
      const isReal = mode === 'real';
      $('#tmode-sim', root).classList.toggle('ghost', isReal);
      $('#tmode-real', root).classList.toggle('ghost', !isReal);
      $('#tmode-sim', root).setAttribute('aria-pressed', String(!isReal));
      $('#tmode-real', root).setAttribute('aria-pressed', String(isReal));
      $('#tmode-note', root).textContent = isReal
        ? 'Cloud mode sends supported diagnostics to the remote server. Results describe the server's network, not your device. No simulated fallback is used.'
        : 'Simulation uses the built-in fault scenario. It does not send packets or run commands on your computer.';
      renderShortcuts();
      const status = $('#tagent-status', root);
      if (!isReal) {
        status.textContent = 'Simulation mode · no real network commands run.';
        return;
      }
      if (!CLOUD_API_BASE) {
        status.textContent = 'Cloud API URL not configured. Deploy the backend and set window.BITSECURE_DIAGNOSTICS_URL.';
        return;
      }
      status.textContent = 'Checking cloud diagnostics service…';
      try {
        const response = await fetch(CLOUD_API_BASE + '/health', { method: 'GET', cache: 'no-store' });
        if (!response.ok) throw new Error('Cloud API returned HTTP ' + response.status);
        const data = await response.json();
        if (!data.ok) throw new Error('Cloud service did not report ready.');
        status.textContent = 'Cloud service connected · commands run remotely.';
      } catch (error) {
        status.textContent = 'Cloud diagnostics service unavailable. Check the configured API URL and deployment.';
      }
    };
    const run = async line => {
      if (!line.trim()) return;
      hist.push(line);
      hi = hist.length;
      ran++;
      if (line.trim() === 'clear') {
        term.innerHTML = '';
        return;
      }
      print(['$ ' + line], 'cmd');
      if (mode !== 'real') {
        print(sim.cmd(line));
        return;
      }
      const status = $('#tagent-status', root);
      if (!CLOUD_API_BASE) {
        print(['Cloud diagnostics API is not configured.', 'The site owner must deploy the backend and set window.BITSECURE_DIAGNOSTICS_URL.', 'No simulated output was substituted.'], 'err');
        status.textContent = 'Cloud API URL not configured.';
        return;
      }
      const match = line.trim().match(/^(ping|traceroute|tracert|nslookup)\s+([A-Za-z0-9.-]{1,253})$/i);
      if (!match) {
        print(['Cloud mode supports only: ping <public-hostname>, traceroute <public-hostname>, nslookup <hostname>.', 'Use Simulation mode for ip addr, ip route, curl, and educational fault scenarios.'], 'err');
        status.textContent = 'Unsupported cloud command.';
        return;
      }
      const command = match[1].toLowerCase() === 'tracert' ? 'traceroute' : match[1].toLowerCase();
      const user = auth.currentUser;
      if (!user) {
        print(['Sign in to run cloud diagnostics.'], 'err');
        status.textContent = 'Authentication required.';
        return;
      }
      status.textContent = 'Running cloud diagnostic…';
      try {
        const token = await user.getIdToken();
        const response = await fetch(CLOUD_API_BASE + '/api/diagnostics/run', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ command, target: match[2] }), cache: 'no-store'
        });
        const data = await response.json();
        if (!response.ok) {
          print([data.detail || 'The cloud service rejected this command.'], 'err');
          status.textContent = 'Cloud diagnostic failed · see error output.';
          return;
        }
        print(Array.isArray(data.output) ? data.output : [String(data.output || '')]);
        print([data.note || 'Executed from the cloud server.'], 'hint');
        if (Number.isFinite(data.durationMs)) print(['Completed in ' + data.durationMs + ' ms' + (data.exitCode !== undefined ? ' · exit code ' + data.exitCode : '')], 'hint');
        status.textContent = data.ok ? 'Cloud diagnostic completed.' : 'Command completed with a non-zero exit code.';
      } catch (error) {
        print(['Could not reach the cloud diagnostics API.', 'Check the backend deployment, configured API URL, and CORS allowed origins.', 'No simulated output was substituted.'], 'err');
        status.textContent = 'Cloud diagnostics unavailable · real command was not run.';
      }
    };
    $('#tmode-sim', root).onclick = () => setMode('simulation');
    $('#tmode-real', root).onclick = () => setMode('real');
    $('#tcases', root).onclick = e => {
      const b = e.target.closest('[data-i]');
      if (b) load(+b.dataset.i);
    };
    $('#tq', root).onclick = e => {
      const b = e.target.closest('.chipbtn');
      if (b) run(b.textContent);
    };
    $('#trun', root).onclick = () => {
      run($('#tin', root).value);
      $('#tin', root).value = '';
    };
    $('#tin', root).onkeydown = e => {
      if (e.key === 'Enter') {
        run(e.target.value);
        e.target.value = '';
      } else if (e.key === 'ArrowUp' && hist.length) {
        hi = Math.max(0, hi - 1);
        e.target.value = hist[hi];
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        hi = Math.min(hist.length, hi + 1);
        e.target.value = hist[hi] || '';
        e.preventDefault();
      }
    };
    $('#tsub', root).onclick = () => {
      const v = $('#tdx', root).value,
        t = TROUBLE[cur];
      if (!v) {
        $('#tfb', root).innerHTML = vd('warn', 'Choose a diagnosis first.');
        return;
      }
      if (v === t.id) {
        if (!done) {
          done = true;
          flag('diagnosed');
        }
        $('#tfb', root).innerHTML = vd(
          'ok',
          'Correct.',
          `${t.why} You ran ${ran} command${ran === 1 ? '' : 's'} and used ${hint} hint${hint === 1 ? '' : 's'}.`
        );
      } else
        $('#tfb', root).innerHTML = vd(
          'bad',
          'Not that one.',
          'Look again at the evidence. Which tool distinguishes this fault from the others?'
        );
    };
    $('#thint', root).onclick = () => {
      const t = TROUBLE[cur];
      hint = Math.min(3, hint + 1);
      $('#tfb', root).innerHTML = vd(
        'info',
        `Hint ${hint} of 3.`,
        t.hints
          .slice(0, hint)
          .map((h, i) => `${i + 1}. ${h}`)
          .join('<br>')
      );
    };
    $('#tshow', root).onclick = () => {
      const t = TROUBLE[cur];
      $('#tfb', root).innerHTML = vd(
        'info',
        `Answer: ${FAULTS.find(f => f[0] === t.id)[1]}.`,
        t.why
      );
    };
    load(0);
  },
});
