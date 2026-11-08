/**
 * hash router: URL -> screen
 *
 * Maps the part of the URL after "#" to a screen:
 *   #/            dashboard
 *   #/lab/0..3    the four core-lab stages
 *   #/m/<id>      a learning module (id from regMod)
 * route() runs on page load and on every "hashchange" event, which is also what makes the browser's back and
 * forward buttons work. Before switching, it cancels timers and calls the previous module's cleanup function so
 * nothing keeps running in the background.
 *
 * Imports:
 *   - ../core/state.js (shared in-memory state): DC, S
 *   - ../core/storage.js (saved progress (localStorage) and the shared P object): P, save
 *   - ../core/utils.js (tiny DOM, math and timing helpers): $, esc
 *   - ../core/ui-helpers.js (shared HTML builders: icons, tables, tabs, ladder diagrams): icon, vd
 *   - ../modules/registry.js (learning-module registry and group definitions): CORE, GROUPS, modById
 *   - ./navigation.js (sidebar, breadcrumbs and which screen is visible): crumbs, refreshNav, setStage
 *   - ./dashboard.js (dashboard screen): renderDash
 *   - ./progress.js (achievements, flags and statistics): checkAch
 *   - ../lab/packet-stage.js (core lab stage 2: cut the byte stream into packets): labSplit
 *   - ../lab/transmission-stage.js (core lab stage 3: stop-and-wait delivery over a lossy link): labPrepare
 *   - ../lab/receiver-stage.js (core lab stage 4: reassemble and decode the message): labRecv
 *
 * Exports: route
 *
 * Used by: app.js
 */

import { DC, S } from '../core/state.js';
import { P, save } from '../core/storage.js';
import { icon, vd } from '../core/ui-helpers.js';
import { $, esc } from '../core/utils.js';
import { CORE, GROUPS, modById } from '../modules/registry.js';
import { crumbs, setStage } from './navigation.js';
import { renderDaily, renderHome, renderProfile, renderZone } from '../game/screens.js';
import { renderLeague } from '../game/league-screen.js';
import { renderFlow } from '../game/flow.js';
import { ZONES } from '../game/data.js';
import { checkMeta, updatePill, visitXp } from '../game/store.js';
import { checkAch } from './progress.js';
import { labSplit } from '../lab/packet-stage.js';
import { labRecv } from '../lab/receiver-stage.js';
import { labPrepare } from '../lab/transmission-stage.js';

/**
 * DOM ids of the four core-lab screens, indexed by the number in #/lab/<n>.
 */
const stageIds = ['s0', 's1', 's2', 's3'];

/**
 * Router bookkeeping (module-level state).
 *
 * cleanup: the function returned by the current module's mount(), called when the learner navigates away.
 * currentKey: route key of the screen being shown ('dash', 'lab0'..'lab3' or a module id). Both are `let` because they are reassigned on every navigation, and they are private to this file.
 */
let cleanup = null,
  currentKey = '';

/**
 * Reads location.hash and shows the matching screen.
 *
 * Order of work: (1) cancel anything from the previous screen (token bump, timers, module cleanup); (2) render the new screen; (3) record the visit and re-check achievements; (4) update the navigation, scroll to top and move keyboard focus to the main area.
 */
