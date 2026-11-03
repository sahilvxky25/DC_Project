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
import { runCloudCommand } from '../../services/cloud-command-client.js';

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
    const shuffledCases = [...TROUBLE];
    for (let i = shuffledCases.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledCases[i], shuffledCases[j]] = [shuffledCases[j], shuffledCases[i]];
    }
    const selectedCases = shuffledCases.slice(0, 5);
    let cur = 0,
      ran = 0,
      hint = 0,
      done = false,
      hist = [],
      hi = 0,
      sim;
    root.innerHTML =
      panel(
        'Choose a case',
        `<div class="presets" id="tcases">${selectedCases.map((t, i) => `<button class="chipbtn${i === 0 ? ' on' : ''}" data-i="${i}">Case ${i + 1}</button>`).join('')}</div><div id="tbrief"></div>`
      ) +
      panel(
        'Terminal on the user’s laptop',
        `<div class="term" id="tterm" aria-label="Terminal output" aria-live="polite"></div>
        <div class="termin"><span>$</span><input id="tin" type="text" spellcheck="false" autocomplete="off" aria-label="Command"><button class="btn sm" id="trun">Run</button></div><div class="presets" id="tq"></div>`
      ) +
      panel(
        'Live cloud network terminal',
        `<p class="cloud-terminal-note">Run real diagnostics from BitSecure's cloud Linux runner. These results describe the cloud runner's network—not your laptop. Sign-in is required.</p>
        <div class="cloud-terminal-status" id="cloud-terminal-status" data-state="ready" role="status">Ready · authenticated cloud execution</div>
        <div class="cloud-terminal-output" id="cloud-terminal-output" aria-label="Cloud command output" aria-live="polite">BitSecure Cloud Terminal
Type help to view supported commands.
This terminal executes on a cloud server, not on your device.</div>
        <form class="cloud-terminal-form" id="cloud-terminal-form">
          <input id="cloud-terminal-input" type="text" maxlength="300" spellcheck="false" autocomplete="off" placeholder="ping 1.1.1.1" aria-label="Cloud network command" required />
          <button class="btn" id="cloud-terminal-run" type="submit">Run command</button>
        </form>
        <div class="cloud-terminal-shortcuts" id="cloud-terminal-shortcuts">
          <button class="chipbtn" type="button" data-command="ping 1.1.1.1">ping 1.1.1.1</button>
          <button class="chipbtn" type="button" data-command="traceroute example.com">traceroute example.com</button>
          <button class="chipbtn" type="button" data-command="nslookup example.com">nslookup example.com</button>
          <button class="chipbtn" type="button" data-command="dig example.com">dig example.com</button>
          <button class="chipbtn" type="button" data-command="curl https://example.com">curl https://example.com</button>
          <button class="chipbtn" type="button" data-command="ip route">ip route</button>
        </div>
        <div class="cloud-terminal-meta"><span id="cloud-terminal-duration"></span><span>Limit: 15 commands/minute</span><span>Public destinations only</span></div>`
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
      sim = netsim(selectedCases[i]);
      $$('#tcases .chipbtn', root).forEach(b => b.classList.toggle('on', +b.dataset.i === i));
      $('#tbrief', root).innerHTML =
        hn(`<b>${selectedCases[i].title}.</b> ${selectedCases[i].brief}`) +
        hn(
          `The laptop is ${selectedCases[i].cli.ip}/${selectedCases[i].cli.p}. Use the terminal to investigate.`
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
        selectedCases[i].id === 'stale' || selectedCases[i].id === 'cache' ? 'nslookup intranet.local' : 'ping 10.0.1.5',
        selectedCases[i].id === 'stale' || selectedCases[i].id === 'cache' ? 'curl http://intranet.local' : 'ip addr',
      ];
      if (selectedCases[i].id === 'stale' || selectedCases[i].id === 'cache') q.push('curl http://10.0.1.5');
      if (selectedCases[i].id === 'mtu') q.push('ping -s 1400 example.com');
      if (selectedCases[i].id === 'dhcp') q.push('ipconfig /flushdns');
      $('#tq', root).innerHTML = q.map(x => `<button class="chipbtn">${x}</button>`).join('');
      $('#tfb', root).innerHTML = '';
      $('#tdx', root).value = '';
    };
    const run = line => {
      if (!line.trim()) return;
      hist.push(line);
      hi = hist.length;
      ran++;
      if (line.trim() === 'clear') {
        term.innerHTML = '';
        return;
      }
      print(['$ ' + line], 'cmd');
      print(sim.cmd(line));
    };
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
        t = selectedCases[cur];
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
      const t = selectedCases[cur];
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
      const t = selectedCases[cur];
      $('#tfb', root).innerHTML = vd(
        'info',
        `Answer: ${FAULTS.find(f => f[0] === t.id)[1]}.`,
        t.why
      );
    };
    load(0);

    // Live commands run on the authenticated cloud service; the simulated case terminal above is unchanged.
    const cloudForm = $('#cloud-terminal-form', root);
    const cloudInput = $('#cloud-terminal-input', root);
    const cloudOutput = $('#cloud-terminal-output', root);
    const cloudStatus = $('#cloud-terminal-status', root);
    const cloudRunButton = $('#cloud-terminal-run', root);
    const cloudDuration = $('#cloud-terminal-duration', root);
    const appendCloudText = (text, className = '') => {
      const line = document.createElement('div');
      if (className) line.className = className;
      line.textContent = text;
      cloudOutput.append(line);
      cloudOutput.scrollTop = cloudOutput.scrollHeight;
    };
    const executeCloud = async command => {
      const clean = command.trim();
      if (!clean) return;
      appendCloudText(`$ ${clean}`, 'cloud-command-line');
      cloudInput.value = '';
      cloudRunButton.disabled = true;
      cloudStatus.dataset.state = 'busy';
      cloudStatus.textContent = 'Running on cloud Linux…';
      cloudDuration.textContent = '';
      try {
        if (clean.toLowerCase() === 'clear') {
          cloudOutput.textContent = '';
          cloudStatus.dataset.state = 'ready';
          cloudStatus.textContent = 'Ready';
          return;
        }
        if (clean.toLowerCase() === 'help') {
          appendCloudText('Supported: ping, traceroute, nslookup, dig, curl, ip addr, ip route, ip neigh, ss -tuna.');
          appendCloudText('No shell commands, pipes, scripts, private destinations or command chaining.');
          cloudStatus.dataset.state = 'ready';
          cloudStatus.textContent = 'Ready';
          return;
        }
        const result = await runCloudCommand(clean);
        appendCloudText(result.output || '(No output)');
        appendCloudText(result.explanation || '', 'cloud-explanation');
        cloudDuration.textContent = `${result.durationMs} ms · ${result.executionLocation}`;
        cloudStatus.dataset.state = 'ready';
        cloudStatus.textContent = result.ok ? 'Command completed' : 'Command returned an error';
      } catch (error) {
        appendCloudText(error.message || 'The command could not be completed.');
        cloudStatus.dataset.state = 'error';
        cloudStatus.textContent = 'Command failed';
      } finally {
        cloudRunButton.disabled = false;
        cloudInput.focus();
      }
    };
    cloudForm.addEventListener('submit', event => {
      event.preventDefault();
      executeCloud(cloudInput.value);
    });
    $('#cloud-terminal-shortcuts', root).addEventListener('click', event => {
      const button = event.target.closest('[data-command]');
      if (button) {
        cloudInput.value = button.dataset.command;
        executeCloud(button.dataset.command);
      }
    });
  },
});
