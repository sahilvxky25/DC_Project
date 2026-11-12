/**
 * learning module: Key exchange (Diffie-Hellman)
 *
 * Two people agree on a secret key in public. Shown three ways at once: the classic paint-mixing picture, the real
 * modular arithmetic (with square-and-multiply worked out), and an eavesdropper trying to break it. A man-in-the-middle
 * panel shows why an exchange with no authentication can still be hijacked. Layered explanations and animated
 * "show the working" players are included.
 *
 * Imports:
 *   - ../../core/ui-helpers.js: hn, panel, sel, statRow, tbl, vd
 *   - ../../core/utils.js: $, esc
 *   - ../../core/learn-kit.js: kitStyles, layers, showWorking, swatch
 *   - ../../simulations/modmath.js: bruteForceDlog, modPowTrace, primitiveRoot
 *   - ../../simulations/key-exchange.js: COMMON_PAINT, PRIMES, cssColor, dhExchange, dhProblem, mitmExchange, mixPaint, secretPaint, crackYears
 *   - ../registry.js: regMod
 *   - ../../app/progress.js: flag
 *
 * Exports: (none)
 *
 * Used by: (imported only for its side effects by app.js)
 */

import { hn, panel, sel, statRow, tbl, vd } from '../../core/ui-helpers.js';
import { $, esc } from '../../core/utils.js';
import { kitStyles, layers, showWorking, swatch } from '../../core/learn-kit.js';
import { bruteForceDlog, modPowTrace, primitiveRoot } from '../../simulations/modmath.js';
import { COMMON_PAINT, PRIMES, crackYears, cssColor, dhExchange, dhProblem, mitmExchange, mixPaint, secretPaint } from '../../simulations/key-exchange.js';
import { regMod } from '../registry.js';
import { flag } from '../../app/progress.js';

const EXPLAIN = {
  analogy: {
    emoji: '🎨',
    title: 'Mixing paint in front of everyone',
    text: 'Alice and Bob stand in a room full of spies and want a paint colour that only they know. They agree out loud on a <b>common yellow</b>. Each secretly picks a <b>private colour</b> and mixes it into a pot of the yellow, then hands the pot across (the spies see both pots). Each then mixes their <i>own</i> private colour into the pot they received. Both end up with yellow + Alice’s colour + Bob’s colour: <b>the same final shade</b>. The spies cannot get there, because they cannot un-mix a pot to get the private colour out.',
  },
  plain: `<p>How can two people who have never met agree on a secret code <i>while everyone is listening</i>? It sounds impossible, but <b>Diffie–Hellman key exchange</b> does exactly that, and it protects almost every secure website you visit.</p>
    <p>The trick is a step that is easy to do but practically impossible to undo, like mixing paint. Each side mixes in something secret, and they swap the mixtures. Because the order of mixing does not matter, both end up with the same result, and an eavesdropper who only ever saw the mixtures cannot work it out.</p>
    <p>Press <b>“Show the working”</b> below to watch it happen with colours and numbers side by side.</p>`,
  how: `<ol><li>Alice and Bob publicly agree on two numbers: a prime <b>p</b> and a base <b>g</b>. (The common yellow.)</li>
    <li>Alice picks a secret number <b>a</b>; Bob picks a secret <b>b</b>. They never share these. (The private colours.)</li>
    <li>Alice sends <b>A = gᵃ mod p</b>. Bob sends <b>B = gᵇ mod p</b>. (The first mixed pots, which go across the room.)</li>
    <li>Alice computes <b>s = Bᵃ mod p</b>. Bob computes <b>s = Aᵇ mod p</b>. (Each mixes their own colour into what they received.)</li>
    <li>Both get <b>s = gᵃᵇ mod p</b>. That is the shared secret, usable as an encryption key.</li></ol>
    <p>“mod p” means “the remainder after dividing by p”. It keeps the numbers inside a fixed range and is what makes the step hard to reverse.</p>`,
  deep: `<p><b>Why the shortcut works.</b> (gᵃ)ᵇ = gᵃᵇ = (gᵇ)ᵃ. Multiplication of exponents does not care about order, just as mixing paint does not.</p>
    <p><b>Why it is hard to break.</b> Going forward (computing gᵃ mod p) is fast, using square-and-multiply, as shown in the working. Going backward (finding a from A) is the <b>discrete logarithm problem</b>. For well-chosen large primes, no known classical algorithm solves it in practical time.</p>
    <p><b>Real sizes.</b> The primes here are tiny so you can follow the arithmetic, and the eavesdropper breaks them in moments. Real deployments use 2048-bit or larger groups, or elliptic curves (ECDH), where the same idea works on points of a curve. TLS 1.3 uses ephemeral ECDH, giving <b>forward secrecy</b>: a fresh secret per session, so stealing a server key later does not unlock past traffic.</p>
    <p><b>The generator.</b> g should be a primitive root of p, so that its powers visit every number from 1 to p−1. Then A could be any of p−1 values and a spy has the most possibilities to search. A poor g trapped in a short cycle shrinks that search.</p>
    <p><b>What it does not do.</b> Diffie–Hellman gives a shared secret, but not <i>identity</i>. Nothing proves that the other end is really Bob. The man-in-the-middle panel shows the consequence, which is why TLS adds certificates and signatures.</p>
    <p><b>Where the paint analogy stops.</b> Real paint can in principle be separated again with enough chemistry, whereas the maths has no known cheap shortcut. Mixing also adds colours, while the real operation is exponentiation in modular arithmetic. And in the picture the final colour is just an illustration: the real key is a number.</p>`,
  map: [
    ['The common yellow everyone hears', 'The public numbers p and g'],
    ['Alice’s private colour', 'Her secret number a'],
    ['Alice’s mixed pot, passed across the room', 'A = gᵃ mod p, sent in the open'],
    ['Mixing your colour into the pot you received', 'Raising the received value to your own secret'],
    ['The final shade both end up with', 'The shared secret s = gᵃᵇ mod p'],
    ['Spies who cannot un-mix paint', 'The discrete-logarithm problem'],
  ],
};

