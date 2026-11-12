/**
 * RSA with small numbers, and toy signatures
 *
 * Textbook RSA exactly as taught: n = p*q, phi = (p-1)(q-1), e coprime to phi, d = e^-1 mod phi, c = m^e mod n,
 * m = c^d mod n. It is only for learning: real systems use 2048-bit or larger keys and padding such as OAEP/PSS.
 * The toy hash squeezes a message into a number smaller than n so it can be signed; with such small keys two different
 * messages can collide, which a real hash (SHA-256) makes astronomically unlikely.
 *
 * Imports:
 *   - ./modmath.js: egcdTrace, gcd, isPrime, modPow
 *
 * Exports: factorTrial, makeRsaKey, rsaDecrypt, rsaEncrypt, sign, toyHash, validEs, verify
 *
 * Used by: certificates.js, modules/advanced/rsa.js, modules/advanced/signatures.js, tests/security.test.mjs
 */

import { egcdTrace, gcd, isPrime, modPow } from './modmath.js';

/** Values of e (from a short list of common choices) that work for this phi. */
export const validEs = phi => [3, 5, 7, 11, 13, 17, 65537].filter(e => e < phi && gcd(e, phi) === 1);

/**
 * Builds a key pair.
 *
 * @returns {{ok:boolean, error?:string, p:number, q:number, n:number, phi:number, e:number, d:number, trace:Object}}
 */
export function makeRsaKey(p, q, e) {
  const bad = error => ({ ok: false, error, p, q, e });
  if (!isPrime(p) || !isPrime(q)) return bad('p and q must both be prime.');
  if (p === q) return bad('p and q must be different primes.');
  const phi = (p - 1) * (q - 1);
  if (!(e > 1 && e < phi) || gcd(e, phi) !== 1) return bad(`e must share no factor with φ = ${phi}.`);
  const trace = egcdTrace(e, phi);
  return { ok: true, p, q, n: p * q, phi, e, d: trace.inverse, trace };
}

export const rsaEncrypt = (m, e, n) => modPow(m, e, n);
export const rsaDecrypt = (c, d, n) => modPow(c, d, n);

/**
 * The attacker's job: find p and q from n by dividing by every number in turn.
 *
 * @returns {{p:number, q:number, tries:number}|null}
 */
export function factorTrial(n) {
  let tries = 0;
  for (let f = 2; f * f <= n; f++) {
    tries++;
    if (n % f === 0) return { p: f, q: n / f, tries };
  }
  return null;
}

/** Toy hash: 32-bit FNV-1a folded into 0..n-1. */
export function toyHash(str, n) {
  let h = 0x811c9dc5;
  const bytes = new TextEncoder().encode(String(str));
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % n;
}

/** Signature = hash^d mod n, made with the private key. */
export const sign = (msg, key) => modPow(toyHash(msg, key.n), key.d, key.n);

/**
 * Verification with the public key: undo the signature and compare with a fresh hash of what arrived.
 *
 * @returns {{hash:number, recovered:number, ok:boolean}}
 */
export function verify(msg, sig, key) {
  const hash = toyHash(msg, key.n),
    recovered = modPow(sig, key.e, key.n);
  return { hash, recovered, ok: hash === recovered };
}
