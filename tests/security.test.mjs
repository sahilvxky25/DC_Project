import test from 'node:test';
import assert from 'node:assert/strict';
import { modPow, modPowTrace, egcdTrace, modInverse, gcd, isPrime, primeFactors, primitiveRoot, bruteForceDlog } from '../js/simulations/modmath.js';
import { dhExchange, dhProblem, mitmExchange, crackYears, mixPaint, secretPaint, COMMON_PAINT, cssColor, PRIMES } from '../js/simulations/key-exchange.js';
import { makeRsaKey, rsaEncrypt, rsaDecrypt, factorTrial, validEs, toyHash, sign, verify } from '../js/simulations/rsa-toy.js';
import { buildScenario, verifyChain, SCENARIOS, certBody } from '../js/simulations/certificates.js';

/* ---------- modular arithmetic ---------- */
test('modPow agrees with direct computation and handles big exponents', () => {
  assert.equal(modPow(5, 6, 23), 8);
  assert.equal(modPow(5, 15, 23), 19);
  assert.equal(modPow(2, 10, 1000), 24);
  assert.equal(modPow(7, 0, 13), 1);
  assert.equal(modPow(3, 200, 13), 9); // 3^3 = 1 (mod 13), and 200 mod 3 = 2, so 3^200 = 3^2 = 9
  assert.equal(modPow(123456, 65537, 1022117) < 1022117, true);
});

test('modPowTrace walks the same answer and shows square-and-multiply', () => {
  const t = modPowTrace(5, 13, 23); // 13 = 1101b
  assert.equal(t.bits, '1101');
  assert.equal(t.result, modPow(5, 13, 23));
  assert.equal(t.rows.length, 4);
  assert.equal(t.rows[0].value, 5);
  assert.equal(t.rows.filter(r => r.multiply !== null).length, 2); // the 1s after the leading bit
  assert.equal(t.rows.at(-1).value, t.result);
});

test('extended Euclid finds modular inverses (RSA d)', () => {
  assert.equal(modInverse(17, 3120), 2753);
  assert.equal(modInverse(3, 11), 4);
  assert.equal(modInverse(6, 9), null);
  const t = egcdTrace(17, 3120);
  assert.equal(t.gcd, 1);
  assert.equal((17 * t.inverse) % 3120, 1);
  assert.equal(gcd(48, 18), 6);
});

test('primes, factors and primitive roots', () => {
  assert.ok(PRIMES.every(isPrime));
  assert.ok(!isPrime(1) && !isPrime(91) && isPrime(97));
  assert.deepEqual(primeFactors(360), [2, 3, 5]);
  assert.equal(primitiveRoot(23), 5);
  for (const p of PRIMES) {
    const g = primitiveRoot(p);
    const seen = new Set();
    let v = 1;
    for (let k = 1; k < p; k++) {
      v = (v * g) % p;
      seen.add(v);
    }
    assert.equal(seen.size, p - 1, `g=${g} should generate every residue mod ${p}`);
  }
});

test('brute-force discrete log finds the secret and counts tries', () => {
  const r = bruteForceDlog(23, 5, 8);
  assert.equal(r.x, 6);
  assert.equal(r.tries, 6);
  assert.equal(modPow(5, bruteForceDlog(10007, primitiveRoot(10007), 4321).x, 10007), 4321);
});

/* ---------- Diffie-Hellman ---------- */
test('Diffie-Hellman: both sides reach the same secret', () => {
  const x = dhExchange(23, 5, 6, 15);
  assert.deepEqual([x.A, x.B, x.sA, x.sB], [8, 19, 2, 2]);
  assert.ok(x.agree);
  for (const p of PRIMES) {
    const g = primitiveRoot(p);
    const e = dhExchange(p, g, 7 % (p - 2) + 1, 11 % (p - 2) + 1);
    assert.ok(e.agree, `p=${p}`);
  }
});

test('Diffie-Hellman input validation', () => {
  assert.equal(dhProblem(23, 5, 6, 15), '');
  assert.match(dhProblem(24, 5, 6, 15), /prime/);
  assert.match(dhProblem(23, 1, 6, 15), /g must/);
  assert.match(dhProblem(23, 5, 0, 15), /Alice/);
  assert.match(dhProblem(23, 5, 6, 22), /Bob/);
});

