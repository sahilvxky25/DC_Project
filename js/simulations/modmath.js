/**
 * modular arithmetic helpers with step traces
 *
 * The number theory behind Diffie-Hellman and RSA, written so the working can be shown: modPowTrace() returns every
 * square-and-multiply step and egcdTrace() returns the extended Euclid table. Arithmetic uses BigInt internally so large
 * exponents never overflow; results are returned as ordinary numbers (callers keep moduli below 2^53).
 *
 * Imports: (none)
 *
 * Exports: bruteForceDlog, egcdTrace, gcd, isPrime, modInverse, modPow, modPowTrace, primeFactors, primitiveRoot
 *
 * Used by: key-exchange.js, rsa-toy.js, certificates.js, tests/security.test.mjs
 */

const B = BigInt;

/** base^exp mod m. */
export function modPow(base, exp, m) {
  let r = 1n,
    b = B(base) % B(m),
    e = B(exp);
  const mm = B(m);
  if (mm === 1n) return 0;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % mm;
    b = (b * b) % mm;
    e >>= 1n;
  }
  return Number(r);
}

/**
 * Square-and-multiply, one row per exponent bit (left to right).
 *
 * @returns {{result:number, bits:string, rows:{bit:string, square:(number|null), multiply:(number|null), value:number}[]}}
 */
export function modPowTrace(base, exp, m) {
  const bits = B(exp).toString(2),
    mm = B(m);
  let acc = B(base) % mm;
  const rows = [{ bit: bits[0], square: null, multiply: null, value: Number(acc) }];
  for (let k = 1; k < bits.length; k++) {
    acc = (acc * acc) % mm;
    const square = Number(acc);
    let multiply = null;
    if (bits[k] === '1') {
      acc = (acc * (B(base) % mm)) % mm;
      multiply = Number(acc);
    }
    rows.push({ bit: bits[k], square, multiply, value: Number(acc) });
  }
  return { result: Number(acc), bits, rows };
}

export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

/**
 * Extended Euclid on (m, a): the table behind "find d with a*d = 1 mod m".
 *
 * @returns {{gcd:number, inverse:(number|null), rows:{q:(number|null), r:number, t:number}[]}}
 *   Each row satisfies r = t * a (mod m); the inverse exists when the last non-zero remainder (the gcd) is 1.
 */
export function egcdTrace(a, m) {
  let r0 = m,
    r1 = a % m,
    t0 = 0,
    t1 = 1;
  const rows = [
    { q: null, r: r0, t: t0 },
    { q: null, r: r1, t: t1 },
  ];
  while (r1 !== 0) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
    rows.push({ q, r: r1, t: t1 });
  }
  const g = r0;
  return { gcd: g, inverse: g === 1 ? ((t0 % m) + m) % m : null, rows };
}

export const modInverse = (a, m) => egcdTrace(a, m).inverse;

/** Trial-division primality test, fine for the small numbers used in lessons. */
export function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

/** Distinct prime factors of n. */
export function primeFactors(n) {
  const out = [];
  for (let p = 2; p * p <= n; p++)
    if (n % p === 0) {
      out.push(p);
      while (n % p === 0) n /= p;
    }
  if (n > 1) out.push(n);
  return out;
}

/** Smallest primitive root of the prime p (a generator g whose powers hit every number 1..p-1). */
export function primitiveRoot(p) {
  const fs = primeFactors(p - 1);
  for (let g = 2; g < p; g++) if (fs.every(q => modPow(g, (p - 1) / q, p) !== 1)) return g;
  return null;
}

/**
 * Finds x with g^x = target (mod p) by trying exponents one after another, the way an eavesdropper would.
 *
 * @returns {{x:(number|null), tries:number}}
 */
export function bruteForceDlog(p, g, target, limit = 5e6) {
  let v = 1,
    tries = 0;
  for (let x = 1; x <= Math.min(p - 1, limit); x++) {
    v = Number((B(v) * B(g)) % B(p));
    tries++;
    if (v === target % p) return { x, tries };
  }
  return { x: null, tries };
}
