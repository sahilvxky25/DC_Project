/**
 * Guided learning path with prerequisite-aware recommendations.
 * Prerequisites are guidance, not hard locks: learners can always open any module.
 */
import { DC } from '../core/state.js';
import { P } from '../core/storage.js';
import { CORE, CORE_DURATIONS, GROUPS } from '../modules/registry.js';

const PREREQUISITES = {
  framing: [],
  errors: ['framing'],
  'line-coding': ['framing'],
  modulation: ['line-coding'],
  'channel-capacity': ['modulation'],
  'mux-switching': ['framing'],
  'stop-and-wait': ['framing', 'errors'],
  window: ['stop-and-wait'],
  subnets: [],
  'ip-headers': ['subnets'],
  routing: ['ip-headers'],
  'topology-builder': ['ip-headers', 'routing'],
  'wifi-simulator': ['framing', 'ip-headers'],
  'tcp-udp': ['ip-headers'],
  handshake: ['tcp-udp'],
  congestion: ['handshake'],
  sockets: ['tcp-udp'],
  'network-performance': ['tcp-udp'],
  dns: ['tcp-udp'],
  'http-tls': ['dns', 'handshake'],
  encapsulation: ['ip-headers', 'tcp-udp'],
  encryption: ['http-tls'],
  'key-exchange': ['encryption'],
  rsa: ['encryption'],
  signatures: ['rsa'],
  'packet-capture': ['ip-headers', 'tcp-udp'],
  troubleshooting: ['packet-capture', 'dns'],
  firewall: ['ip-headers', 'tcp-udp'],
  'protocol-comparison': ['tcp-udp'],
  journey: ['framing', 'ip-headers', 'tcp-udp'],
  tutorials: [],
  challenges: ['framing', 'errors', 'subnets', 'tcp-udp'],
  glossary: []
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hrefFor = key => key.startsWith('lab') ? '#/lab/' + key.slice(3) : '#/m/' + encodeURIComponent(key);
const visited = key => Boolean(P.visited[key]);

function statusFor(module, recommendedId) {
  if (visited(module.id)) return 'completed';
  const prerequisites = PREREQUISITES[module.id] || [];
  if (prerequisites.every(visited)) return module.id === recommendedId ? 'recommended' : 'ready';
  return 'upcoming';
}

function moduleCard(module, recommendedId) {
  const prerequisites = PREREQUISITES[module.id] || [];
  const missing = prerequisites.filter(id => !visited(id));
  const status = statusFor(module, recommendedId);
  const statusText = {
    completed: '✓ Completed',
    recommended: '★ Recommended next',
    ready: 'Ready to learn',
    upcoming: 'Prerequisites pending'
  }[status];
  const requirementText = prerequisites.length
    ? missing.length
      ? 'Suggested first: ' + missing.map(id => DC.mods.find(m => m.id === id)?.title || id).join(', ')
      : 'Prerequisites completed'
    : 'No prerequisites';
  return `<article class="lp-module lp-${status}">
    <div class="lp-module-top"><span class="lp-status">${statusText}</span><span class="lp-duration">⏱ ${Number(module.duration) || 10} min</span></div>
    <h4>${esc(module.title)}</h4><p>${esc(module.desc)}</p>
    <div class="lp-prereq"><b>Before this:</b> ${esc(requirementText)}</div>
    <div class="lp-card-actions"><a class="btn sm ${status === 'recommended' ? '' : 'ghost'}" href="${hrefFor(module.id)}">${status === 'completed' ? 'Review lesson' : status === 'recommended' ? 'Start recommended lesson' : 'Open lesson'} →</a>
    ${missing.length ? `<a class="lp-skip" href="${hrefFor(module.id)}" title="Open this module without completing its suggested prerequisites">Explore anyway</a>` : ''}</div>
  </article>`;
}

export function renderLearningPath(root) {
  const modules = DC.mods;
  const groups = GROUPS.map(group => ({...group, modules: modules.filter(module => module.group === group.id)}))
    .filter(group => group.modules.length);
  const completed = modules.filter(module => visited(module.id)).length;
  const total = modules.length;
  const recommended = modules.find(module => !visited(module.id) &&
    (PREREQUISITES[module.id] || []).every(visited));
  const recommendedId = recommended?.id || '';
  const pct = total ? Math.round(completed / total * 100) : 0;
  const coreDone = CORE.filter((_, index) => visited('lab' + index)).length;

  root.innerHTML = `
    <section class="learning-path-page">
      <a class="lp-back" href="#/">← Back to dashboard</a>
      <header class="lp-hero">
        <span class="lp-eyebrow">YOUR GUIDED STUDY PLAN</span>
        <h1>Learning Path</h1>
        <p>Build your networking knowledge in a sensible order. Each lesson shows what to learn first, why it matters, and what you can explore next.</p>
        <div class="lp-progress-row"><div class="lp-progress-copy"><b>${completed} of ${total} modules visited</b><span>${pct}% explored</span></div><div class="lp-progress-track" role="progressbar" aria-label="Module learning path progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div></div>
      </header>

      ${recommended ? `<section class="lp-next panel"><div class="lp-next-icon">✦</div><div class="lp-next-copy"><span class="lp-eyebrow">RECOMMENDED NEXT</span><h2>${esc(recommended.title)}</h2><p>${esc(recommended.desc)}</p><small>Based on the prerequisites you've already explored.</small></div><a class="btn" href="${hrefFor(recommended.id)}">Continue learning →</a></section>` : '<section class="lp-next panel"><div class="lp-next-copy"><span class="lp-eyebrow">PATH COMPLETE</span><h2>You have explored every registered module!</h2><p>Revisit a lesson, try a different simulation, or challenge yourself with advanced topics.</p></div></section>'}

      <section class="lp-core panel">
        <div class="lp-section-heading"><div><span class="lp-eyebrow">HANDS-ON FOUNDATION</span><h2>Start with the Core Lab</h2><p>Understand how a message becomes bytes, travels in packets, and is reconstructed.</p></div><span class="lp-count">${coreDone}/${CORE.length} visited</span></div>
        <div class="lp-core-grid">${CORE.map((item, index) => {
          const key = 'lab' + index;
          const done = visited(key);
          const prerequisite = index === 0 ? 'No prerequisites' : 'Suggested after ' + CORE[index - 1][0];
          return `<article class="lp-core-step ${done ? 'is-done' : ''}"><span class="lp-core-number">${done ? '✓' : String(index + 1).padStart(2, '0')}</span><div><b>${esc(item[0])}</b><small>${esc(item[1])} · ${CORE_DURATIONS[index]} min</small><small>${esc(prerequisite)}</small></div><a href="${hrefFor(key)}" aria-label="Open ${esc(item[0])}">${done ? 'Review' : 'Open'} →</a></article>`;
        }).join('')}</div>
      </section>

      <div class="lp-guide"><span>✓ Completed</span><span>★ Recommended next</span><span>Ready to learn</span><span>Prerequisites pending</span><span class="lp-guide-note">Prerequisites are recommendations, not restrictions. You can open any lesson at any time.</span></div>
      ${groups.map(group => {
        const groupDone = group.modules.filter(module => visited(module.id)).length;
        return `<section class="lp-group panel">
          <div class="lp-section-heading"><div><span class="lp-eyebrow">${esc(group.blurb)}</span><h2>${esc(group.name)}</h2></div><span class="lp-count">${groupDone}/${group.modules.length} visited</span></div>
          <div class="lp-module-grid">${group.modules.map(module => moduleCard(module, recommendedId)).join('')}</div>
        </section>`;
      }).join('')}
      <p class="lp-footnote">Progress uses the platform's existing visited-module records. Completing a prerequisite means you have opened that lesson; quizzes and simulator completion remain tracked separately.</p>
    </section>`;
  return () => {};
}

/**
 * Compact prerequisite-aware roadmap shown directly on the home dashboard.
 * The full path remains available from the "View full learning path" link.
 */
export function learningPathDashboardHTML() {
  const modules = DC.mods;
  const completed = modules.filter(module => visited(module.id)).length;
  const pct = modules.length ? Math.round(completed / modules.length * 100) : 0;
  const recommended = modules.find(module => !visited(module.id) &&
    (PREREQUISITES[module.id] || []).every(visited));
  const candidates = modules.filter(module => !visited(module.id)).slice(0, 4);
  const recommendedId = recommended?.id || '';
  const groupSummary = GROUPS.map(group => {
    const items = modules.filter(module => module.group === group.id);
    if (!items.length) return '';
    const done = items.filter(module => visited(module.id)).length;
    return `<div class="lp-home-group"><span>${esc(group.name)}</span><b>${done}/${items.length}</b><i><span style="width:${Math.round(done / items.length * 100)}%"></span></i></div>`;
  }).join('');
  return `
    <section class="lp-home panel" aria-labelledby="lp-home-title">
      <div class="lp-home-heading">
        <div><span class="lp-eyebrow">YOUR NEXT STEPS</span><h2 id="lp-home-title">Guided Learning Path</h2><p>See what to learn next and which topics build on one another.</p></div>
        <a class="btn ghost sm" href="#/learning-path">View full path →</a>
      </div>
      <div class="lp-home-progress"><div><b>${completed} / ${modules.length} modules explored</b><span>${pct}%</span></div><div class="lp-progress-track" role="progressbar" aria-label="Learning path progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div></div>
      ${recommended ? `<a class="lp-home-recommended" href="${hrefFor(recommended.id)}"><span>★ RECOMMENDED NEXT</span><b>${esc(recommended.title)}</b><small>${esc(recommended.desc)}</small><strong>Start lesson →</strong></a>` : '<p class="hint">You have explored all registered modules. Revisit a topic or try a challenge.</p>'}
      <div class="lp-home-roadmap"><h3>Upcoming lessons</h3><div class="lp-home-module-grid">${candidates.map(module => {
        const prerequisites = PREREQUISITES[module.id] || [];
        const missing = prerequisites.filter(id => !visited(id));
        const isRecommended = module.id === recommendedId;
        const requirement = prerequisites.length ? (missing.length ? 'Learn first: ' + missing.map(id => DC.mods.find(m => m.id === id)?.title || id).join(', ') : 'Prerequisites completed') : 'No prerequisites';
        return `<a class="lp-home-module ${isRecommended ? 'is-recommended' : ''}" href="${hrefFor(module.id)}"><span>${isRecommended ? '★ Recommended' : missing.length ? 'Prerequisites pending' : 'Ready to learn'}</span><b>${esc(module.title)}</b><small>${esc(requirement)}</small></a>`;
      }).join('')}</div></div>
      <div class="lp-home-groups"><h3>Progress by topic</h3><div class="lp-home-group-grid">${groupSummary}</div></div>
      <p class="lp-home-note">Prerequisites guide the suggested order; every lesson remains open to explore.</p>
    </section>`;
}