test('man-in-the-middle: each victim shares a key with Mallory, not with each other', () => {
  const m = mitmExchange(1019, primitiveRoot(1019), 77, 123, 555);
  assert.equal(m.aliceKey, m.malloryWithAlice);
  assert.equal(m.bobKey, m.malloryWithBob);
  assert.notEqual(m.aliceKey, m.bobKey);
});

test('cracking time grows with key size', () => {
  assert.ok(crackYears(2048) > crackYears(64));
  assert.ok(crackYears(2048) > 500); // more than 10^500 years
  assert.ok(crackYears(32) < 0); // a 32-bit prime falls in well under a year
});

test('paint mixing is commutative, which is what lets both sides reach one colour', () => {
  const a = secretPaint(6),
    b = secretPaint(15);
  const alice = mixPaint(mixPaint(COMMON_PAINT, a), b),
    bob = mixPaint(mixPaint(COMMON_PAINT, b), a);
  assert.equal(cssColor(alice), cssColor(bob));
  assert.notEqual(cssColor(mixPaint(COMMON_PAINT, a)), cssColor(mixPaint(COMMON_PAINT, b)));
  assert.equal(alice.w, 3);
});

/* ---------- RSA ---------- */
test('RSA matches the textbook example (p=61, q=53, e=17)', () => {
  const k = makeRsaKey(61, 53, 17);
  assert.ok(k.ok);
  assert.deepEqual([k.n, k.phi, k.d], [3233, 3120, 2753]);
  assert.equal(rsaEncrypt(65, k.e, k.n), 2790);
  assert.equal(rsaDecrypt(2790, k.d, k.n), 65);
});

test('RSA round-trips every message below n and rejects bad keys', () => {
  const k = makeRsaKey(61, 53, 17);
  for (let m = 0; m < k.n; m += 37) assert.equal(rsaDecrypt(rsaEncrypt(m, k.e, k.n), k.d, k.n), m);
  assert.equal(makeRsaKey(60, 53, 17).ok, false);
  assert.equal(makeRsaKey(61, 61, 17).ok, false);
  assert.equal(makeRsaKey(61, 53, 4).ok, false); // shares factor 4 with φ=3120
  assert.ok(validEs(3120).includes(17) && !validEs(3120).includes(5)); // 3120 is divisible by 5
});

test('the attacker can factor a small n but the work grows with its size', () => {
  const f = factorTrial(3233);
  assert.deepEqual([f.p, f.q], [53, 61]);
  assert.ok(factorTrial(1019 * 1021).tries > factorTrial(3233).tries);
  assert.equal(factorTrial(97), null);
});

/* ---------- signatures ---------- */
test('signatures verify, and fail when the message or signature is changed', () => {
  const key = makeRsaKey(1009, 1013, 65537);
  const msg = 'Pay Asha 100 rupees';
  const sig = sign(msg, key);
  assert.ok(verify(msg, sig, key).ok);
  assert.ok(!verify('Pay Asha 900 rupees', sig, key).ok);
  assert.ok(!verify(msg, (sig + 1) % key.n, key).ok);
  assert.ok(toyHash('abc', key.n) < key.n);
  assert.equal(toyHash('abc', key.n), toyHash('abc', key.n));
});

/* ---------- certificates ---------- */
test('certificate scenarios: valid passes, every attack fails on the right check', () => {
  const run = id => {
    const s = buildScenario(id);
    return verifyChain(s.chain, s.trust, s.hostname, s.now);
  };
  assert.ok(run('valid').ok);
  const failed = id => run(id).checks.filter(c => !c.ok).map(c => c.id);
  assert.deepEqual(failed('expired'), ['date0']);
  assert.deepEqual(failed('wrongname'), ['name']);
  assert.ok(failed('untrusted').includes('anchor'));
  assert.ok(failed('tampered').includes('sig0'));
  assert.ok(!failed('tampered').includes('sig1'));
  assert.ok(failed('selfsigned').includes('anchor'));
  assert.equal(SCENARIOS.length, 6);
});

test('a certificate body covers every field, so changing any one breaks the signature', () => {
  const s = buildScenario('valid');
  const leaf = s.chain[0];
  for (const change of [{ names: ['evil.example'] }, { notAfter: '2099-01-01' }, { subject: 'x' }, { isCA: true }, { key: { n: leaf.key.n + 2, e: leaf.key.e } }]) {
    assert.notEqual(certBody({ ...leaf, ...change }), certBody(leaf));
  }
});
