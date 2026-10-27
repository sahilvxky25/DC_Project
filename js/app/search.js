/**
 * Global learning-module search.
 * Searches the modules already registered by the application and opens a result
 * through the existing hash router; no backend or additional service is needed.
 */
import { DC } from '../core/state.js';
import { GROUPS } from '../modules/registry.js';

const SEARCH_TERMS = {
  handshake: ['tcp handshake', 'three-way handshake', 'syn', 'syn-ack', 'ack', 'connection establishment'],
  subnets: ['subnet mask', 'subnetting', 'ipv4', 'cidr', 'network address', 'broadcast address', 'usable hosts', 'vlsm'],
  dns: ['dns cache', 'dns resolution', 'domain lookup', 'ttl', 'cached records'],
  http: ['http put', 'put method', 'http methods', 'request body', 'headers', 'update resource', 'https', 'tls'],
  capture: ['packet capture', 'packets', 'capture analyzer', 'protocol inspection', 'wireshark'],
  tcpudp: ['tcp', 'udp', 'ports', 'transport protocol'],
};

const normalize = value => String(value || '').toLocaleLowerCase().trim();

export function initModuleSearch() {
  const input = document.querySelector('#moduleSearch');
  const panel = document.querySelector('#moduleSearchResults');
  if (!input || !panel) return;

  let activeIndex = -1;
  let currentResults = [];

  const close = ({ clear = false } = {}) => {
    panel.hidden = true;
    panel.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
    currentResults = [];
    if (clear) input.value = '';
  };

  const render = query => {
    panel.replaceChildren();
    activeIndex = -1;
    const needle = normalize(query);
    if (!needle) {
      panel.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      currentResults = [];
      return;
    }

    currentResults = DC.mods
      .map(mod => {
        const group = GROUPS.find(item => item.id === mod.group);
        const keywords = SEARCH_TERMS[mod.id] || [];
        const fields = [mod.title, mod.desc, group?.name, group?.blurb, ...keywords];
        const haystack = normalize(fields.join(' '));
        const title = normalize(mod.title);
        const score = title === needle ? 100 : title.startsWith(needle) ? 50 : title.includes(needle) ? 30 : haystack.includes(needle) ? 10 : 0;
        return { mod, group, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.mod.title.localeCompare(b.mod.title))
      .slice(0, 8);

    if (!currentResults.length) {
      const empty = document.createElement('p');
      empty.className = 'module-search-empty';
      empty.textContent = 'No matching learning modules. Try “TCP”, “subnet mask”, or “DNS”.';
      panel.append(empty);
    } else {
      currentResults.forEach(({ mod, group }, index) => {
        const link = document.createElement('a');
        link.className = 'module-search-result';
        link.href = '#/m/' + encodeURIComponent(mod.id);
        link.setAttribute('role', 'option');
        link.dataset.index = String(index);

        const text = document.createElement('span');
        text.className = 'module-search-result-copy';
        const title = document.createElement('strong');
        title.textContent = mod.title;
        const description = document.createElement('span');
        description.textContent = mod.desc || 'Open this learning module';
        text.append(title, description);

        const meta = document.createElement('span');
        meta.className = 'module-search-result-group';
        meta.textContent = group?.name || 'Learning module';
        link.append(text, meta);
        link.addEventListener('click', () => close());
        panel.append(link);
      });
    }

    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const setActive = index => {
    const items = [...panel.querySelectorAll('.module-search-result')];
    if (!items.length) return;
    activeIndex = (index + items.length) % items.length;
    items.forEach((item, i) => {
      item.classList.toggle('is-active', i === activeIndex);
      item.setAttribute('aria-selected', String(i === activeIndex));
    });
    items[activeIndex].scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => {
    if (input.value.trim()) render(input.value);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' && !panel.hidden) {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp' && !panel.hidden) {
      event.preventDefault();
      setActive(activeIndex < 0 ? currentResults.length - 1 : activeIndex - 1);
    } else if (event.key === 'Enter' && !panel.hidden) {
      const items = panel.querySelectorAll('.module-search-result');
      if (items.length) {
        event.preventDefault();
        items[activeIndex < 0 ? 0 : activeIndex].click();
      }
    } else if (event.key === 'Escape') {
      close();
      input.blur();
    }
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.module-search')) close();
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
}
