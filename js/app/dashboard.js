/**
 * dashboard screen
 *
 * Renders the home screen: resume ring, learning path, last experiments, suggested experiments, the
 * filterable module grid and achievements. Everything shown is derived from saved progress (P) and the registry.
 *
 * Imports:
 *   - ../core/storage.js (saved progress (localStorage) and the shared P object): P, resetProgress
 *   - ../core/state.js (shared in-memory state): DC
 *   - ../core/utils.js (tiny DOM, math and timing helpers): $, $$, esc
 *   - ../core/ui-helpers.js (shared HTML builders: icons, tables, tabs, ladder diagrams): icon, tbl
 *   - ../modules/registry.js (learning-module registry and group definitions): CORE, GROUPS, modById
 *   - ./progress.js (achievements, flags and statistics): ACH, allKeys
 *   - ./navigation.js (sidebar, breadcrumbs and which screen is visible): refreshNav
 *
 * Exports: renderDash
 *
 * Used by: app/router.js
 */

import { DC } from '../core/state.js';
import { P, resetProgress } from '../core/storage.js';
import { icon, tbl } from '../core/ui-helpers.js';
import { $, $$, esc } from '../core/utils.js';
import { CORE, CORE_DURATIONS, GROUPS, modById } from '../modules/registry.js';
import { refreshNav } from './navigation.js';
import { ACH, allKeys } from './progress.js';
import { bookmarkedIds, toggleBookmark } from '../core/bookmarks.js';
import { getRecentlyViewed } from '../core/recently-viewed.js';

/**
 * Headline and text for the "last experiment" dashboard card.
 */
function runSummary() {
  const r = P.runs[0];
  if (!r)
    return {
      title: 'No experiments yet',
      text: 'Send a message across the link to see results here.',
    };
  return {
    title: `Last run: ${r.packets} packet${r.packets > 1 ? 's' : ''}, ${r.retries} retr${r.retries === 1 ? 'y' : 'ies'}`,
    text: `${r.loss}% loss, ${r.corrupt}% corruption, ${r.ok ? 'delivered completely' : 'incomplete delivery'}.`,
  };
}

/**
 * Suggested experiments: [title, hasBeenDone(), link]. Those not yet done are suggested on the dashboard.
 */
const EXPERIMENTS = [
  [
    'Send the same message at 0% and 50% loss',
    () => P.runs.some(r => r.loss === 0) && P.runs.some(r => r.loss >= 50),
    '#/lab/2',
  ],
  ['Deliver in reverse order and watch the receiver slots', () => P.flags.reverse, '#/lab/2'],
  ['Compare payload sizes of 1 and 8 bytes', () => P.flags.p1 && P.flags.p8, '#/lab/1'],
  ['Flip two bits so parity misses the error', () => P.flags.parityMiss, '#/m/errors'],
  [
    'Break Go-Back-N with a window as big as the sequence space',
    () => P.flags.gbnBreak,
    '#/m/window',
  ],
  ['Find the network address of 172.16.5.9/20', () => P.flags.cidr20, '#/m/subnets'],
  ['Follow a lookup twice and watch the DNS cache answer', () => P.flags.dnsCache, '#/m/dns'],
];

/**
 * Progress of each learning-path group: how many of its modules were visited.
 */
function currentPath() {
  return GROUPS.map(g => {
    const ms = DC.mods.filter(m => m.group === g.id),
      n = ms.filter(m => P.visited[m.id]).length;
    return {
      name: g.name.replace(' layer', '').replace(' and errors', ''),
      done: n === ms.length,
      n,
      total: ms.length,
      id: g.id,
    };
  });
}

/**
 * Renders the dashboard into #dash and attaches its event handlers (module filter, glossary search, reset button).
 */
