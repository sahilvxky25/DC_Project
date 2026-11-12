/**
 * learning kit: layered explanations and the animated "show the working" player
 *
 * Two reusable pieces that any module can drop into its screen without touching the shared layout or CSS files:
 *
 *   layers(host, {...})       three explanation depths in the existing tab component:
 *                             "In plain words" (with an everyday analogy), "How it works", "Under the hood".
 *                             The depth the learner picks is remembered for the next module (sessionStorage).
 *
 *   showWorking(host, {...})  a button that reveals a step-through player (Back, Play, Next, Restart, speed).
 *                             Each step has a title, a caption and a stage (HTML or SVG) that animates in.
 *
 * Styling: the classes below are prefixed lk- and use the existing theme variables (--line, --accent, --c0 ...), so light
 * and dark themes both work. The stylesheet is injected once, the same way the encryption lab injects its own.
 *
 * Security note: step titles, captions and stages are HTML strings written by the module author. Anything a learner
 * typed must go through esc() before it is placed in them.
 *
 * Imports:
 *   - ./ui-helpers.js: on, tabset, tbl
 *   - ./utils.js: esc, REDUCE
 *
 * Exports: analogyCard, kitStyles, layers, mapTable, showWorking, swatch
 *
 * Used by: the physical-layer and key-exchange modules
 */

import { on, tabset, tbl } from './ui-helpers.js';
import { esc, REDUCE } from './utils.js';

const CSS = `
.lk-analogy{display:flex;gap:14px;align-items:flex-start;padding:12px 14px;margin:8px 0 12px;border:1px solid var(--line);border-left:4px solid var(--c1);border-radius:var(--radius-sm,9px);background:var(--surface2)}
.lk-analogy .lk-emoji{font-size:30px;line-height:1}
.lk-analogy h4{margin:0 0 4px}
.lk-analogy p{margin:0}
.lk-layer p,.lk-layer ul,.lk-layer ol{margin:.5em 0}
.lk-layer li{margin:.25em 0}
.lk-layer code,.lk-cap code,.lk-stage code{font-family:var(--mono)}
.lk-formula{display:block;font-family:var(--mono);padding:8px 12px;margin:8px 0;border:1px dashed var(--line2);border-radius:var(--radius-sm,9px);background:var(--surface2);overflow-x:auto}
.lk-work{margin-top:4px}
.lk-player{margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:var(--radius-sm,9px);background:var(--surface)}
.lk-player:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.lk-ctrl{align-items:center;flex-wrap:wrap;gap:8px}
.lk-ctrl select{width:auto}
.lk-bar{height:6px;margin:10px 0;background:var(--line);border-radius:9px;overflow:hidden}
.lk-bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .35s}
.lk-cap h4{margin:4px 0}
.lk-cap p{margin:.3em 0 .6em}
.lk-stage{min-height:110px;overflow-x:auto}
.lk-stage svg,.lk-svg{display:block;max-width:100%;height:auto}
.lk-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:10px 0}
.lk-row>.lk-label{min-width:92px;font-weight:600}
.lk-swatch{display:inline-block;width:52px;height:52px;border-radius:12px;border:2px solid var(--line2);vertical-align:middle}
.lk-sw{display:inline-flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:var(--muted)}
.lk-sw b{font-family:var(--mono);color:var(--text);font-size:13px}
.lk-op{font-size:20px;color:var(--muted)}
.lk-chip{display:inline-block;min-width:30px;padding:4px 8px;margin:2px;text-align:center;border-radius:8px;border:1px solid var(--line2);background:var(--surface2);font-family:var(--mono);font-size:13px}
.lk-chip.empty{opacity:.45;border-style:dashed}
.lk-chip.c0{border-color:var(--c0);color:var(--c0)}.lk-chip.c1{border-color:var(--c1);color:var(--c1)}
.lk-chip.c2{border-color:var(--c2);color:var(--c2)}.lk-chip.c3{border-color:var(--c3);color:var(--c3)}
.lk-chip.c4{border-color:var(--c4);color:var(--c4)}
.lk-meter{height:16px;border-radius:9px;background:var(--line);overflow:hidden;margin:4px 0}
.lk-meter i{display:block;height:100%;width:var(--w,0%);border-radius:9px;background:var(--c0);animation:lk-grow .9s ease both;animation-delay:var(--d,0s)}
.lk-meter.c1 i{background:var(--c1)}.lk-meter.c2 i{background:var(--c2)}.lk-meter.c3 i{background:var(--c3)}
.lk-wave{fill:none;stroke:var(--c0);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}
.lk-wave.hot{stroke:var(--c1);stroke-width:3.2}
.lk-grid{stroke:var(--line2);stroke-dasharray:3 4;stroke-width:1}
.lk-axis{stroke:var(--line2);stroke-width:1}
.lk-lbl{fill:var(--text);font:600 12px var(--mono);text-anchor:middle}
.lk-lbl.dim{opacity:.35}
.lk-sub{fill:var(--muted);font:11px var(--sans)}
.lk-pt{fill:none;stroke:var(--line2);stroke-width:1.5}
.lk-ptl{fill:var(--muted);font:9px var(--mono);text-anchor:middle}
.lk-ok{fill:var(--ok)}.lk-bad{fill:var(--bad)}.lk-rxdot{fill:var(--c0)}
.lk-link{stroke:var(--warn);stroke-width:1;opacity:.7}
.lk-slot{fill:var(--surface2);stroke:var(--line2)}
.lk-tok{stroke:var(--ok);stroke-width:2.5}
.lk-tbad{stroke:var(--bad);stroke-width:2.5}
.lk-flat{fill:none;stroke:var(--c0);stroke-width:2.4}
.lk-bx{fill:var(--c0);opacity:.85;stroke:var(--surface);stroke-width:1}
.lk-bx.c1{fill:var(--c1)}.lk-bx.c2{fill:var(--c2)}.lk-bx.c3{fill:var(--c3)}.lk-bx.c4{fill:var(--c4)}
.lk-in{animation:lk-fade .45s ease both;animation-delay:var(--d,0s)}
.lk-draw{stroke-dasharray:1;stroke-dashoffset:1;animation:lk-draw .9s ease forwards;animation-delay:var(--d,0s)}
.lk-pop{animation:lk-pop .4s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--d,0s);transform-box:fill-box;transform-origin:center}
.lk-slide{animation:lk-slide .55s ease both;animation-delay:var(--d,0s)}
.lk-pulse{animation:lk-pulse 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes lk-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes lk-draw{to{stroke-dashoffset:0}}
@keyframes lk-pop{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
@keyframes lk-slide{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:none}}
@keyframes lk-grow{from{width:0}}
@keyframes lk-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@media (prefers-reduced-motion:reduce){
.lk-in,.lk-draw,.lk-pop,.lk-slide,.lk-pulse,.lk-meter i{animation:none}
.lk-draw{stroke-dashoffset:0}
.lk-bar i{transition:none}
}
`;

