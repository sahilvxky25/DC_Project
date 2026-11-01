/**
 * learning module: Troubleshooting lab
 *
 * A simulated terminal (ping, traceroute, nslookup, curl, ip) for diagnosing five faults.
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

/* Register "Troubleshooting lab". The router calls mount(root) when the learner opens #/m/trouble and calls the returned function (if any) when they leave. */
regMod({
  id: 'trouble',
  group: 'adv',
  title: 'Troubleshooting lab',
  desc: 'A user reports a problem. Use ping, traceroute, nslookup and curl in a simulated terminal to find the fault.',
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
        'Terminal on the user’s laptop',
        `<div class="controls" style="margin-bottom:12px">
          <div class="btnrow" role="group" aria-label="Terminal mode">
            <button class="btn sm" id="tmode-sim" type="button" aria-pressed="true">Simulation</button>
            <button class="btn ghost sm" id="tmode-real" type="button" aria-pressed="false">Real diagnostics</button>
          </div>
          <span id="tagent-status" class="hint" role="status">Simulation mode · no real network commands run.</span>
        </div>
        <p class="hint" id="tmode-note">Simulation uses the built-in fault scenario. Choose Real diagnostics to run allowlisted commands on your own computer with the optional local agent.</p>
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
      const q = [
        'ip route',
        'cat /etc/resolv.conf',
        'ping 93.184.216.34',
        'ping example.com',
        'traceroute example.com',
        'nslookup example.com',
        'curl https://example.com',
        'curl http://example.com',
        i === 4 ? 'nslookup intranet.local' : 'ping 10.0.1.5',
        i === 4 ? 'curl http://intranet.local' : 'ip addr',
      ];
      if (i === 4) q.push('curl http://10.0.1.5');
      $('#tq', root).innerHTML = q.map(x => `<button class="chipbtn">${x}</button>`).join('');
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
        ? 'Real mode sends supported commands to the local agent on this computer. Outputs are real; they may differ from the selected practice case. No simulated fallback is used.'
        : 'Simulation uses the built-in fault scenario. It does not send packets or run commands on your computer.';
      const status = $('#tagent-status', root);
      if (!isReal) {
        status.textContent = 'Simulation mode · no real network commands run.';
        return;
      }
      status.textContent = 'Checking local agent…';
      try {
        const response = await fetch('http://127.0.0.1:8765/health', { method: 'GET', cache: 'no-store' });
        if (!response.ok) throw new Error('Agent returned HTTP ' + response.status);
        const data = await response.json();
        if (!data.ok) throw new Error('Agent did not report ready.');
        status.textContent = 'Local agent connected · ' + data.platform + ' · real commands enabled.';
      } catch (error) {
        status.textContent = 'Local agent not connected. Start agent/local_agent.py and check its allowed origin.';
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
      status.textContent = 'Running real diagnostic…';
      try {
        const response = await fetch('http://127.0.0.1:8765/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: line }),
          cache: 'no-store'
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          print([data.error || 'The local agent rejected this command.'], 'err');
        } else {
          print(Array.isArray(data.output) ? data.output : [String(data.output || '')]);
          if (Number.isFinite(data.durationMs)) print(['Completed in ' + data.durationMs + ' ms' + (data.exitCode !== undefined ? ' · exit code ' + data.exitCode : '')], 'hint');
        }
        status.textContent = 'Local agent connected · real diagnostics mode.';
      } catch (error) {
        print(['Could not reach the local command agent at 127.0.0.1:8765.', 'Start python agent/local_agent.py and allow this exact website origin in the agent configuration.', 'No simulated output was substituted.'], 'err');
        status.textContent = 'Local agent unavailable · real command was not run.';
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