export function renderDash() {
  const root = $('#dash'),
    keys = allKeys(),
    seen = keys.filter(k => P.visited[k]).length,
    pct = Math.round((seen / keys.length) * 100);
  const lastKey = P.last || 'lab0';
  const lastLabel = lastKey.startsWith('lab')
    ? CORE[+lastKey.slice(3)][0]
    : (modById(lastKey) || { title: 'Message & Encoding' }).title;
  const lastHref = lastKey.startsWith('lab') ? '#/lab/' + lastKey.slice(3) : '#/m/' + lastKey;
  const sum = runSummary(),
    path = currentPath(),
    curIdx = path.findIndex(p => !p.done);
  const exps = EXPERIMENTS.filter(e => !e[1]()).slice(0, 3);
  const ach = ACH.map(
    a =>
      `<div class="badge ${P.ach[a.id] ? '' : 'lock'}" title="${esc(a.desc)}"><i>${P.ach[a.id] ? a.icon : '?'}</i><b>${a.name}</b><small>${P.ach[a.id] ? 'Unlocked' : esc(a.desc)}</small></div>`
  ).join('');
  const cards = [
    ...CORE.map((c, i) => ({
      k: 'lab' + i,
      href: '#/lab/' + i,
      t: c[0],
      d: c[1],
      g: 'core',
      ic: 'flask',
      duration: CORE_DURATIONS[i],
    })),
    ...DC.mods.map(m => ({
      k: m.id,
      href: '#/m/' + m.id,
      t: m.title,
      d: m.desc,
      g: m.group,
      ic: GROUPS.find(g => g.id === m.group).icon,
      duration: m.duration,
    })),
  ];
  const runs = P.runs.slice(0, 5);
  const recentCards = getRecentlyViewed(5).map(item => {
    const card = cards.find(x => x.k === item.id);
    return card ? { ...card, viewedAt: item.viewedAt } : null;
  }).filter(Boolean);
  root.innerHTML = `
  <div class="hero">
    <div><div class="eyebrow">${icon('dash')} Dashboard</div><h2>${seen > 1 ? 'Welcome back' : 'Welcome to the lab'}</h2>
      <p>Follow one message from words to bytes, packets, frames and back again. Every module is a working simulator.</p></div>
    <div class="resume panel"><div class="ring" style="--p:${pct}"><b>${pct}%</b></div><div><small>Continue where you left off</small><h3>${lastLabel}</h3><p class="hint">${seen} of ${keys.length} screens visited</p><a class="btn" href="${lastHref}">${icon('play')} Resume</a></div></div>
  </div>
  <div class="panel recent-panel"><div class="recent-heading"><h3>Recently Viewed</h3><a class="btn ghost sm" href="#/recent">View all</a></div>
    <p class="hint">Pick up where you left off.</p>
    ${recentCards.length ? `<div class="recent-list">${recentCards.map(c => `<a class="recent-item" href="${c.href}"><span><b>${esc(c.t)}</b><small>${esc(c.g === 'core' ? 'Core lab' : (GROUPS.find(g => g.id === c.g)?.name || 'Learning module'))} · ⏱ ${c.duration} min</small></span><time datetime="${new Date(c.viewedAt).toISOString()}">${new Date(c.viewedAt).toLocaleString()}</time></a>`).join('')}</div>` : '<p class="hint">Modules you open will appear here.</p>'}
  </div>
  <div class="panel"><h3>Learning path</h3><p class="hint">Each layer builds on the one below it. A step is complete when you have visited every module in it.</p>
    <div class="lpath"><a class="step ${P.visited.lab3 ? 'done' : curIdx < 0 ? '' : 'cur'}" href="#/lab/0">Core lab</a>${path.map((p, i) => `<a class="step ${p.done ? 'done' : i === curIdx ? 'cur' : ''}" href="#/m/${DC.mods.find(m => m.group === p.id).id}">${p.name} <small>${p.n}/${p.total}</small></a>`).join('')}</div></div>
  <div class="cols2">
    <div class="panel"><h3>${sum.title}</h3><p class="hint">${sum.text}</p>
      ${
        runs.length
          ? tbl(
              ['When', 'Loss', 'Corrupt', 'Packets', 'Retries', 'Result'],
              runs.map(r => [
                new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                r.loss + '%',
                r.corrupt + '%',
                r.packets,
                r.retries,
                {
                  h: `<span class="pill ${r.ok ? 'live' : 'bad'}">${r.ok ? 'complete' : 'incomplete'}</span>`,
                },
              ])
            )
          : ''
      }
    </div>
    <div class="panel"><h3>Suggested experiments</h3><p class="hint">Picked from what you have not tried yet.</p>
      ${exps.length ? `<ul class="exp">${exps.map(e => `<li><a href="${e[2]}">${e[0]}</a></li>`).join('')}</ul>` : '<p class="hint">You have tried every suggested experiment. Nice work.</p>'}
      <div class="search-row">${icon('search')}<input id="dgq" type="search" placeholder="Look up a term: ACK, CRC, TTL, MSS" aria-label="Look up a glossary term"></div></div>
  </div>
  <div class="panel" id="bookmarks-panel"><div class="bookmark-heading"><h3>★ Bookmarked modules</h3><a class="btn ghost sm" href="#/bookmarks">View all</a></div><p class="hint">Your saved lessons are kept with your account and available when you sign in on another device.</p>
    <div class="bookmark-list">${bookmarkedIds().map(id => { const c = cards.find(x => x.k === id); return c ? `<div class="bookmark-item"><a href="${c.href}">${esc(c.t)}</a><button class="btn ghost sm" type="button" data-remove-bookmark="${esc(id)}" aria-label="Remove bookmark for ${esc(c.t)}">Remove</button></div>` : ''; }).join('') || '<p class="hint" id="empty-bookmarks">No bookmarks yet. Open a learning module and select ☆ Bookmark.</p>'}</div></div>
  <div class="panel"><h3>All modules</h3>
    <div class="filters" id="dflt"><input id="dsq" type="search" placeholder="Filter modules" aria-label="Filter modules"><button class="chipbtn on" data-g="all">All</button><button class="chipbtn" data-g="core">Core lab</button>${GROUPS.map(g => `<button class="chipbtn" data-g="${g.id}">${g.name.replace(' layer', '')}</button>`).join('')}</div>
    <div class="dgrid" id="dgrid">${cards.map(c => `<a class="mc" href="${c.href}" data-g="${c.g}" data-s="${esc((c.t + ' ' + c.d).toLowerCase())}"><span class="mc-top">${icon(c.ic)}${P.visited[c.k] ? `<span class="pill live">${icon('check')} visited</span>` : '<span class="pill">new</span>'}</span><h3>${c.t}</h3><p>${c.d}</p><span class="module-duration">⏱ ${c.duration} min</span></a>`).join('')}</div></div>
  <div class="panel"><h3>Achievements</h3><p class="hint">${Object.keys(P.ach).length} of ${ACH.length} unlocked. They unlock from real events in the simulators.</p><div class="badges">${ach}</div>
    <div class="foot-row"><button class="btn ghost sm" id="resetP">Reset progress</button></div></div>`;
  let gsel = 'all';
  const filt = () => {
    const q = $('#dsq').value.trim().toLowerCase();
    $$('#dgrid .mc').forEach(c => {
      c.hidden = !((gsel === 'all' || c.dataset.g === gsel) && (!q || c.dataset.s.includes(q)));
    });
  };
  $('#dsq').oninput = filt;
  $('#dflt').onclick = e => {
    const b = e.target.closest('.chipbtn');
    if (!b) return;
    gsel = b.dataset.g;
    $$('#dflt .chipbtn').forEach(x => x.classList.toggle('on', x === b));
    filt();
  };
  $('#dgq').onkeydown = e => {
    if (e.key === 'Enter') {
      DC.glossQ = e.target.value.trim();
      location.hash = '#/m/glossary';
    }
  };
  $('#bookmarks-panel').onclick = e => {
    const button = e.target.closest('[data-remove-bookmark]');
    if (!button) return;
    toggleBookmark(button.dataset.removeBookmark);
    renderDash();
  };
  $('#resetP').onclick = () => {
    if (confirm('Reset all progress, achievements and notes?')) {
      resetProgress();
      renderDash();
      refreshNav('dash');
    }
  };
}