/**
 * Injects the kit stylesheet once. Safe to call from every mount().
 */
export function kitStyles() {
  if (typeof document === 'undefined' || document.getElementById('lk-style')) return;
  const s = document.createElement('style');
  s.id = 'lk-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * An everyday-analogy card.
 *
 * @param {{emoji:string, title:string, text:string}} a - text may contain HTML written by the module author.
 */
export const analogyCard = a =>
  `<div class="lk-analogy"><span class="lk-emoji" aria-hidden="true">${a.emoji}</span><div><h4>${esc(a.title)}</h4><p>${a.text}</p></div></div>`;

/**
 * Table that maps each part of an analogy to the real thing.
 *
 * @param {Array<[string,string]>} rows - [in the analogy, in the real protocol].
 */
export const mapTable = (rows, head = ['In the analogy', 'In the real thing']) => tbl(head, rows);

/**
 * A labelled colour swatch (used by the paint analogy).
 */
export const swatch = (css, label, sub = '', cls = '') =>
  `<span class="lk-sw ${cls}"><span class="lk-swatch" style="background:${css}" role="img" aria-label="${esc(label)}"></span><b>${esc(label)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>`;

const DEPTH_KEY = 'lk.depth';
const recall = () => {
  try {
    return Math.min(2, Math.max(0, Number(sessionStorage.getItem(DEPTH_KEY)) || 0));
  } catch (e) {
    return 0;
  }
};
const remember = n => {
  try {
    sessionStorage.setItem(DEPTH_KEY, String(n));
  } catch (e) {
    /* storage can be blocked; the choice is only a convenience */
  }
};

/**
 * Builds the three-depth explanation inside host.
 *
 * @param {Element} host
 * @param {Object} o
 * @param {{emoji:string,title:string,text:string}} o.analogy - the everyday picture, shown first.
 * @param {string} o.plain - "In plain words" HTML: no jargon, short.
 * @param {string} o.how - "How it works" HTML: the mechanism, with the real terms.
 * @param {string} o.deep - "Under the hood" HTML: formulas, standards, limits, where the analogy breaks.
 * @param {Array<[string,string]>} [o.map] - analogy-to-reality pairs, shown under "How it works".
 * @returns {Function} cleanup
 */
export function layers(host, o) {
  kitStyles();
  const defs = [
    ['🌱 In plain words', () => analogyCard(o.analogy) + `<div class="lk-layer">${o.plain}</div>`],
    [
      '⚙️ How it works',
      () =>
        `<div class="lk-layer">${o.how}</div>` +
        (o.map ? `<h4>The analogy, piece by piece</h4>${mapTable(o.map)}` : ''),
    ],
    ['🔬 Under the hood', () => `<div class="lk-layer">${o.deep}</div>`],
  ];
  const t = tabset(
    host,
    defs.map(([label, build], i) => ({
      label,
      render(p) {
        remember(i);
        p.innerHTML = build();
      },
    })),
    recall()
  );
  return () => t.destroy();
}

/**
 * Adds the "Show the working" button and its animated step player to host.
 *
 * @param {Element} host
 * @param {Object} [o]
 * @param {string} [o.label] - button text.
 * @param {Array<{title:string, text?:string, html?:string|((i:number)=>string), ms?:number}>} [o.steps]
 * @param {() => void} [o.onOpen] - called each time the player is opened (e.g. to record a progress flag).
 * @returns {{setSteps:(steps:Array, opt?:{keep?:boolean})=>void, goto:(n:number)=>void, open:()=>void, destroy:()=>void}}
 */
export function showWorking(host, o = {}) {
  kitStyles();
  let steps = o.steps || [],
    i = 0,
    timer = 0,
    speed = 1,
    playing = false,
    isOpen = false,
    dead = false;
  const label = o.label || 'Show the working';
  host.innerHTML = `<div class="lk-work"><button type="button" class="btn ghost sm" data-lk="toggle" aria-expanded="false">▶ ${esc(label)}</button> <span class="hint">Animated, one step at a time. Use ← → to step.</span>
    <div class="lk-player" tabindex="0" hidden>
      <div class="btnrow lk-ctrl"><button type="button" class="btn ghost sm" data-lk="prev">← Back</button><button type="button" class="btn sm" data-lk="play">▶ Play</button><button type="button" class="btn ghost sm" data-lk="next">Next →</button><button type="button" class="btn ghost sm" data-lk="reset">↺ Restart</button>
      <select data-lk="speed" aria-label="Playback speed"><option value="0.5">Slow</option><option value="1" selected>Normal</option><option value="2">Fast</option></select><span class="hint" data-lk="count"></span></div>
      <div class="lk-bar" aria-hidden="true"><i></i></div>
      <div class="lk-cap" aria-live="polite"></div>
      <div class="lk-stage"></div>
    </div></div>`;
  const q = s => host.querySelector(s);
  const player = q('.lk-player');

  const syncPlayBtn = () => {
    q('[data-lk=play]').textContent = playing ? '⏸ Pause' : '▶ Play';
  };
  const stop = () => {
    clearTimeout(timer);
    playing = false;
    syncPlayBtn();
  };
  const delay = () => (REDUCE ? 350 : Math.max(500, (steps[i] && steps[i].ms ? steps[i].ms : 2400) / speed));
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (dead) return;
      if (i < steps.length - 1) {
        i++;
        render();
        schedule();
      } else stop();
    }, delay());
  };

  function render() {
    if (dead) return;
    const n = steps.length;
    if (!n) {
      q('.lk-cap').innerHTML = '<p class="hint">Nothing to show yet. Check the inputs above.</p>';
      q('.lk-stage').innerHTML = '';
      q('.lk-bar i').style.width = '0%';
      q('[data-lk=count]').textContent = '';
      return;
    }
    i = Math.max(0, Math.min(n - 1, i));
    const s = steps[i];
    q('.lk-cap').innerHTML = `<h4>Step ${i + 1} of ${n}: ${s.title}</h4>${s.text ? `<p>${s.text}</p>` : ''}`;
    // Replacing innerHTML re-creates the elements, which restarts every CSS animation in the stage.
    q('.lk-stage').innerHTML = typeof s.html === 'function' ? s.html(i) : s.html || '';
    q('.lk-bar i').style.width = `${((i + 1) / n) * 100}%`;
    q('[data-lk=count]').textContent = `${i + 1} / ${n}`;
    q('[data-lk=prev]').toggleAttribute('disabled', i === 0);
    q('[data-lk=next]').toggleAttribute('disabled', i >= n - 1);
  }

  const toggle = force => {
    isOpen = typeof force === 'boolean' ? force : !isOpen;
    player.hidden = !isOpen;
    const b = q('[data-lk=toggle]');
    b.setAttribute('aria-expanded', String(isOpen));
    b.textContent = `${isOpen ? '▼' : '▶'} ${isOpen ? 'Hide the working' : label}`;
    if (isOpen) {
      render();
      if (o.onOpen) o.onOpen();
    } else stop();
  };

  on(host, 'click', '[data-lk]', (e, b) => {
    const a = b.dataset.lk;
    if (a === 'toggle') toggle();
    else if (a === 'next') {
      stop();
      i++;
      render();
    } else if (a === 'prev') {
      stop();
      i--;
      render();
    } else if (a === 'reset') {
      stop();
      i = 0;
      render();
    } else if (a === 'play') {
      if (playing) return stop();
      if (i >= steps.length - 1) i = 0;
      playing = true;
      syncPlayBtn();
      render();
      schedule();
    }
  });
  q('[data-lk=speed]').onchange = e => {
    speed = Number(e.target.value) || 1;
  };
  player.addEventListener('keydown', e => {
    if (/^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') {
      stop();
      i++;
      render();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      stop();
      i--;
      render();
      e.preventDefault();
    }
  });

  return {
    setSteps(next, opt = {}) {
      stop();
      steps = next || [];
      i = opt.keep ? Math.min(i, Math.max(0, steps.length - 1)) : 0;
      if (isOpen) render();
    },
    goto(n) {
      i = n;
      if (isOpen) render();
    },
    open: () => toggle(true),
    destroy() {
      dead = true;
      clearTimeout(timer);
    },
  };
}
