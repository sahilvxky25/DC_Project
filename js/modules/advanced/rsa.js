/**
 * learning module: Public-key encryption (RSA)
 *
 * Build an RSA key pair from two small primes, encrypt and decrypt a message, and watch an attacker try to factor the
 * public number. Layered explanations (padlock analogy) and an animated "show the working" player with the extended
 * Euclid table and square-and-multiply are included.
 *
 * Imports:
 *   - ../../core/ui-helpers.js: hn, panel, sel, statRow, tbl, vd
 *   - ../../core/utils.js: $, esc
 *   - ../../core/learn-kit.js: kitStyles, layers, showWorking
 *   - ../../simulations/modmath.js: modPowTrace
 *   - ../../simulations/rsa-toy.js: factorTrial, makeRsaKey, rsaDecrypt, rsaEncrypt, validEs
 *   - ../registry.js: regMod
 *   - ../../app/progress.js: flag
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { hn, panel, sel, statRow, tbl, vd } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { kitStyles, layers, showWorking } from '../../core/learn-kit.js';
import { modPowTrace } from '../../simulations/modmath.js';
import { factorTrial, makeRsaKey, rsaDecrypt, rsaEncrypt, validEs } from '../../simulations/rsa-toy.js';
import { regMod } from '../registry.js';
import { flag } from '../../app/progress.js';

const EXPLAIN = {
  analogy: {
    emoji: '📮',
    title: 'A padlock anyone can close, but only you can open',
    text: 'Imagine you give away thousands of <b>open padlocks</b> (your public key) and keep the only <b>key</b> (your private key). Anyone can put a message in a box and snap a padlock shut on it, even a stranger. Once it is shut, <b>nobody</b>, not even the person who locked it, can open it again. Only you, with the key, can.',
  },
  plain: `<p>Older ciphers need both people to share the same secret key first, which brings back the old problem: how do you share that key safely?</p>
    <p><b>Public-key encryption</b> splits the key in two. One half, the <b>public key</b>, locks. It is safe to publish. The other half, the <b>private key</b>, unlocks, and never leaves its owner.</p>
    <p>That is how a stranger’s browser can send your website a secret without ever having met it. Build a key pair below and watch it work with numbers small enough to check by hand.</p>`,
  how: `<ol><li>Pick two prime numbers <b>p</b> and <b>q</b> and multiply them: <b>n = p × q</b>.</li>
    <li>Work out <b>φ = (p − 1)(q − 1)</b>. (This number is what makes unlocking possible.)</li>
    <li>Choose a public exponent <b>e</b> that shares no factor with φ.</li>
    <li>Find the private exponent <b>d</b> so that <b>e × d ≡ 1 (mod φ)</b>. The extended Euclid algorithm does this.</li>
    <li><b>Public key = (n, e). Private key = (n, d).</b></li>
    <li><b>Lock:</b> ciphertext <b>c = mᵉ mod n</b>. <b>Unlock:</b> message <b>m = cᵈ mod n</b>.</li></ol>
    <p>The message m is a number smaller than n. Letters become numbers (their character codes) first.</p>`,
  deep: `<p><b>Why unlocking works.</b> By Euler’s theorem, m^φ ≡ 1 (mod n) when m shares no factor with n. Since e·d = 1 + k·φ, we get (mᵉ)ᵈ = m · (m^φ)ᵏ ≡ m. (It also holds for the rare m that share a factor with n.)</p>
    <p><b>Why it is hard to break.</b> Everyone can see n and e. To get d you need φ, and to get φ you need p and q, which means <b>factoring n</b>. Multiplying two large primes is instant; factoring their product has no known fast method. Try the attacker panel with bigger primes and watch the work grow.</p>
    <p><b>Real sizes.</b> n is at least 2048 bits (about 617 digits), with 65537 as the usual e. These examples use tiny primes, so they are broken in a blink.</p>
    <p><b>Textbook RSA is not safe on its own.</b> It is deterministic (the same message always gives the same ciphertext) and malleable. Real systems add random padding (OAEP for encryption, PSS for signatures) and almost always use RSA only to protect a short symmetric key, since RSA is slow for bulk data. TLS 1.3 no longer uses RSA key transport at all and prefers ephemeral Diffie–Hellman.</p>
    <p><b>Where the padlock analogy stops.</b> A real padlock does not need maths, and with a real padlock you could in principle force it. Also, RSA is symmetric in a useful way: encrypting with the <i>private</i> key produces something anyone can check with the public key, which is exactly a digital signature (see the next lesson).</p>`,
  map: [
    ['The open padlock you hand out', 'Public key (n, e)'],
    ['The one key to open it', 'Private key (n, d)'],
    ['Snapping the padlock shut', 'Encrypting: c = mᵉ mod n'],
    ['Opening it with the key', 'Decrypting: m = cᵈ mod n'],
    ['Nobody can pick the lock', 'Factoring n is infeasible for large primes'],
  ],
};

const SMALL_PRIMES = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113];

regMod({
  id: 'rsa',
  group: 'adv',
  title: 'Public-key encryption (RSA)',
  desc: 'Build an RSA key pair from two primes, lock and unlock a message, and see why factoring the public number is the attacker’s only way in.',
  obj: [
    'Generate n, φ, e and d from two primes.',
    'Encrypt and decrypt with modular exponentiation.',
    'Explain why RSA’s security rests on the difficulty of factoring.',
  ],
  mount(root) {
    kitStyles();
    root.innerHTML =
      panel('Learn it at your level', '<div id="rs-layers"></div>') +
      panel(
        'Build a key pair',
        `<div class="controls"><div class="field"><label for="rs-p">Prime p</label><input id="rs-p" type="number" min="2" value="61"></div>
        <div class="field"><label for="rs-q">Prime q</label><input id="rs-q" type="number" min="2" value="53"></div>
        <div class="field"><label for="rs-e">Public exponent e</label><select id="rs-e"></select></div>
        <div class="btnrow"><button class="btn ghost sm" id="rs-rand" type="button">🎲 Random primes</button></div></div>
        <p class="hint">Both primes must be prime, different from each other, and together make a number n above 255 so letters fit.</p><div id="rs-msg"></div><div id="rs-keys"></div>`
      ) +
      panel(
        'Lock and unlock a message',
        `<div class="controls"><div class="field grow"><label for="rs-text">Message (letters and numbers, up to 12 characters)</label><input id="rs-text" value="HI" maxlength="12" autocomplete="off" spellcheck="false"></div></div><div id="rs-enc"></div>`
      ) +
      panel('Show the working', '<div id="rs-work"></div>', 'From two primes to a locked and unlocked message, one step at a time.') +
      panel('The attacker’s problem: factoring n', '<div id="rs-atk"></div>');
    const cleanups = [layers($('#rs-layers', root), EXPLAIN)];
    const work = showWorking($('#rs-work', root), { onOpen: () => flag('rsa_working') });
    cleanups.push(() => work.destroy());

    const intOf = id => Math.floor(Number($('#' + id, root).value));
    let lastP = 0,
      lastQ = 0;

    function fillE(p, q) {
      const phi = (p - 1) * (q - 1),
        es = validEs(phi),
        selEl = $('#rs-e', root),
        keep = Number(selEl.value);
      selEl.innerHTML = es.map(v => `<option value="${v}">${v}</option>`).join('');
      if (es.includes(keep)) selEl.value = keep;
    }

    function refresh() {
      const p = intOf('rs-p'),
        q = intOf('rs-q');
      if (p !== lastP || q !== lastQ) {
        lastP = p;
        lastQ = q;
        if (Number.isInteger(p) && Number.isInteger(q) && p > 1 && q > 1) fillE(p, q);
      }
      const e = Number($('#rs-e', root).value);
      const key = makeRsaKey(p, q, e);
      const clear = () => {
        $('#rs-keys', root).innerHTML = $('#rs-enc', root).innerHTML = $('#rs-atk', root).innerHTML = '';
        work.setSteps([]);
      };
      if (!key.ok) {
        $('#rs-msg', root).innerHTML = vd('warn', 'Check your numbers.', esc(key.error));
        return clear();
      }
      if (key.n <= 255) {
        $('#rs-msg', root).innerHTML = vd('warn', 'n is too small to carry letters.', `n = ${key.n}, but character codes go up to 255. Pick larger primes.`);
        return clear();
      }
      $('#rs-msg', root).innerHTML = '';
      const { n, phi, d } = key;
      $('#rs-keys', root).innerHTML =
        statRow([[n.toLocaleString('en-US'), 'n = p × q'], [phi.toLocaleString('en-US'), 'φ = (p−1)(q−1)'], [e, 'e (public)'], [d.toLocaleString('en-US'), 'd (private)']]) +
        `<div class="lk-row"><span class="lk-chip c2">🔓 Public key (n = ${n}, e = ${e})</span><span class="lk-chip c1">🔑 Private key (n = ${n}, d = ${d})</span></div>` +
        hn('Share the public key freely. Keep d secret: anyone who knows d can open every message locked for you.');

      const text = $('#rs-text', root).value.slice(0, 12).replace(/[^\x20-\x7e]/g, '');
      const rows = [...text].map(ch => {
        const m = ch.charCodeAt(0),
          c = rsaEncrypt(m, e, n),
          back = rsaDecrypt(c, d, n);
        return { ch, m, c, back };
      });
      $('#rs-enc', root).innerHTML = rows.length
        ? tbl(['Letter', 'Code m', 'Locked c = mᵉ mod n', 'Unlocked cᵈ mod n', 'Letter back'], rows.map(r => [r.ch === ' ' ? '␣' : esc(r.ch), r.m, { h: `<b>${r.c}</b>` }, r.back, r.back === r.m ? String.fromCharCode(r.back) : '✘'])) +
          hn('Notice that the same letter always locks to the same number. That is why real RSA adds random padding before locking.')
        : vd('warn', 'Type a message.');

      const first = rows[0] || { ch: 'A', m: 65, c: rsaEncrypt(65, e, n) },
        trE = modPowTrace(first.m, e, n),
        trD = modPowTrace(first.c, d, n);
      const eg = key.trace;
      work.setSteps([
        {
          title: 'Pick two primes and multiply',
          text: `Choose <b>p = ${p}</b> and <b>q = ${key.q}</b>. Their product is <b>n = ${n}</b>. Everybody will see n, but only you know how it splits.`,
          html: `<span class="lk-formula lk-in">n = ${p} × ${key.q} = <b>${n}</b></span>`,
        },
        {
          title: 'Compute φ, the secret ingredient',
          text: 'φ counts the numbers below n that share no factor with it. For a product of two primes it is easy to get if you know p and q, and hard if you only know n.',
          html: `<span class="lk-formula lk-in">φ = (${p} − 1) × (${key.q} − 1) = ${p - 1} × ${key.q - 1} = <b>${phi}</b></span>`,
        },
        {
          title: 'Choose the public exponent e',
          text: `e must share no factor with φ = ${phi}. The options offered are the common small choices that pass that test. You picked <b>e = ${e}</b>.`,
          html: `<span class="lk-formula lk-in">gcd(${e}, ${phi}) = <b>1</b> ✔</span>`,
        },
        {
          title: 'Find the private exponent d',
          text: `d is the number with e × d ≡ 1 (mod ${phi}). The extended Euclid algorithm finds it: divide repeatedly, and track a helper column t. The t on the last row before the remainder reaches 0, reduced mod ${phi}, is d.`,
          html: `${tbl(['Quotient q', 'Remainder r', 't'], eg.rows.map(r => [r.q ?? '–', r.r, r.t]))}<span class="lk-formula lk-in">d = <b>${d}</b> and check: ${e} × ${d} = ${e * d} = ${(e * d - 1) / phi} × ${phi} + 1 ✔</span>`,
          ms: 4200,
        },
        {
          title: 'Publish the public key, hide the private key',
          text: 'The padlock goes out to the world; the key stays with you.',
          html: `<div class="lk-row"><span class="lk-chip c2 lk-pop">🔓 Public (n = ${n}, e = ${e})</span><span class="lk-chip c1 lk-pop" style="--d:.3s">🔑 Private (n = ${n}, d = ${d})</span></div>`,
        },
        {
          title: `Lock the letter “${first.ch}” (code ${first.m})`,
          text: `Anyone with the public key computes <b>c = ${first.m}<sup>${e}</sup> mod ${n}</b>, by square-and-multiply so the numbers never grow huge.`,
          html: `<p class="hint">${e} in binary is <code>${trE.bits}</code>.</p>${tbl(['Bit', 'Square (mod n)', 'Multiply (mod n)', 'Running value'], trE.rows.map(r => [r.bit, r.square ?? '–', r.multiply ?? '–', { h: `<b>${r.value}</b>` }]))}<span class="lk-formula lk-in">c = <b>${first.c}</b></span>`,
          ms: 4200,
        },
        {
          title: 'Unlock it with the private key',
          text: `Only the key holder can compute <b>m = ${first.c}<sup>${d}</sup> mod ${n}</b>.`,
          html: `<p class="hint">${d} in binary is <code>${trD.bits}</code>.</p>${tbl(['Bit', 'Square (mod n)', 'Multiply (mod n)', 'Running value'], trD.rows.map(r => [r.bit, r.square ?? '–', r.multiply ?? '–', { h: `<b>${r.value}</b>` }]))}<span class="lk-formula lk-in">m = <b>${trD.result}</b> = “${String.fromCharCode(trD.result)}” ✔</span>`,
          ms: 4200,
        },
        {
          title: 'Why an attacker is stuck',
          text: `An attacker sees n = ${n} and e = ${e}. To get d they need φ, which needs p and q, which means <b>factoring ${n}</b>. With tiny numbers that is instant; with a 2048-bit n it is hopeless.`,
          html: `<span class="lk-formula lk-in">${n} = ? × ?  →  ${p} × ${key.q}</span>`,
        },
      ]);

      const f = factorTrial(n);
      const bigN = 1000003 * 1000033;
      const fb = factorTrial(bigN);
      $('#rs-atk', root).innerHTML =
        `<p>An attacker knows the public key (n = ${n}, e = ${e}). Their only route to <i>d</i> is to split n into p and q.</p>` +
        (f
          ? vd('warn', `Factored ${n} in ${f.tries.toLocaleString('en-US')} step${f.tries === 1 ? '' : 's'}: ${f.p} × ${f.q}.`, `With p and q known they compute φ = ${(f.p - 1) * (f.q - 1)} and then d = ${d}. Small keys fall at once. Try primes with six digits and the work climbs fast.`)
          : '') +
        tbl(
          ['Size of n', 'Trial divisions needed (worst case)', 'Time at a billion per second'],
          [
            [`${n}`, f ? f.tries.toLocaleString('en-US') : '–', 'instant'],
            [`${bigN.toLocaleString('en-US')} (two ~7-digit primes)`, fb ? fb.tries.toLocaleString('en-US') : '–', 'about a millisecond'],
            ['A 2048-bit n (617 digits)', 'more than 10^300', 'longer than the age of the universe'],
          ]
        ) +
        hn('Trial division is the simplest attack. Cleverer algorithms exist (number field sieve), which is why real keys are 2048 bits or more, far beyond where trial division alone would suggest. Quantum computers running Shor’s algorithm could break RSA, which is why post-quantum schemes are being rolled out.');
    }

    $('#rs-p', root).oninput = $('#rs-q', root).oninput = refresh;
    $('#rs-e', root).onchange = () => {
      flag('rsa_play');
      refresh();
    };
    $('#rs-text', root).oninput = refresh;
    $('#rs-rand', root).onclick = () => {
      let p, q;
      do {
        p = SMALL_PRIMES[Math.floor(Math.random() * SMALL_PRIMES.length)];
        q = SMALL_PRIMES[Math.floor(Math.random() * SMALL_PRIMES.length)];
      } while (p === q);
      $('#rs-p', root).value = p;
      $('#rs-q', root).value = q;
      flag('rsa_play');
      refresh();
    };
    fillE(61, 53);
    $('#rs-e', root).value = 17;
    refresh();
    return () => cleanups.forEach(f => f());
  },
});