/**
 * Dedicated page for viewing and managing every saved module.
 */
export function renderBookmarks() {
  const root = $('#dash');
  const cards = [
    ...CORE.map((c, i) => ({ k: 'lab' + i, href: '#/lab/' + i, t: c[0], d: c[1], g: 'Core lab', duration: CORE_DURATIONS[i] })),
    ...DC.mods.map(m => ({ k: m.id, href: '#/m/' + m.id, t: m.title, d: m.desc, g: GROUPS.find(x => x.id === m.group)?.name || 'Learning', duration: m.duration })),
  ];
  const renderList = () => {
    const saved = bookmarkedIds().map(id => cards.find(c => c.k === id)).filter(Boolean);
    root.innerHTML = `
      <section class="bookmarks-page">
        <a class="gback" href="#/">‹ Back to dashboard</a>
        <div class="bookmark-page-heading"><div><span class="eyebrow">YOUR LIBRARY</span><h2>★ Bookmarked Modules</h2><p class="hint">All the lessons you have saved in one place.</p></div><span class="gchip">${saved.length} saved</span></div>
        ${saved.length ? `<div class="bookmark-page-grid">${saved.map(c => `<article class="bookmark-page-card"><div><small>${esc(c.g)}</small><h3><a href="${c.href}">${esc(c.t)}</a></h3><p>${esc(c.d)}</p></div><div class="bookmark-card-actions"><a class="btn sm" href="${c.href}">Open module →</a><button class="btn ghost sm" type="button" data-remove-bookmark="${esc(c.k)}">Remove</button></div></article>`).join('')}</div>` : '<div class="panel bookmark-empty"><h3>No bookmarks yet</h3><p class="hint">Open any learning module and select ☆ Bookmark to save it here.</p><a class="btn" href="#/">Explore modules</a></div>'}
      </section>`;
    root.querySelectorAll('[data-remove-bookmark]').forEach(button => button.addEventListener('click', () => {
      toggleBookmark(button.dataset.removeBookmark);
      renderList();
    }));
  };
  renderList();
}
/**
 * Dedicated page showing the complete recent module history.
 */
