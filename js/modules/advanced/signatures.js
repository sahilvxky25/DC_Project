/**
 * learning module: Digital signatures and certificates
 *
 * Two tabs. Signatures: sign a message with a private key, then change the message or the signature and watch
 * verification fail. Certificates: validate a certificate chain the way a browser does, with six scenarios (valid,
 * expired, wrong name, untrusted root, tampered, self-signed). Layered explanations (wax seal and passport analogies)
 * and animated "show the working" players are included in both tabs.
 *
 * Imports:
 *   - ../../core/ui-helpers.js: hn, panel, sel, statRow, tabset, tbl, vd
 *   - ../../core/utils.js: $, esc
 *   - ../../core/learn-kit.js: kitStyles, layers, showWorking
 *   - ../../simulations/rsa-toy.js: makeRsaKey, sign, toyHash, verify
 *   - ../../simulations/certificates.js: SCENARIOS, buildScenario, verifyChain
 *   - ../registry.js: regMod
 *   - ../../app/progress.js: flag
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { hn, panel, sel, statRow, tabset, tbl, vd } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { kitStyles, layers, showWorking } from '../../core/learn-kit.js';
import { makeRsaKey, sign, toyHash, verify } from '../../simulations/rsa-toy.js';
import { SCENARIOS, buildScenario, verifyChain } from '../../simulations/certificates.js';
import { regMod } from '../registry.js';
import { flag } from '../../app/progress.js';

const SIG_EXPLAIN = {
  analogy: {
    emoji: '🔏',
    title: 'A wax seal only you can make',
    text: 'Long ago a letter was closed with wax and stamped with a <b>signet ring</b> that only the sender owned. Anyone could look at the seal and recognise it, but nobody could forge it, and if the letter was opened the seal broke. A <b>digital signature</b> is a seal made of maths: only the owner of the <b>private key</b> can make it, anyone with the <b>public key</b> can check it, and changing even one letter of the message breaks it.',
  },
  plain: `<p>Locking a message keeps it secret. A <b>signature</b> does something different: it proves <i>who wrote it</i> and that <i>nobody changed it</i> on the way.</p>
    <p>You sign with your private key and everybody checks with your public key. If the check passes, the message really came from the key’s owner and is exactly as they wrote it.</p>
    <p>Below, change the message after it is signed and see the check fail.</p>`,
  how: `<ol><li><b>Hash</b> the message into a short fingerprint. A good hash changes completely if even one letter changes.</li>
    <li><b>Sign</b>: the sender locks the fingerprint with their <b>private</b> key. That is the signature.</li>
    <li>Send the message <i>and</i> the signature.</li>
    <li>The receiver <b>hashes the message they got</b> and <b>unlocks the signature</b> with the sender’s <b>public</b> key.</li>
    <li>If the two fingerprints match, the signature is valid. If not, the message or the signature was changed, or the signer is someone else.</li></ol>
    <p>Why sign the hash and not the whole message? It is much faster, and the signature stays a fixed small size.</p>`,
  deep: `<p><b>Same maths as RSA, run backwards.</b> Signing is s = hᵈ mod n using the private exponent; verifying is s<sup>e</sup> mod n, which should give back h. Encrypting with the private key is exactly what makes a signature checkable by everyone.</p>
    <p><b>What a signature guarantees.</b> Integrity (the message is unchanged), authenticity (it came from the private-key holder) and non-repudiation (the signer cannot easily deny it). It does <i>not</i> hide the message, and it does not say whether the key owner is who you think they are. For that you need certificates.</p>
    <p><b>The toy hash.</b> Here a simple 32-bit hash is squeezed below n, so two different messages can collide by chance (about one in a million). A real hash such as SHA-256 has 256 bits, which makes collisions astronomically unlikely. Real signatures also pad the hash (RSA-PSS) or use other schemes such as ECDSA and Ed25519.</p>
    <p><b>Where the seal analogy stops.</b> A wax seal can be copied by a skilled forger who studies it. A signature depends on a secret number, so studying many signatures does not help, as long as the key is large and well chosen.</p>`,
  map: [
    ['The signet ring', 'The private key'],
    ['Recognising the seal', 'Checking with the public key'],
    ['The seal breaking if the letter is opened', 'The hash no longer matching'],
    ['Fingerprint of the letter', 'The hash of the message'],
  ],
};

const CERT_EXPLAIN = {
  analogy: {
    emoji: '🛂',
    title: 'A passport that someone you trust has stamped',
    text: 'A stranger says, “I am Asha.” Why believe them? A <b>passport</b> helps because a government you trust checked their identity and stamped it. You check the stamp, the photo, the expiry date, and that it really is from that government. A <b>certificate</b> works the same way for websites: “this key belongs to shop.example.com”, stamped (signed) by an authority your browser already trusts.',
  },
  plain: `<p>When you connect to a website, you receive its <b>public key</b>. But how do you know it really belongs to that website, and not to an impostor who intercepted the connection?</p>
    <p>The site shows a <b>certificate</b>: a document that says “this public key belongs to this name”, signed by an organisation your browser already trusts (a <b>certificate authority</b>, CA). The browser checks the document carefully. Pick a scenario below to see what passes and what is rejected.</p>`,
  how: `<p>Certificates form a <b>chain of trust</b>: the site’s certificate is signed by an intermediate CA, whose certificate is signed by a root CA that is already built into your browser or device (the “trust store”). The browser checks, in turn:</p>
    <ul><li><b>Name:</b> does the certificate name match the site you asked for?</li>
    <li><b>Dates:</b> is every certificate within its valid period?</li>
    <li><b>Signatures:</b> was each certificate really signed by the one above it? (Same check as in the signature tab.)</li>
    <li><b>Permission:</b> is each issuer allowed to issue certificates?</li>
    <li><b>Root:</b> does the chain end at a root the browser already trusts?</li></ul>
    <p>All must pass. A single failure shows the browser warning page.</p>`,
  deep: `<p><b>Why not trust the site directly?</b> Because anyone can make a key pair and claim any name. Trust has to come from outside, from an authority that checks identity first. Browsers ship with a few hundred root CAs; roots rarely sign sites directly but sign intermediates, so the root’s private key can stay locked away offline.</p>
    <p><b>In real X.509.</b> A certificate also holds serial numbers, key-usage limits, subject alternative names (the list of names it covers), and extensions such as Basic Constraints (the CA flag checked here). Real clients also check revocation (CRL, OCSP) in case a certificate was cancelled early, and certificate transparency logs that make wrongly issued certificates visible. Lifetimes are now short (about a year or less) to limit damage from stolen keys.</p>
    <p><b>Man in the middle, revisited.</b> This is what stops the attack from the key-exchange lesson: Mallory cannot present a valid certificate for the real site’s name, because she cannot get a trusted CA to sign one, and she cannot forge a signature without the CA’s private key.</p>
    <p><b>Simplifications here.</b> The keys are tiny so the maths is checkable, the clock is fixed at 2026-06-01 so results never change, and there is no revocation.</p>
    <p><b>Where the passport analogy stops.</b> A passport proves who <i>you</i> are; a certificate proves that a <i>key</i> belongs to a name. And browsers decide which governments to trust (the root store), which is a social decision as much as a technical one.</p>`,
  map: [
    ['The passport', 'The site’s certificate'],
    ['The government stamp', 'The CA’s signature'],
    ['The government you already trust', 'A root CA in your trust store'],
    ['Expiry date', 'Certificate validity period'],
    ['Name on the passport must match who is standing there', 'The certificate name must match the site'],
    ['A forged stamp', 'A signature that does not verify'],
  ],
};

/* ---------- signatures tab ---------- */
function signTab(p) {
  const KEY = makeRsaKey(1009, 1013, 65537);
  p.innerHTML =
    panel('Learn it at your level', '<div id="sg-layers"></div>') +
    panel(
      'Sign a message, then try to tamper with it',
      `<div class="controls"><div class="field grow"><label for="sg-msg">Message the sender signs</label><input id="sg-msg" value="Pay Asha 100 rupees" maxlength="60" autocomplete="off"></div></div>
      <div class="controls"><div class="field grow"><label for="sg-rx">Message the receiver gets</label><input id="sg-rx" value="Pay Asha 100 rupees" maxlength="60" autocomplete="off"></div>
      <div class="btnrow"><button class="btn ghost sm" id="sg-tamper" type="button">✏️ Tamper with it</button><button class="btn ghost sm" id="sg-reset" type="button">↺ Undo</button></div></div>
      <div id="sg-out"></div>`
    ) +
    panel('Show the working', '<div id="sg-work"></div>', 'Hash, sign, send, and check, one step at a time.');
  const cleanups = [layers($('#sg-layers', p), SIG_EXPLAIN)];
  const work = showWorking($('#sg-work', p), { onOpen: () => flag('sig_working') });
  cleanups.push(() => work.destroy());
  let touched = false;

  function refresh() {
    const sent = $('#sg-msg', p).value;
    if (!touched) $('#sg-rx', p).value = sent;
    const rx = $('#sg-rx', p).value;
    const sig = sign(sent, KEY),
      v = verify(rx, sig, KEY),
      hs = toyHash(sent, KEY.n);
    const same = rx === sent;
    $('#sg-out', p).innerHTML =
      statRow([[hs, 'fingerprint of the sent message'], [sig, 'signature (locked with the private key)'], [v.hash, 'fingerprint of what arrived'], [v.recovered, 'signature unlocked with the public key']]) +
      (v.ok
        ? same
          ? vd('ok', 'Signature valid.', 'The fingerprints match: the message is exactly what the key owner signed.')
          : vd('warn', 'Signature valid, but the message differs.', 'The two messages happen to share a fingerprint. This is a hash collision, possible only because this toy hash is tiny. A real 256-bit hash makes it astronomically unlikely.')
        : vd('bad', 'Signature INVALID.', 'The fingerprint of what arrived does not match the one hidden in the signature. The message was changed, or the signature was not made by this key.'));

    const rowsFor = (title, ok) => `<span class="lk-formula lk-in">${title}</span>`;
    work.setSteps([
      {
        title: 'The sender has a key pair',
        text: `The sender keeps the private exponent secret and publishes the public key (n = ${KEY.n.toLocaleString('en-US')}, e = ${KEY.e}).`,
        html: `<div class="lk-row"><span class="lk-chip c1 lk-pop">🔑 Private d (secret)</span><span class="lk-chip c2 lk-pop" style="--d:.3s">🔓 Public n, e</span></div>`,
      },
      {
        title: 'Hash the message into a fingerprint',
        text: 'The message is squeezed into one number. Change a single letter and the number changes completely.',
        html: `<div class="lk-row lk-in"><span class="lk-chip c0">${esc(sent) || '(empty)'}</span><span class="lk-op">→ hash →</span><span class="lk-chip c3">${hs}</span></div>`,
      },
      {
        title: 'Sign: lock the fingerprint with the private key',
        text: `<b>signature = fingerprint<sup>d</sup> mod n</b>. Only the private-key holder can compute this.`,
        html: `<div class="lk-row lk-in"><span class="lk-chip c3">${hs}</span><span class="lk-op">→ lock with 🔑 →</span><span class="lk-chip c1">${sig}</span></div>`,
      },
      {
        title: 'Send the message together with the signature',
        text: 'Anyone along the way can read both, and may try to change them.',
        html: `<div class="lk-row"><span class="lk-chip c0 lk-slide">${esc(rx) || '(empty)'}</span><span class="lk-chip c1 lk-slide" style="--d:.3s">sig ${sig}</span></div><p class="hint">${same ? 'Nothing was changed on the way.' : '⚠ The message was changed on the way.'}</p>`,
      },
      {
        title: 'The receiver hashes what arrived',
        text: 'They compute their own fingerprint of the message they received.',
        html: `<div class="lk-row lk-in"><span class="lk-chip c0">${esc(rx) || '(empty)'}</span><span class="lk-op">→ hash →</span><span class="lk-chip c3">${v.hash}</span></div>`,
      },
      {
        title: 'And unlocks the signature with the public key',
        text: `<b>fingerprint = signature<sup>e</sup> mod n</b>, using the public key anyone can fetch.`,
        html: `<div class="lk-row lk-in"><span class="lk-chip c1">${sig}</span><span class="lk-op">→ unlock with 🔓 →</span><span class="lk-chip c3">${v.recovered}</span></div>`,
      },
      {
        title: 'Compare the two fingerprints',
        text: v.ok ? 'They match, so the signature is valid.' : 'They differ, so the signature is rejected.',
        html: `<div class="lk-row lk-pop"><span class="lk-chip c3">${v.hash}</span><span class="lk-op">${v.ok ? '＝' : '≠'}</span><span class="lk-chip c3">${v.recovered}</span></div>${rowsFor(v.ok ? '✔ Valid: authentic and unchanged' : '✘ Invalid: changed or forged', v.ok)}`,
      },
    ]);
  }

  $('#sg-msg', p).oninput = refresh;
  $('#sg-rx', p).oninput = () => {
    touched = $('#sg-rx', p).value !== $('#sg-msg', p).value;
    refresh();
  };
  $('#sg-tamper', p).onclick = () => {
    const cur = $('#sg-rx', p).value || 'x';
    $('#sg-rx', p).value = /100/.test(cur) ? cur.replace('100', '900') : cur.slice(0, -1) + (cur.slice(-1) === 'x' ? 'y' : 'x');
    touched = true;
    flag('sig_tamper');
    refresh();
  };
  $('#sg-reset', p).onclick = () => {
    touched = false;
    refresh();
  };
  refresh();
  return () => cleanups.forEach(f => f());
}

