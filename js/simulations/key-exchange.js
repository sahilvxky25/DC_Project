/**
 * Diffie-Hellman key exchange, plus the paint-mixing picture of it
 *
 * dhExchange() does the real arithmetic with small numbers. The colour helpers model "mixing paint" as adding pigment
 * amounts, which is commutative (the order of mixing does not matter), exactly the property the maths relies on.
 * mitmExchange() shows why an exchange with no authentication is not safe against an attacker in the middle.
 *
 * Imports:
 *   - ./modmath.js: isPrime, modPow, primitiveRoot
 *
 * Exports: COMMON_PAINT, PRIMES, crackYears, cssColor, dhExchange, dhProblem, mitmExchange, mixPaint, secretPaint
 *
 * Used by: modules/advanced/key-exchange.js, tests/security.test.mjs
 */

import { isPrime, modPow, primitiveRoot } from './modmath.js';

/** Prime choices offered in the module, from tiny (hand-checkable) to six digits. */
export const PRIMES = [23, 97, 1019, 10007, 100003];

/**
 * Checks the learner's choices; returns an error message or '' when fine.
 */
export function dhProblem(p, g, a, b) {
  if (!isPrime(p)) return 'p must be a prime number.';
  if (!Number.isInteger(g) || g < 2 || g >= p) return 'g must be a whole number between 2 and p − 1.';
  for (const [name, v] of [
    ['Alice’s secret', a],
    ['Bob’s secret', b],
  ])
    if (!Number.isInteger(v) || v < 1 || v > p - 2) return `${name} must be a whole number from 1 to ${p - 2}.`;
  return '';
}

/**
 * The full exchange. A = g^a mod p and B = g^b mod p travel in the open; both sides then compute the same secret.
 */
export function dhExchange(p, g, a, b) {
  const A = modPow(g, a, p),
    B = modPow(g, b, p),
    sA = modPow(B, a, p),
    sB = modPow(A, b, p);
  return { p, g, a, b, A, B, sA, sB, agree: sA === sB, generator: primitiveRoot(p) };
}

/**
 * Man-in-the-middle: Mallory swaps in her own public value M = g^m for both sides. Alice and Bob each end up sharing a
 * key with Mallory, not with each other, and neither can tell.
 */
export function mitmExchange(p, g, a, b, m) {
  const A = modPow(g, a, p),
    B = modPow(g, b, p),
    M = modPow(g, m, p);
  return {
    A,
    B,
    M,
    aliceKey: modPow(M, a, p),
    bobKey: modPow(M, b, p),
    malloryWithAlice: modPow(A, m, p),
    malloryWithBob: modPow(B, m, p),
  };
}

/**
 * Rough time for an attacker to brute-force a k-bit prime at a billion guesses per second, as log10(years).
 */
export const crackYears = (bits, perSecond = 1e9) => bits * Math.log10(2) - Math.log10(perSecond) - Math.log10(31557600);

/* ---- paint ----
   A paint is { v: [r,g,b] pigment amounts, w: how many pots went in }. Mixing adds both, so mix(a,b) equals mix(b,a). */
export const COMMON_PAINT = { v: [245, 205, 40], w: 1 };

const hsl = (h, s, l) => {
  const k = n => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l),
    f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
};

/** A learner's secret number turned into a paint colour (the same number always gives the same colour). */
export const secretPaint = n => ({ v: hsl((n * 47) % 360, 0.72, 0.5), w: 1 });

/** Pours paints together. */
export const mixPaint = (...ps) => ({
  v: [0, 1, 2].map(c => ps.reduce((s, p) => s + p.v[c], 0)),
  w: ps.reduce((s, p) => s + p.w, 0),
});

/** CSS colour of a paint: the pigment amounts divided by the number of pots. */
export const cssColor = p => `rgb(${p.v.map(x => Math.round(x / p.w)).join(',')})`;
