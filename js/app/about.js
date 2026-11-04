/**
 * About Us page for BitSecure.
 * Kept outside the learning-module registry so it does not affect course progress.
 */
const members = [
  { name: 'Sahil Kumar Patra', initials: 'SP' },
  { name: 'Somya Ranjan Suar', initials: 'SS' },
  { name: 'Aiyush Anand', profile: 'https://github.com/AIYUSHH' },
  { name: 'Avanish Mahapatra', initials: 'AM' }
];

export function renderAbout(root) {
  if (!document.querySelector('link[data-about-styles]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = './css/about.css';
    stylesheet.dataset.aboutStyles = 'true';
    document.head.append(stylesheet);
  }

  root.innerHTML = `
    <div class="about-page">
      <section class="about-hero">
        <div class="about-hero-copy">
          <span class="about-kicker"><span></span> THE PEOPLE BEHIND BITSECURE</span>
          <h1>Making data communication <span>easier to understand.</span></h1>
          <p>BitSecure is an interactive Data Communications Lab built to turn networking concepts into hands-on learning experiences — from bits and frames to packets, protocols and complete network behaviour.</p>
          <div class="about-hero-actions">
            <a class="about-primary-link" href="#/">Explore the lab <span aria-hidden="true">→</span></a>
            <a class="about-secondary-link" href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">View project on GitHub <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <div class="about-visual" aria-hidden="true">
          <div class="about-orbit orbit-one"></div>
          <div class="about-orbit orbit-two"></div>
          <div class="about-core"><span class="about-core-mark">B</span><small>BITSECURE</small></div>
          <span class="about-node node-one">DATA</span>
          <span class="about-node node-two">PACKETS</span>
          <span class="about-node node-three">NETWORK</span>
          <span class="about-node node-four">PROTOCOLS</span>
          <span class="about-signal signal-one"></span><span class="about-signal signal-two"></span>
        </div>
      </section>

      <section class="about-section">
        <div class="about-section-heading">
          <span class="about-kicker">01 / THE PROJECT</span>
          <h2>Learning by <span>doing.</span></h2>
          <p>Instead of only reading about data communication, learners can explore how information is encoded, divided, transmitted, checked and reassembled.</p>
        </div>
        <div class="about-feature-grid">
          <article class="about-feature-card"><span class="about-feature-icon">⌁</span><h3>Visual simulations</h3><p>Follow data through the communication process and see how networking components work together.</p></article>
          <article class="about-feature-card"><span class="about-feature-icon">⌘</span><h3>Hands-on labs</h3><p>Experiment with protocols, addressing, routing, error detection and network behaviour.</p></article>
          <article class="about-feature-card"><span class="about-feature-icon">◈</span><h3>Practice and learning</h3><p>Reinforce concepts through guided activities, challenges and interactive learning modules.</p></article>
        </div>
      </section>

      <section class="about-team-section">
        <div class="about-section-heading">
          <span class="about-kicker">02 / THE TEAM</span>
          <h2>Meet the <span>team.</span></h2>
          <p>A collaborative course project developed by four team members.</p>
        </div>
        <div class="about-team-grid">
          ${members.map(member => {
            const profileUrl = member.profile || ('https://github.com/search?q=' + encodeURIComponent(member.name) + '&type=users');
            const linkLabel = member.profile ? 'GitHub profile' : 'Find on GitHub';
            return `<article class="about-member-card">
              <div class="about-member-info"><h3>${member.name}</h3><span>Project team</span></div>
              <a class="about-profile-link" href="${profileUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open ${member.name}'s GitHub profile">${linkLabel} <span aria-hidden="true">↗</span></a>
            </article>`;
          }).join('')}
        </div>
      </section>

      <section class="about-academic-panel">
        <div class="about-academic-mark" aria-hidden="true">NIT<br>R</div>
        <div><span class="about-kicker">03 / ACADEMIC CONTEXT</span><h2>Built as a course project at <span>NIT Rourkela.</span></h2><p>Created in the context of a Data Communication course at the National Institute of Technology Rourkela, with the goal of making core communication and networking concepts more approachable through interactive demonstrations.</p></div>
      </section>

      <section class="about-contact-section">
        <div class="about-section-heading">
          <span class="about-kicker">04 / GET IN TOUCH</span>
          <h2>Contact <span>Us.</span></h2>
          <p>Have a question, suggestion or feedback about BitSecure? Reach the project team through the repository.</p>
        </div>
        <div class="about-contact-card">
          <div class="about-contact-mark" aria-hidden="true">↗</div>
          <div class="about-contact-copy"><h3>Connect with the project</h3><p>Visit the repository to explore the source code, report an issue or suggest an improvement.</p></div>
          <div class="about-contact-actions">
            <a class="about-primary-link" href="https://github.com/sahilvxky25/DC_Project/issues" target="_blank" rel="noopener noreferrer">Contact via GitHub Issues <span aria-hidden="true">↗</span></a>
            <a class="about-secondary-link" href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">Project repository</a>
          </div>
        </div>
      </section>

      <footer class="about-footer">
        <div><strong>BitSecure</strong><span>Data Communications Lab · NIT Rourkela</span></div>
        <a href="https://github.com/sahilvxky25/DC_Project" target="_blank" rel="noopener noreferrer">Open the GitHub repository ↗</a>
      </footer>
    </div>`;
}
