/**
 * certificate chains: how a browser decides to trust a site
 *
 * A tiny model of X.509 validation. A certificate says "this public key belongs to this name", and it is signed by the
 * issuer. The browser walks from the site's certificate up to a root it already trusts, checking the name, the dates, every
 * signature and that each issuer is allowed to issue certificates. Signatures use the toy RSA from rsa-toy.js.
 *
 * Dates are ISO strings (YYYY-MM-DD); the demo pretends today is DEMO_NOW so results never change.
 *
 * Imports:
 *   - ./rsa-toy.js: makeRsaKey, sign, verify
 *
 * Exports: DEMO_NOW, SCENARIOS, buildScenario, certBody, verifyChain
 *
 * Used by: modules/advanced/signatures.js, tests/security.test.mjs
 */

import { makeRsaKey, sign, verify } from './rsa-toy.js';

export const DEMO_NOW = '2026-06-01';

const KEYS = {
  root: makeRsaKey(1009, 1013, 65537),
  inter: makeRsaKey(1019, 1021, 65537),
  site: makeRsaKey(1031, 1033, 65537),
  other: makeRsaKey(1039, 1049, 65537),
};

/** The text a certificate signature covers. */
export const certBody = c =>
  [c.subject, c.issuer, c.notBefore, c.notAfter, c.isCA ? 'CA' : 'leaf', c.key.n, c.key.e, c.names.join(',')].join('|');

const pub = k => ({ n: k.n, e: k.e });

/** Creates a certificate and signs it with the issuer's private key. */
function issue({ subject, issuer, notBefore = '2025-01-01', notAfter = '2027-12-31', isCA = false, names = [], key, signer }) {
  const c = { subject, issuer, notBefore, notAfter, isCA, names, key: pub(key) };
  c.signature = sign(certBody(c), signer);
  return c;
}

export const SCENARIOS = [
  { id: 'valid', name: 'Everything is in order', lesson: 'Name, dates, signatures and root all check out, so the padlock appears.' },
  { id: 'expired', name: 'Site certificate has expired', lesson: 'The signatures are fine but the certificate is past its end date, so browsers refuse it.' },
  { id: 'wrongname', name: 'Certificate is for a different name', lesson: 'A valid certificate for another site cannot be used for this one: the name must match.' },
  { id: 'untrusted', name: 'Root is not in the trust store', lesson: 'The chain is internally consistent, but nobody the browser trusts vouches for it.' },
  { id: 'tampered', name: 'Certificate was altered after signing', lesson: 'Changing even one field breaks the issuer’s signature, which is how forgery is caught.' },
  { id: 'selfsigned', name: 'Self-signed certificate', lesson: 'Anyone can sign their own certificate; trust only comes from an issuer you already know.' },
];

/**
 * Builds the chain (site first), the browser's trust store and the name being visited for a scenario.
 *
 * @returns {{chain:Object[], trust:Object[], hostname:string, now:string, scenario:Object}}
 */
export function buildScenario(id) {
  const scenario = SCENARIOS.find(s => s.id === id) || SCENARIOS[0];
  const root = issue({ subject: 'Example Root CA', issuer: 'Example Root CA', isCA: true, key: KEYS.root, signer: KEYS.root, notAfter: '2035-12-31' });
  const inter = issue({ subject: 'Example Issuing CA', issuer: 'Example Root CA', isCA: true, key: KEYS.inter, signer: KEYS.root, notAfter: '2031-12-31' });
  const siteBase = { subject: 'shop.example.com', issuer: 'Example Issuing CA', names: ['shop.example.com'], key: KEYS.site, signer: KEYS.inter };
  let site = issue(siteBase),
    chain = [site, inter, root],
    trust = [{ subject: root.subject, key: root.key }],
    hostname = 'shop.example.com';
  if (id === 'expired') {
    site = issue({ ...siteBase, notAfter: '2026-01-15' });
    chain = [site, inter, root];
  } else if (id === 'wrongname') {
    site = issue({ ...siteBase, subject: 'blog.example.com', names: ['blog.example.com'] });
    chain = [site, inter, root];
  } else if (id === 'untrusted') {
    trust = [{ subject: 'Some Other Root CA', key: pub(KEYS.other) }];
  } else if (id === 'tampered') {
    site = { ...site, names: ['shop.example.com', 'bank.example.net'] };
    chain = [site, inter, root];
  } else if (id === 'selfsigned') {
    site = issue({ ...siteBase, issuer: 'shop.example.com', signer: KEYS.site });
    chain = [site];
  }
  return { chain, trust, hostname, now: DEMO_NOW, scenario };
}

/**
 * Validates a chain the way a browser does and lists every check with its result.
 *
 * @param {Object[]} chain - certificates, site first, root (or the last one supplied) last.
 * @param {{subject:string, key:{n:number,e:number}}[]} trust - roots the browser already trusts.
 * @returns {{ok:boolean, checks:{id:string, label:string, ok:boolean, detail:string}[]}}
 */
export function verifyChain(chain, trust, hostname, now) {
  const checks = [],
    add = (id, label, ok, detail) => checks.push({ id, label, ok, detail });
  const leaf = chain[0];
  const nameOk = leaf.names.includes(hostname);
  add('name', `Does the certificate name match “${hostname}”?`, nameOk, nameOk ? `Yes: it lists ${leaf.names.join(', ')}.` : `No: it is issued for ${leaf.names.join(', ') || 'nothing'}.`);
  chain.forEach((c, i) => {
    const ok = c.notBefore <= now && now <= c.notAfter;
    add(`date${i}`, `Is “${c.subject}” within its dates?`, ok, ok ? `Valid ${c.notBefore} to ${c.notAfter}.` : now > c.notAfter ? `Expired on ${c.notAfter}.` : `Not valid until ${c.notBefore}.`);
  });
  chain.forEach((c, i) => {
    const issuerCert = chain[i + 1],
      selfSigned = c.subject === c.issuer;
    const trusted = trust.find(t => t.subject === c.issuer);
    const signerKey = issuerCert ? issuerCert.key : selfSigned ? c.key : trusted ? trusted.key : null;
    if (!signerKey) {
      add(`sig${i}`, `Is the signature on “${c.subject}” valid?`, false, `The issuer “${c.issuer}” is unknown, so the signature cannot be checked.`);
      return;
    }
    const v = verify(certBody(c), c.signature, { n: signerKey.n, e: signerKey.e });
    add(`sig${i}`, `Is the signature on “${c.subject}” valid?`, v.ok, v.ok ? `Unlocking it with ${c.issuer}’s public key gives ${v.recovered}, which matches the fingerprint.` : `Fingerprint ${v.hash} but the signature unlocks to ${v.recovered}: the certificate was changed or not signed by ${c.issuer}.`);
  });
  chain.slice(1).forEach((c, i) => add(`ca${i}`, `Is “${c.subject}” allowed to issue certificates?`, c.isCA, c.isCA ? 'Yes, it is marked as a CA.' : 'No, it is not marked as a CA.'));
  const last = chain[chain.length - 1];
  const anchor = trust.find(t => t.subject === last.subject && t.key.n === last.key.n && t.key.e === last.key.e);
  add('anchor', `Does the chain end at a root the browser trusts?`, !!anchor, anchor ? `Yes: “${last.subject}” is in the trust store.` : `No: “${last.subject}” is not in the trust store.`);
  return { ok: checks.every(c => c.ok), checks };
}