/* ---------- certificates tab ---------- */
const certCard = (c, state = '') =>
  `<div class="lk-chip ${state}" style="display:block;text-align:left;padding:8px 12px;margin:6px 0"><b>${esc(c.subject)}</b> ${c.isCA ? '<small>(CA)</small>' : ''}<br><small>issued by ${esc(c.issuer)} · valid ${esc(c.notBefore)} to ${esc(c.notAfter)}${c.names.length ? `<br>names: ${esc(c.names.join(', '))}` : ''}</small></div>`;

function certTab(p) {
  p.innerHTML =
    panel('Learn it at your level', '<div id="ct-layers"></div>') +
    panel(
      'Pick a scenario',
      `<div class="controls"><div class="field grow"><label for="ct-sc">Scenario</label>${sel('ct-sc', SCENARIOS.map(s => [s.id, s.name]), 'valid')}</div></div>
      <p class="hint" id="ct-lesson"></p><div id="ct-out"></div>`
    ) +
    panel('Show the working', '<div id="ct-work"></div>', 'Follow the browser through every check.');
  const cleanups = [layers($('#ct-layers', p), CERT_EXPLAIN)];
  const work = showWorking($('#ct-work', p), { onOpen: () => flag('cert_working') });
  cleanups.push(() => work.destroy());

  function refresh() {
    const sc = buildScenario($('#ct-sc', p).value),
      res = verifyChain(sc.chain, sc.trust, sc.hostname, sc.now);
    $('#ct-lesson', p).innerHTML = `<b>${esc(sc.scenario.name)}.</b> ${esc(sc.scenario.lesson)}`;
    const failedLabel = res.checks.find(c => !c.ok);
    $('#ct-out', p).innerHTML =
      `<p>You visit <b>https://${esc(sc.hostname)}</b>. The server sends this chain, and your browser trusts: ${sc.trust.map(t => `<b>${esc(t.subject)}</b>`).join(', ')}.</p>` +
      sc.chain.map((c, i) => `<div class="lk-in" style="--d:${(i * 0.15).toFixed(2)}s">${certCard(c)}${i < sc.chain.length - 1 ? '<div class="hint" style="text-align:center">↑ signed by</div>' : ''}</div>`).join('') +
      tbl(['Check', 'Result', 'Detail'], res.checks.map(c => [c.label, { h: c.ok ? '✔ pass' : '<b>✘ FAIL</b>' }, c.detail])) +
      (res.ok
        ? vd('ok', '🔒 The browser shows the padlock.', 'Every check passed.')
        : vd('bad', '⚠ The browser shows a full-page warning.', `First failure: ${failedLabel.label} ${failedLabel.detail}`));

    const steps = [
      {
        title: 'The server presents its certificate chain',
        text: `Your browser asked for ${esc(sc.hostname)} and received ${sc.chain.length} certificate${sc.chain.length > 1 ? 's' : ''}. It now validates them from the bottom up.`,
        html: `<div class="lk-in">${sc.chain.map(c => certCard(c)).join('')}</div>`,
      },
      ...res.checks.map(c => ({
        title: `${c.ok ? '✔' : '✘'} ${c.label}`,
        text: c.detail,
        html: () => `<div>${sc.chain.map((x, i) => certCard(x, '')).join('')}</div><div class="lk-pop">${c.ok ? vd('ok', 'Passed', esc(c.detail)) : vd('bad', 'Failed', esc(c.detail))}</div>`,
        ms: 2200,
      })),
      {
        title: res.ok ? 'Verdict: trusted' : 'Verdict: rejected',
        text: res.ok ? 'All checks passed, so the browser shows the padlock and the key can be used.' : 'At least one check failed, so the browser refuses to continue silently and shows a warning.',
        html: () => `<div class="lk-pop">${res.ok ? vd('ok', '🔒 Connection trusted') : vd('bad', '⚠ Connection not trusted')}</div>${statRow([[res.checks.filter(c => c.ok).length, 'checks passed'], [res.checks.filter(c => !c.ok).length, 'checks failed']])}`,
      },
    ];
    work.setSteps(steps);
  }

  $('#ct-sc', p).onchange = () => {
    flag('cert_scenario');
    refresh();
  };
  refresh();
  return () => cleanups.forEach(f => f());
}

regMod({
  id: 'signatures',
  group: 'adv',
  title: 'Digital signatures and certificates',
  desc: 'Seal a message with a private key, see tampering break the seal, then watch a browser decide whether to trust a website’s certificate.',
  obj: [
    'Describe how a digital signature proves origin and integrity.',
    'Explain how a certificate chain turns a public key into a trusted identity.',
    'Identify why a certificate is rejected (expired, wrong name, untrusted, tampered).',
  ],
  mount(root) {
    kitStyles();
    root.innerHTML = '<div id="sg-tabs"></div>';
    const t = tabset($('#sg-tabs', root), [
      { label: '🔏 Signatures', render: signTab },
      { label: '🛂 Certificates', render: certTab },
    ]);
    return () => t.destroy();
  },
});