export function renderRecentlyViewed() {
  const root = $('#dash');
  const cards = [
    ...CORE.map((c, i) => ({ k: 'lab' + i, href: '#/lab/' + i, t: c[0], d: c[1], g: 'Core lab', duration: CORE_DURATIONS[i] })),
    ...DC.mods.map(m => ({ k: m.id, href: '#/m/' + m.id, t: m.title, d: m.desc, g: GROUPS.find(x => x.id === m.group)?.name || 'Learning', duration: m.duration })),
  ];
  const recent = getRecentlyViewed().map(item => {
    const card = cards.find(c => c.k === item.id);
    return card ? { ...card, viewedAt: item.viewedAt } : null;
  }).filter(Boolean);
  root.innerHTML = `
    <section class="recent-page">
      <a class="gback" href="#/">‹ Back to dashboard</a>
      <div class="recent-page-heading"><div><span class="eyebrow">YOUR LEARNING HISTORY</span><h2>Recently Viewed Modules</h2><p class="hint">Your latest opened learning modules and core lab stages.</p></div><span class="gchip">${recent.length} recent</span></div>
      ${recent.length ? `<div class="recent-page-list">${recent.map(c => `<article class="recent-page-item"><div><small>${esc(c.g)}</small><h3><a href="${c.href}">${esc(c.t)}</a></h3><p>${esc(c.d)} · ⏱ ${c.duration} min</p></div><div class="recent-item-meta"><time datetime="${new Date(c.viewedAt).toISOString()}">${new Date(c.viewedAt).toLocaleString()}</time><a class="btn sm" href="${c.href}">Open module →</a></div></article>`).join('')}</div>` : '<div class="panel recent-empty"><h3>No recently viewed modules</h3><p class="hint">Open a lesson or core lab stage and it will appear here.</p><a class="btn" href="#/">Explore modules</a></div>'}
    </section>`;
}
