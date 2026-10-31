/**
 * Network Performance Analyzer — educational estimate of a stop-and-wait transfer.
 * No packets are sent and no live internet measurements are performed.
 */
import { simulatePerformance } from '../../simulations/network-performance.js';
import { regMod } from '../registry.js';

regMod({
  id: 'network-performance',
  group: 'trn',
  title: 'Network Performance Analyzer',
  desc: 'Explore how bandwidth, RTT, packet loss and retransmissions affect estimated transfer time and throughput.',
  obj: [
    'Estimate serialization delay from packet size and bandwidth.',
    'Explain how RTT and packet loss affect a stop-and-wait transfer.',
    'Compare delivery ratio, retransmissions and effective throughput.',
  ],
  mount(root) {
    root.innerHTML = `
      <section class="npa-wrap">
        <div class="verdict warn npa-disclaimer" role="note">
          <b>Simulation only</b>
          Results are estimates calculated from your selected settings. This tool does not measure your actual internet connection, send network traffic, or perform a real speed test.
        </div>
        <div class="panel">
          <h3>Configure a scenario</h3>
          <p class="hint">Choose a preset or change the values. The model sends one packet at a time and waits for an acknowledgement round trip before moving on.</p>
          <div class="presets" aria-label="Scenario presets">
            <button type="button" class="chipbtn" data-preset="excellent">Excellent link</button>
            <button type="button" class="chipbtn" data-preset="home">Typical home</button>
            <button type="button" class="chipbtn" data-preset="high-latency">High latency</button>
            <button type="button" class="chipbtn" data-preset="congested">Congested</button>
            <button type="button" class="chipbtn" data-preset="unreliable">Unreliable</button>
            <button type="button" class="chipbtn" data-preset="custom">Custom</button>
          </div>
          <form id="npa-form" novalidate>
            <div class="controls npa-controls">
              <div class="field"><label for="npa-bandwidth">Bandwidth (Mbps)</label><input id="npa-bandwidth" name="bandwidthMbps" type="number" min="1" max="1000" step="1" value="100" required><small>1–1,000 Mbps</small></div>
              <div class="field"><label for="npa-rtt">Round-trip time (ms)</label><input id="npa-rtt" name="rttMs" type="number" min="1" max="1000" step="1" value="30" required><small>Includes modeled acknowledgement/loss-detection wait.</small></div>
              <div class="field"><label for="npa-loss">Packet loss (%)</label><input id="npa-loss" name="lossPercent" type="number" min="0" max="50" step="0.1" value="1" required><small>Probability each transmission attempt is lost.</small></div>
              <div class="field"><label for="npa-size">Packet size (bytes)</label><input id="npa-size" name="packetSizeBytes" type="number" min="64" max="1500" step="1" value="1000" required><small>64–1,500 bytes, modeled as payload.</small></div>
              <div class="field"><label for="npa-count">Original packets</label><input id="npa-count" name="packetCount" type="number" min="1" max="10000" step="1" value="100" required><small>1–10,000 packets</small></div>
              <div class="field"><label for="npa-retry">Retransmission behavior</label><select id="npa-retry" name="retryMode"><option value="none">No retransmissions</option><option value="limited" selected>Limited retries</option><option value="unlimited">Retry until delivered (safety-capped)</option></select></div>
              <div class="field" id="npa-retry-field"><label for="npa-max-retries">Maximum retries per packet</label><input id="npa-max-retries" name="maxRetries" type="number" min="0" max="20" step="1" value="3" required><small>0–20 retries; unlimited mode is also capped at 20.</small></div>
              <div class="field"><label for="npa-seed">Repeatable random seed</label><input id="npa-seed" name="seed" type="number" min="1" max="2147483647" step="1" value="42" required><small>Same settings and seed produce the same result.</small></div>
            </div>
            <div id="npa-errors" class="npa-errors" role="alert" aria-live="polite" hidden></div>
            <div class="btnrow"><button class="btn" type="submit">Run simulation</button><button class="btn ghost" type="button" id="npa-reset">Reset defaults</button></div>
          </form>
        </div>
        <div id="npa-output" aria-live="polite">
          <div class="panel"><h3>Simulated Performance Results</h3><p class="hint">Run the simulation to calculate estimates for this scenario.</p></div>
        </div>
      </section>`;

    const $ = selector => root.querySelector(selector);
    const form = $('#npa-form');
    const output = $('#npa-output');
    const errorBox = $('#npa-errors');
    const defaults = { bandwidthMbps: 100, rttMs: 30, lossPercent: 1, packetSizeBytes: 1000, packetCount: 100, retryMode: 'limited', maxRetries: 3, seed: 42 };
    const presets = {
      excellent: { bandwidthMbps: 500, rttMs: 5, lossPercent: 0, packetSizeBytes: 1200, packetCount: 100, retryMode: 'limited', maxRetries: 3, seed: 42 },
      home: { bandwidthMbps: 100, rttMs: 25, lossPercent: 1, packetSizeBytes: 1000, packetCount: 100, retryMode: 'limited', maxRetries: 3, seed: 42 },
      'high-latency': { bandwidthMbps: 50, rttMs: 180, lossPercent: 0.5, packetSizeBytes: 1000, packetCount: 100, retryMode: 'limited', maxRetries: 3, seed: 42 },
      congested: { bandwidthMbps: 20, rttMs: 90, lossPercent: 8, packetSizeBytes: 1200, packetCount: 100, retryMode: 'limited', maxRetries: 4, seed: 42 },
      unreliable: { bandwidthMbps: 10, rttMs: 120, lossPercent: 25, packetSizeBytes: 800, packetCount: 50, retryMode: 'limited', maxRetries: 5, seed: 42 },
      custom: null,
    };
    const readForm = () => Object.fromEntries(new FormData(form).entries());
    const setValues = values => {
      Object.entries(values).forEach(([key, value]) => {
        const field = form.elements.namedItem(key);
        if (field) field.value = String(value);
      });
      errorBox.hidden = true;
      root.querySelectorAll('[data-preset]').forEach(button => button.classList.toggle('on', button.dataset.preset !== 'custom' && presets[button.dataset.preset] && Object.entries(presets[button.dataset.preset]).every(([key, value]) => String(form.elements.namedItem(key)?.value) === String(value)));
    };
    const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
    const fmt = (value, digits = 2) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : '—';
    const time = ms => ms >= 1000 ? fmt(ms / 1000, 3) + ' s' : fmt(ms, 3) + ' ms';

    function render(result) {
      if (result.errors.length) {
        errorBox.innerHTML = '<strong>Check your settings:</strong><ul>' + result.errors.map(message => '<li>' + esc(message) + '</li>').join('') + '</ul>';
        errorBox.hidden = false;
        output.innerHTML = '<div class="panel"><h3>Simulated Performance Results</h3><p class="hint">Correct the settings and run the simulation again.</p></div>';
        return;
      }
      errorBox.hidden = true;
      const r = result.results;
      const stats = [
        ['Estimated transfer time', time(r.totalTimeMs), 'Includes serialization and modeled RTT for every attempt.'],
        ['Effective throughput', fmt(r.throughputMbps, 4) + ' Mbps', 'Successfully delivered payload divided by total simulated time.'],
        ['Packet delivery ratio', fmt(r.deliveryRatio, 2) + '%', r.deliveredPackets + ' delivered out of ' + r.attemptedOriginalPackets + ' simulated original packets.'],
        ['Retransmissions', fmt(r.retransmissions, 0), 'Extra attempts after an initially lost attempt.'],
        ['Delivered packets', fmt(r.deliveredPackets, 0), 'Each original packet is counted once, even if retransmitted.'],
        ['Undelivered packets', fmt(r.undeliveredPackets, 0), 'Packets that exhausted the retry budget or were stopped.'],
        ['Lost attempts', fmt(r.lostAttempts, 0), 'Includes losses that triggered retransmission and final losses.'],
        ['Link utilization (estimate)', fmt(r.linkUtilization, 2) + '%', 'Ideal original-payload serialization time divided by modeled elapsed time.'],
      ];
      output.innerHTML = `
        <div class="panel">
          <h3>Simulated Performance Results</h3>
          ${r.complete ? '<p class="verdict ok">Simulation completed for all original packets.</p>' : '<p class="verdict warn">The simulation stopped before all original packets were processed. Interpret ratios using the processed packet count.</p>'}
          ${r.stoppedBySafetyLimit ? '<p class="verdict warn">A safety limit stopped the simulation to keep it responsive.</p>' : ''}
          <div class="stats npa-stats">${stats.map(([label, value, hint]) => `<div class="stat"><b>${esc(value)}</b><span>${esc(label)}</span><small>${esc(hint)}</small></div>`).join('')}</div>
          <div class="npa-flow" role="img" aria-label="Conceptual stop-and-wait packet path from sender through a simulated link to receiver">
            <div class="npa-node"><strong>Sender</strong><span>Original packet</span></div><div class="npa-link"><span>Simulated link</span><i aria-hidden="true">→</i><small>loss chance per attempt: ${fmt(result.config.lossPercent, 1)}%</small></div><div class="npa-node"><strong>Receiver</strong><span>ACK round trip</span></div>
          </div>
          <p class="hint">Model: stop-and-wait. Packet serialization is ${time(r.serializationMs)} per attempt. Each attempt adds one configured RTT, including the modeled wait for an ACK or loss detection. ACK size, processing delay, protocol headers, parallel streams, congestion control and propagation distance are not modeled.</p>
        </div>
        <div class="panel">
          <h3>Packet-by-packet outcome</h3>
          <p class="hint">Showing up to 100 packet outcomes so large simulations remain easy to inspect.</p>
          <div class="tscroll"><table class="tb"><thead><tr><th>Original packet</th><th>Attempts</th><th>Outcome</th></tr></thead><tbody>${r.packetResults.slice(0, 100).map(row => `<tr><td>${row.packet}</td><td>${row.attempts}</td><td><span class="${row.status === 'Undelivered' || row.status === 'Stopped by safety limit' ? 'npa-bad' : 'npa-good'}">${esc(row.status)}</span></td></tr>`).join('')}</tbody></table></div>
          ${r.packetResults.length > 100 ? '<p class="hint">Showing the first 100 of ' + r.packetResults.length + ' processed packets.</p>' : ''}
        </div>`;
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      render(simulatePerformance(readForm()));
    });
    form.addEventListener('input', () => {
      root.querySelectorAll('[data-preset]').forEach(button => button.classList.toggle('on', button.dataset.preset !== 'custom' && presets[button.dataset.preset] && Object.entries(presets[button.dataset.preset]).every(([key, value]) => String(form.elements.namedItem(key)?.value) === String(value))));
    });
    form.elements.retryMode.addEventListener('change', () => {
      $('#npa-retry-field').hidden = form.elements.retryMode.value !== 'limited';
    });
    root.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
      const preset = presets[button.dataset.preset];
      if (preset) setValues(preset);
      else {
        root.querySelectorAll('[data-preset]').forEach(item => item.classList.toggle('on', item === button));
      }
      $('#npa-retry-field').hidden = form.elements.retryMode.value !== 'limited';
      render(simulatePerformance(readForm()));
    }));
    $('#npa-reset').addEventListener('click', () => {
      setValues(defaults);
      $('#npa-retry-field').hidden = false;
      render(simulatePerformance(readForm()));
    });
    setValues(defaults);
    render(simulatePerformance(readForm()));
  },
});
