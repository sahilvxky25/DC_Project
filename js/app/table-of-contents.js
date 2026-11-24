/**
 * Website-wide table of contents.
 *
 * Builds the topic directory from the same CORE, GROUPS and DC.mods data used by
 * the learning navigation, so new registered modules appear here automatically.
 */
import { DC } from '../core/state.js';
import { CORE, GROUPS } from '../modules/registry.js';
import { $, esc } from '../core/utils.js';

const SITE_PAGES = [
  ['Dashboard', 'Home screen and learning overview', '#/'],
  ['Bookmarked Modules', 'Your saved learning modules', '#/bookmarks'],
  ['Recently Viewed', 'Return to modules you opened recently', '#/recent'],
  ['Profile', 'Your account, learning progress and achievements', '#/profile'],
  ['Daily Challenge', 'Open the daily learning challenge', '#/daily'],
  ['About Us', 'Learn about the BitSecure project', '#/about'],
  ['Support Us', 'Ways to support the project', '#/support'],
  ['Privacy Policy', 'How the website handles data and preferences', '#/privacy'],
];

const renderSitePages = () => `<details class="toc-category" open data-toc-category>
  <summary><span class="toc-category-title"><span class="toc-category-icon">⌂</span><span><strong>Website pages</strong><small>Useful destinations beyond the learning modules</small></span></span><span class="toc-category-count">${SITE_PAGES.length} pages</span></summary>
  <div class="toc-topic-list">${SITE_PAGES.map(([title, desc, href]) => `<a class="toc-topic" href="${href}"><span class="toc-topic-copy"><strong>${esc(title)}</strong><small>${esc(desc)}</small></span><span class="toc-topic-arrow" aria-hidden="true">↗</span></a>`).join('')}</div>
</details>`;

const moduleLink = m => `<a class="toc-topic" href="#/m/${encodeURIComponent(m.id)}">
  <span class="toc-topic-copy"><strong>${esc(m.title)}</strong><small>${esc(m.desc || 'Open this interactive learning module')}</small></span>
  <span class="toc-topic-arrow" aria-hidden="true">↗</span>
</a>`;

function renderCore() {
  return `<details class="toc-category" open data-toc-category>
    <summary><span class="toc-category-title"><span class="toc-category-icon">⌁</span><span><strong>Core lab</strong><small>Follow a message from input to reconstruction</small></span></span><span class="toc-category-count">4 steps</span></summary>
    <div class="toc-topic-list">${CORE.map((item, i) => `<a class="toc-topic" href="#/lab/${i}"><span class="toc-topic-copy"><strong>${i + 1}. ${esc(item[0])}</strong><small>${esc(item[1])}</small></span><span class="toc-topic-arrow" aria-hidden="true">↗</span></a>`).join('')}</div>
  </details>`;
}

function renderGroup(group, modules) {
  if (!modules.length) return '';
  return `<details class="toc-category" open data-toc-category>
    <summary><span class="toc-category-title"><span class="toc-category-icon">${esc(group.name.slice(0, 1))}</span><span><strong>${esc(group.name)}</strong><small>${esc(group.blurb || 'Explore related topics')}</small></span></span><span class="toc-category-count">${modules.length} ${modules.length === 1 ? 'topic' : 'topics'}</span></summary>
    <div class="toc-topic-list">${modules.map(moduleLink).join('')}</div>
  </details>`;
}

export function renderTableOfContents(root) {
  const total = DC.mods.length + CORE.length + SITE_PAGES.length;
  root.innerHTML = `
    <section class="toc-page">
      <header class="toc-hero">
        <span class="info-kicker">EXPLORE BITSECURE</span>
        <h1>Table of <span>Contents.</span></h1>
        <p class="info-lead">One place to find every learning module, simulator, and core-lab stage across the website.</p>
        <div class="toc-summary"><strong>${total}</strong><span>learning destinations</span><span class="toc-summary-divider" aria-hidden="true"></span><span>${GROUPS.length + 2} sections</span></div>
      </header>
      <section class="toc-directory" aria-label="Website topics">
        <label class="toc-search-wrap" for="tocSearch"><span aria-hidden="true">⌕</span><input id="tocSearch" type="search" placeholder="Find a topic, protocol, or simulator…" autocomplete="off" /><kbd>/</kbd></label>
        <div class="toc-toolbar"><p id="tocResultCount" aria-live="polite">Showing all ${total} destinations</p><div class="toc-actions"><button type="button" class="toc-action" id="tocExpand">Expand all</button><button type="button" class="toc-action" id="tocCollapse">Collapse all</button><button type="button" class="toc-action" id="tocSort">A–Z view</button></div></div>
        <div class="toc-groups" id="tocGroups">${renderSitePages()}${renderCore()}${GROUPS.map(g => renderGroup(g, DC.mods.filter(m => m.group === g.id))).join('')}</div>
        <p class="toc-empty" id="tocEmpty" hidden>No topics match your search. Try another keyword.</p>
      </section>
    </section>`;

  const search = $('#tocSearch', root);
  const groups = $('#tocGroups', root);
  const count = $('#tocResultCount', root);
  const empty = $('#tocEmpty', root);
  const expand = $('#tocExpand', root);
  const collapse = $('#tocCollapse', root);
  const sort = $('#tocSort', root);
  let alphabetical = false;

  const update = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    $$('.toc-category', groups).forEach(category => {
      let categoryVisible = 0;
      $$('.toc-topic', category).forEach(topic => {
        const matches = !query || topic.textContent.toLocaleLowerCase().includes(query);
        topic.hidden = !matches;
        if (matches) categoryVisible++;
      });
      category.hidden = categoryVisible === 0;
      if (query && categoryVisible) category.open = true;
      visible += categoryVisible;
    });
    count.textContent = query ? `Showing ${visible} of ${total} destinations` : `Showing all ${total} destinations`;
    empty.hidden = visible !== 0;
  };

  search.addEventListener('input', update);
  expand.addEventListener('click', () => $$('.toc-category:not([hidden])', groups).forEach(item => { item.open = true; }));
  collapse.addEventListener('click', () => $$('.toc-category:not([hidden])', groups).forEach(item => { item.open = false; }));
  sort.addEventListener('click', () => {
    alphabetical = !alphabetical;
    if (alphabetical) {
      const topics = $$('.toc-topic', groups).filter(topic => !topic.hidden).sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()));
      groups.innerHTML = `<details class="toc-category" open data-toc-category><summary><span class="toc-category-title"><span class="toc-category-icon">A–Z</span><span><strong>All topics</strong><small>Alphabetical list across the entire website</small></span></span><span class="toc-category-count">${topics.length} topics</span></summary><div class="toc-topic-list"></div></details>`;
      $('.toc-topic-list', groups).append(...topics);
      sort.textContent = 'Group view';
      expand.disabled = true;
      collapse.disabled = true;
    } else {
      groups.innerHTML = `${renderSitePages()}${renderCore()}${GROUPS.map(g => renderGroup(g, DC.mods.filter(m => m.group === g.id))).join('')}`;
      sort.textContent = 'A–Z view';
      expand.disabled = false;
      collapse.disabled = false;
      update();
    }
  });

  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') { search.value = ''; update(); search.blur(); }
  });
  const shortcut = event => {
    if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
      event.preventDefault();
      search.focus();
    }
  };
  document.addEventListener('keydown', shortcut);
  return () => document.removeEventListener('keydown', shortcut);
}