const order = (g, p) => {
  let v = g % p,
    k = 1;
  while (v !== 1 && k <= p) {
    v = (v * g) % p;
    k++;
  }
  return k;
};

const fmtYears = log10 => (log10 < -7 ? 'a fraction of a second' : log10 < 0 ? `${Math.pow(10, log10 + 7.5).toFixed(0)} days or less` : log10 < 4 ? `${Math.pow(10, log10).toLocaleString('en-US', { maximumFractionDigits: 0 })} years` : `about 10^${Math.round(log10)} years`);

regMod({
  id: 'keyexchange',
  group: 'adv',
  title: 'Key exchange: sharing a secret in public',
  desc: 'See Diffie–Hellman as paint mixing and as real numbers, watch an eavesdropper fail, and see how a man in the middle can still win.',
  obj: [
    'Describe how two parties agree on a shared secret over an open channel.',
    'Compute gᵃ mod p by square-and-multiply and follow both sides to the same key.',
    'Explain why an unauthenticated exchange is vulnerable to a man in the middle.',
  ],
  mount(root) {
    kitStyles();
    root.innerHTML =
      panel('Learn it at your level', '<div id="kx-layers"></div>') +
      panel(
        'Choose the numbers',
        `<div class="controls"><div class="field"><label for="kx-p">Prime p (public)</label>${sel('kx-p', PRIMES.map(v => [v, v.toLocaleString('en-US')]), 23)}</div>
        <div class="field"><label for="kx-g">Base g (public)</label><input id="kx-g" type="number" min="2" value="5"></div>
        <div class="field"><label for="kx-a">Alice’s secret a</label><input id="kx-a" type="number" min="1" value="6"></div>
        <div class="field"><label for="kx-b">Bob’s secret b</label><input id="kx-b" type="number" min="1" value="15"></div>
        <div class="btnrow"><button class="btn ghost sm" id="kx-rand" type="button">🎲 Pick secrets for me</button></div></div><div id="kx-msg"></div>`,
        'The default example (p = 23, g = 5) is small enough to check by hand.'
      ) +
      panel('What each side knows', '<div id="kx-know"></div>') +
      panel('Show the working: paint and numbers together', '<div id="kx-work"></div>', 'A step-by-step animation of the whole exchange.') +
      panel('The eavesdropper’s problem', '<div id="kx-eve"></div>') +
      panel('Where this goes wrong: the man in the middle', '<div id="kx-mitm"></div>', 'The exchange is secure against listening, but not against someone who can change the messages.');
    const cleanups = [layers($('#kx-layers', root), EXPLAIN)];
    const work = showWorking($('#kx-work', root), { onOpen: () => flag('kx_working') });
    cleanups.push(() => work.destroy());

    const num = id => Math.floor(Number($('#' + id, root).value));

    function refresh() {
      const p = num('kx-p'),
        g = num('kx-g'),
        a = num('kx-a'),
        b = num('kx-b');
      const problem = dhProblem(p, g, a, b);
      if (problem) {
        $('#kx-msg', root).innerHTML = vd('warn', 'Check your numbers.', esc(problem));
        $('#kx-know', root).innerHTML = $('#kx-eve', root).innerHTML = $('#kx-mitm', root).innerHTML = '';
        work.setSteps([]);
        return;
      }
      const x = dhExchange(p, g, a, b),
        ord = order(g, p);
      $('#kx-msg', root).innerHTML =
        ord < p - 1
          ? vd('info', `g = ${g} is not a primitive root of ${p}.`, `Its powers only reach ${ord} of the ${p - 1} possible values, so a spy has fewer numbers to try. The smallest generator is ${x.generator}.`)
          : '';
      const pa = secretPaint(a),
        pb = secretPaint(b),
        potA = mixPaint(COMMON_PAINT, pa),
        potB = mixPaint(COMMON_PAINT, pb),
        finalA = mixPaint(potB, pa),
        finalB = mixPaint(potA, pb);
      const col = c => cssColor(c);

      $('#kx-know', root).innerHTML =
        `<div class="lk-row" style="align-items:flex-start;gap:28px"><div><h4>Alice</h4>${tbl(['Knows', 'Value'], [['p, g (public)', `${p}, ${g}`], ['her secret a', { h: `<b>${a}</b>` }], ['A = gᵃ mod p', `${g}^${a} mod ${p} = ${x.A}`], ['B (from Bob)', x.B], ['s = Bᵃ mod p', `${x.B}^${a} mod ${p} = ${x.sA}`]])}</div>` +
        `<div><h4>Bob</h4>${tbl(['Knows', 'Value'], [['p, g (public)', `${p}, ${g}`], ['his secret b', { h: `<b>${b}</b>` }], ['B = gᵇ mod p', `${g}^${b} mod ${p} = ${x.B}`], ['A (from Alice)', x.A], ['s = Aᵇ mod p', `${x.A}^${b} mod ${p} = ${x.sB}`]])}</div></div>` +
        statRow([[x.A, 'A (sent in the open)'], [x.B, 'B (sent in the open)'], [x.sA, 'shared secret']]) +
        (x.agree ? vd('ok', 'Both sides computed the same secret.', `s = ${x.sA}`) : vd('bad', 'The secrets differ.', 'This should never happen.'));

      const trA = modPowTrace(g, a, p),
        trB = modPowTrace(g, b, p);
      const traceHtml = (tr, base, exp) =>
        `<p class="hint">Computing ${base}<sup>${exp}</sup> mod ${p}. ${exp} in binary is <code>${tr.bits}</code>. Start with ${base}; for each further bit, square, and multiply by ${base} again if the bit is 1.</p>` +
        tbl(['Bit', 'Square (mod p)', 'Multiply (mod p)', 'Running value'], tr.rows.map(r => [r.bit, r.square ?? '–', r.multiply ?? '–', { h: `<b>${r.value}</b>` }]));
      const potRow = (items, cls = '') => `<div class="lk-row ${cls}">${items.join('<span class="lk-op">＋</span>')}</div>`;
      work.setSteps([
        {
          title: 'Agree on public numbers (the common yellow)',
          text: `Out loud, in front of everyone, Alice and Bob agree on <b>p = ${p}</b> and <b>g = ${g}</b>. In the picture: a common yellow paint.`,
          html: `<div class="lk-row lk-in">${swatch(col(COMMON_PAINT), 'Common yellow', 'public')}<span class="lk-formula">p = ${p}, g = ${g}</span></div>`,
        },
        {
          title: 'Each picks a private secret',
          text: `Alice secretly picks <b>a = ${a}</b>, Bob secretly picks <b>b = ${b}</b>. These never leave their heads. In the picture, each has a private colour.`,
          html: `<div class="lk-row"><div class="lk-slide">${swatch(col(pa), 'Alice’s private colour', `a = ${a}`)}</div><div class="lk-slide" style="--d:.3s">${swatch(col(pb), 'Bob’s private colour', `b = ${b}`)}</div></div>`,
        },
        {
          title: 'Alice makes her public value',
          text: `Alice computes <b>A = ${g}<sup>${a}</sup> mod ${p} = ${x.A}</b> (square-and-multiply, below). In the picture: she mixes her private colour into the common yellow.`,
          html: `${potRow([swatch(col(COMMON_PAINT), 'Yellow'), swatch(col(pa), 'Alice’s colour')])}<div class="lk-row lk-in" style="--d:.3s"><span class="lk-op">⇒</span>${swatch(col(potA), 'Alice’s mixed pot', `A = ${x.A}`)}</div>${traceHtml(trA, g, a)}`,
          ms: 4200,
        },
        {
          title: 'Bob makes his public value',
          text: `Bob computes <b>B = ${g}<sup>${b}</sup> mod ${p} = ${x.B}</b>, and mixes his private colour into the common yellow in the picture.`,
          html: `${potRow([swatch(col(COMMON_PAINT), 'Yellow'), swatch(col(pb), 'Bob’s colour')])}<div class="lk-row lk-in" style="--d:.3s"><span class="lk-op">⇒</span>${swatch(col(potB), 'Bob’s mixed pot', `B = ${x.B}`)}</div>${traceHtml(trB, g, b)}`,
          ms: 4200,
        },
        {
          title: 'They swap the mixed pots in public',
          text: `Alice sends <b>A = ${x.A}</b> and Bob sends <b>B = ${x.B}</b>. A spy sees both, but cannot see the private colours inside them.`,
          html: `<div class="lk-row" style="justify-content:space-between"><div class="lk-slide">${swatch(col(potA), 'A', `${x.A} →`)}</div><div class="lk-slide" style="--d:.2s">${swatch(col(potB), '← B', `${x.B}`)}</div></div><p class="hint">👁 A spy knows: p = ${p}, g = ${g}, A = ${x.A}, B = ${x.B}. Not a or b.</p>`,
        },
        {
          title: 'Alice mixes in her colour again',
          text: `Alice takes Bob’s pot and adds her own private colour: <b>s = ${x.B}<sup>${a}</sup> mod ${p} = ${x.sA}</b>.`,
          html: `${potRow([swatch(col(potB), 'Bob’s pot', `B = ${x.B}`), swatch(col(pa), 'Alice’s colour')])}<div class="lk-row lk-in" style="--d:.3s"><span class="lk-op">⇒</span>${swatch(col(finalA), 'Alice’s result', `s = ${x.sA}`)}</div>`,
        },
        {
          title: 'Bob mixes in his colour again',
          text: `Bob takes Alice’s pot and adds his private colour: <b>s = ${x.A}<sup>${b}</sup> mod ${p} = ${x.sB}</b>.`,
          html: `${potRow([swatch(col(potA), 'Alice’s pot', `A = ${x.A}`), swatch(col(pb), 'Bob’s colour')])}<div class="lk-row lk-in" style="--d:.3s"><span class="lk-op">⇒</span>${swatch(col(finalB), 'Bob’s result', `s = ${x.sB}`)}</div>`,
        },
        {
          title: 'The same secret, never sent',
          text: `Both reach <b>${x.sA}</b>. Yellow + Alice’s colour + Bob’s colour is the same shade whichever order you mix. The shared secret was never sent over the network.`,
          html: `<div class="lk-row">${swatch(col(finalA), 'Alice’s', `s = ${x.sA}`)}<span class="lk-op">=</span>${swatch(col(finalB), 'Bob’s', `s = ${x.sB}`)}</div><span class="lk-formula">(${g}<sup>${a}</sup>)<sup>${b}</sup> = ${g}<sup>${a}·${b}</sup> = (${g}<sup>${b}</sup>)<sup>${a}</sup> (mod ${p})</span>`,
        },
      ]);

      // Eavesdropper
      const dl = bruteForceDlog(p, g, x.A);
      $('#kx-eve', root).innerHTML =
        `<p>A spy sees <b>p = ${p}</b>, <b>g = ${g}</b>, <b>A = ${x.A}</b> and <b>B = ${x.B}</b>. To find the secret they must discover <i>a</i> (or <i>b</i>): the exponent that turns ${g} into ${x.A}. The only general method is trying exponents one at a time.</p>` +
        (dl.x !== null
          ? vd('warn', `Found it after ${dl.tries.toLocaleString('en-US')} tries: a = ${dl.x}.`, `That was easy because p is tiny. Choose a bigger prime above and watch the number of tries grow. Real systems use primes of 2048 bits (about 600 digits).`)
          : vd('info', 'Not found within the search limit.', 'The search was cut off to keep the page fast.')) +
        `<h4>How the work grows with the size of the prime</h4>` +
        tbl(
          ['Prime size', 'Numbers to try (about)', 'Time at a billion guesses per second'],
          [16, 32, 64, 128, 256, 2048].map(bits => [`${bits} bits`, bits <= 64 ? (2 ** bits).toLocaleString('en-US', { maximumFractionDigits: 0 }) : `about 10^${Math.round(bits * Math.log10(2))}`, fmtYears(crackYears(bits))])
        ) +
        hn('Smarter attacks than guessing exist, so real key sizes are chosen much larger than this table suggests. The table shows the trend: every extra bit doubles the work.');

      // MITM
      const m = 7 + ((a * 3 + b) % Math.max(2, p - 9));
      const mm = mitmExchange(p, g, a, b, Math.min(Math.max(2, m), p - 2));
      const pm = secretPaint(Math.min(Math.max(2, m), p - 2));
      const potM = mixPaint(COMMON_PAINT, pm);
      const aliceF = mixPaint(potM, pa),
        bobF = mixPaint(potM, pb);
      $('#kx-mitm', root).innerHTML =
        `<p>Mallory sits between Alice and Bob and can change what they send. She swaps in <b>her own</b> public value <b>M = ${mm.M}</b> in both directions.</p>` +
        `<div class="lk-row" style="gap:18px;align-items:flex-start"><div>${swatch(col(aliceF), 'Alice’s “shared” colour', `key ${mm.aliceKey}`)}</div><div>${swatch(col(bobF), 'Bob’s “shared” colour', `key ${mm.bobKey}`)}</div></div>` +
        tbl(
          ['Who', 'Thinks they share a key with', 'Key'],
          [
            ['Alice', 'Bob', mm.aliceKey],
            ['Bob', 'Alice', mm.bobKey],
            ['Mallory', 'Alice (really)', mm.malloryWithAlice],
            ['Mallory', 'Bob (really)', mm.malloryWithBob],
          ]
        ) +
        vd(
          mm.aliceKey !== mm.bobKey ? 'bad' : 'info',
          mm.aliceKey !== mm.bobKey ? 'Alice and Bob now hold different keys, and Mallory holds both.' : 'Mallory happened to pick a value that gives matching keys.',
          'Mallory decrypts each message with one key, reads it, and re-encrypts it with the other. Neither victim notices anything wrong. The fix is <b>authentication</b>: proving who sent each public value, using signatures and certificates (see the next lessons).'
        );
    }

    $('#kx-p', root).onchange = () => {
      const p = num('kx-p'),
        g = primitiveRoot(p);
      $('#kx-g', root).value = g;
      $('#kx-a', root).value = Math.min(num('kx-a'), p - 2);
      $('#kx-b', root).value = Math.min(num('kx-b'), p - 2);
      refresh();
    };
    ['kx-g', 'kx-a', 'kx-b'].forEach(id => {
      $('#' + id, root).oninput = refresh;
    });
    $('#kx-rand', root).onclick = () => {
      const p = num('kx-p');
      $('#kx-a', root).value = 2 + Math.floor(Math.random() * (p - 4));
      $('#kx-b', root).value = 2 + Math.floor(Math.random() * (p - 4));
      flag('kx_play');
      refresh();
    };
    refresh();
    return () => cleanups.forEach(f => f());
  },
});