export function route() {
  // Hash routing: "#/m/dns" becomes "m/dns". The part of a URL after # is never sent to a server,
  // so it suits single-page apps; changing it fires "hashchange" and adds a history entry (which
  // is what makes the back button work).
  const h = location.hash.replace(/^#\/?/, '');
  const [kind, arg, sub] = h.split('/');
  // Invalidate any running core-lab animation (see transmit()).
  S.tok++;
  S.busy = false;
  // Stop the receiver's typewriter timer.
  clearInterval(S.timer);
  // Let the module we are leaving stop its timers and listeners.
  if (cleanup) {
    try {
      cleanup();
    } catch (e) {
      console.error(e);
    }
    cleanup = null;
  }
  if (kind === 'lab' && stageIds[+arg]) {
    const i = +arg;
    visitXp('lab' + i);
    currentKey = 'lab' + i;
    setStage(stageIds[i]);
    crumbs(['Core lab', CORE[i][0]]);
    document.title = `${CORE[i][0]} · Data Comms Lab`;
    if (i === 1) labSplit();
    if (i === 2) labPrepare();
    if (i === 3) labRecv();
  } else if (kind === 'about' || kind === 'support') {
    currentKey = kind;
    setStage('info-page');
    const isAbout = kind === 'about';
    crumbs([isAbout ? 'About Us' : 'Support Us']);
    document.title = `${isAbout ? 'About Us' : 'Support Us'} · BitSecure`;
    const page = $('#info-page');
    page.innerHTML = isAbout
      ? `
        <div class="info-hero">
          <span class="info-kicker">ABOUT BITSECURE</span>
          <h1>Making learning <span>interactive.</span></h1>
          <p class="info-lead">We believe complex concepts become easier to understand when you can explore them, experiment with them, and see how they work.</p>
          <p>BitSecure began as an interactive Data Communications learning lab. Our goal is to go beyond static notes and turn abstract ideas into hands-on experiences that learners can understand at their own pace.</p>
        </div>
        <section class="info-section">
          <div class="info-section-heading"><span class="info-kicker">OUR VISION</span><h2>One learning platform. Many courses. Endless possibilities.</h2></div>
          <p>We want to build simulations and visual learning tools for <strong>many different courses and disciplines</strong> — not just Data Communications. From computer science and electronics to mathematics, physics, and other engineering subjects, our long-term vision is to help learners understand concepts by interacting with them.</p>
          <div class="info-feature-grid">
            <article class="info-feature"><span class="info-feature-icon">◎</span><h3>Learn by doing</h3><p>Explore concepts through interactive experiments instead of only reading about them.</p></article>
            <article class="info-feature"><span class="info-feature-icon">↗</span><h3>See the process</h3><p>Use visual steps, animations, and explanations to understand what happens behind the scenes.</p></article>
            <article class="info-feature"><span class="info-feature-icon">✦</span><h3>Keep it accessible</h3><p>Create practical learning experiences that students can access and revisit as they learn.</p></article>
          </div>
        </section>
        <section class="info-section">
          <div class="info-section-heading"><span class="info-kicker">THE DEVELOPERS</span><h2>Built by learners, for learners.</h2></div>
          <p>We are building this project with a shared interest in making technical education more visual, practical, and approachable.</p>
          <div class="developer-grid">
            <article class="developer-card"><div class="developer-avatar">SP</div><div><h3>Sahil Patra</h3><p>Developer</p><a href="https://github.com/sahilvxky25" target="_blank" rel="noopener noreferrer">@sahilvxky25 ↗</a></div></article>
            <article class="developer-card"><div class="developer-avatar">AA</div><div><h3>Aiyush Anand</h3><p>Developer</p><a href="https://github.com/AIYUSHH" target="_blank" rel="noopener noreferrer">@AIYUSHH ↗</a></div></article>
            <article class="developer-card"><div class="developer-avatar">SR</div><div><h3>Somya Ranjan</h3><p>Developer</p><a href="https://github.com/Somya22005" target="_blank" rel="noopener noreferrer">@Somya22005 ↗</a></div></article>
          </div>
        </section>
        <section class="info-cta"><div><span class="info-kicker">EXPLORE THE PROJECT</span><h2>Learn, experiment, and build with us.</h2><p>Explore the source code, follow development, or share ideas for future simulations.</p></div><a class="btn" href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a></section>`
      : `
        <div class="info-hero support-hero">
          <span class="info-kicker">SUPPORT THE MISSION</span>
          <h1>Help us make learning <span>more hands-on.</span></h1>
          <p class="info-lead">Every bit of encouragement helps us spend more time building useful, accessible simulations for learners.</p>
          <p>Our long-term aim is to expand beyond Data Communications and create interactive learning experiences across different courses. Community support can help us move that vision forward.</p>
        </div>
        <section class="info-section">
          <div class="info-section-heading"><span class="info-kicker">WHAT SUPPORT CAN ENABLE</span><h2>Help turn more ideas into simulations.</h2></div>
          <div class="info-feature-grid">
            <article class="info-feature"><span class="info-feature-icon">01</span><h3>More course simulations</h3><p>Explore new subjects and build interactive tools for more areas of study.</p></article>
            <article class="info-feature"><span class="info-feature-icon">02</span><h3>Better learning experiences</h3><p>Improve explanations, animations, accessibility, and usability.</p></article>
            <article class="info-feature"><span class="info-feature-icon">03</span><h3>Open learning resources</h3><p>Keep making practical resources that learners can explore at their own pace.</p></article>
          </div>
        </section>
        <section class="patreon-panel">
          <div class="patreon-mark" aria-hidden="true">P</div><div class="patreon-copy"><span class="coming-soon-pill">COMING SOON</span><h2>Support us on Patreon</h2><p>We are preparing our Patreon creator page. Once it is published, this section will link directly to it. There is no payment link available yet.</p><button class="btn" type="button" disabled aria-disabled="true">Patreon page coming soon</button></div>
        </section>
        <p class="info-back-link"><a href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">Explore the project on GitHub ↗</a></p>`;
  } else if (kind === 'm' && modById(arg)) {
    const m = modById(arg);
    currentKey = m.id;
    const g = GROUPS.find(x => x.id === m.group);
    setStage('mview');
    crumbs([g ? g.name : 'Toolbox', m.title]);
    document.title = `${m.title} · BitSecure`;
    cleanup = renderFlow(m, $('#mview'), sub === 'play');
  } else if (kind === 'zone' && ZONES.some(z => z.id === arg)) {
    currentKey = 'zone-' + arg;
    setStage('dash');
    crumbs(['Map', ZONES.find(z => z.id === arg).name]);
    document.title = 'BitSecure';
    renderZone(arg);
  } else if (kind === 'league') {
    currentKey = 'league';
    setStage('dash');
    crumbs(['Weekly competition']);
    document.title = 'Weekly competition · BitSecure';
    void renderLeague();
  } else if (kind === 'profile' || kind === 'daily') {
    currentKey = kind;
    setStage('dash');
    crumbs([kind === 'daily' ? 'Daily challenge' : 'Profile']);
    document.title = 'BitSecure';
    (kind === 'daily' ? renderDaily : renderProfile)();
  } else {
    currentKey = 'dash';
    setStage('dash');
    crumbs(['Map']);
    document.title = 'BitSecure';
    renderHome();
  }
  // Remember the first visit time (an existing value is kept).
  P.visited[currentKey] = P.visited[currentKey] || Date.now();
  if (currentKey !== 'dash') P.last = currentKey;
  checkAch();
  checkMeta();
  save();
  updatePill();
  window.scrollTo(0, 0);
  document.body.classList.remove('nav-open');
  const v = $('#view');
  if (v) v.focus({ preventScroll: true });
}
