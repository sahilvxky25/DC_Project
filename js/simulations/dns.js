/**
 * Simulated DNS hierarchy, recursive/iterative lookup, and TTL-aware cache.
 * All records and latency values belong to this teaching simulation, not public DNS.
 */
const TLDS = {
  com: ['a.gtld-servers.net', '192.5.6.30'],
  net: ['b.gtld-servers.net', '192.33.14.30'],
  org: ['a0.org.afilias-nst.info', '199.19.56.1'],
  edu: ['a.edu-servers.net', '192.5.6.30'],
};
const ZONES = {
  'example.com': ['ns1.example.com', '93.184.216.50'],
  'cdn-sample.net': ['ns.cdn-sample.net', '198.51.100.53'],
  'example.org': ['ns1.example.org', '198.51.100.11'],
  'example.edu': ['ns.example.edu', '192.0.2.53'],
};
export const DNS_DATA = {
  'example.com': { A: ['93.184.216.34'], AAAA: ['2606:2800:220:1:248:1893:25c8:1946'], MX: ['10 mail.example.com'], NS: ['ns1.example.com'], TXT: ['"v=spf1 -all"'] },
  'www.example.com': { CNAME: ['example.com'] },
  'mail.example.com': { A: ['93.184.216.35'] },
  'shop.example.com': { A: ['203.0.113.20'] },
  'cdn.example.com': { CNAME: ['edge.cdn-sample.net'] },
  'edge.cdn-sample.net': { A: ['198.51.100.7'], AAAA: ['2001:db8:cd::7'] },
  'example.org': { A: ['198.51.100.10'], NS: ['ns1.example.org'] },
  'docs.example.org': { CNAME: ['example.org'] },
  'campus.example.edu': { A: ['192.0.2.44'] },
};
const DEFAULT_TTL = { A: 300, AAAA: 300, CNAME: 3600, MX: 3600, NS: 86400, TXT: 600 };
const DEFAULT_NEGATIVE_TTL = 60;
const normalise = name => String(name || '').trim().toLowerCase().replace(/\.$/, '');
const key = (name, type) => normalise(name) + '|' + type;
const live = (cache, k, now) => {
  const value = cache.get(k);
  if (value && value.exp <= now) { cache.delete(k); return null; }
  return value || null;
};

/**
 * Resolve a sample DNS name. mode is "recursive" or "iterative"; ttlOverride
 * lets learners change the answer TTL. The virtual clock is supplied by the UI.
 */
export function dnsLookup(qname, qtype, cache, now, options = {}) {
  const mode = options.mode === 'iterative' ? 'iterative' : 'recursive';
  const ttlOverride = Number(options.ttlOverride);
  const ttlFor = type => Number.isFinite(ttlOverride) && ttlOverride > 0 ? ttlOverride : (DEFAULT_TTL[type] || 300);
  const out = { msgs: [], marks: [], ms: 0, answers: [], rcode: 'NOERROR', cached: false, mode, servers: [], queryCount: 0 };
  let tick = 0;
  const add = (dir, label, cls = 'c0', server = '') => {
    out.msgs.push({ t0: tick, t1: tick + 1, dir, label, cls, idx: out.msgs.length });
    tick += 1.3;
    if (server) out.servers.push(server);
    if (dir === 'lr') out.queryCount++;
  };
  let name = normalise(qname);
  const originalName = name;
  if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(name) || !name.includes('.') || name.split('.').some(x => !x || x.length > 63) || !/^[A-Z]+$/.test(qtype)) {
    out.rcode = 'FORMERR'; return out;
  }

  const cached = live(cache, key(name, qtype), now);
  if (cached) {
    out.marks.push({ side: 'l', t: 0.3, label: 'answer found in cache', cls: 'c2' });
    out.answers = cached.rrs || [];
    out.rcode = cached.rcode || 'NOERROR';
    out.cached = true;
    out.left = cached.exp - now;
    out.ms = 0;
    return out;
  }

  const delegation = (zone, tld) => {
    if (live(cache, 'ns|' + tld, now)) out.marks.push({ side: 'l', t: tick, label: '.' + tld + ' delegation cached', cls: 'c2' });
    else {
      add('lr', mode === 'recursive' ? 'Resolver → root: where is .' + tld + '?' : 'Requester → root: referral for .' + tld, 'c0', 'Root');
      out.ms += 14;
      if (!TLDS[tld]) {
        add('rl', 'NXDOMAIN: no .' + tld + ' TLD', 'c1', 'Root');
        out.rcode = 'NXDOMAIN'; return false;
      }
      add('rl', 'Referral: ask ' + TLDS[tld][0], 'c3', 'Root');
      cache.set('ns|' + tld, { exp: now + 172800 });
    }
    if (live(cache, 'ns|' + zone, now)) out.marks.push({ side: 'l', t: tick, label: zone + ' delegation cached', cls: 'c2' });
    else {
      add('lr', mode === 'recursive' ? 'Resolver → .' + tld + ': where is ' + zone + '?' : 'Requester → .' + tld + ': referral for ' + zone, 'c0', 'TLD');
      out.ms += 22;
      if (!ZONES[zone]) {
        add('rl', 'NXDOMAIN: no authoritative zone', 'c1', 'TLD');
        out.rcode = 'NXDOMAIN'; return false;
      }
      add('rl', 'Referral: ask ' + ZONES[zone][0], 'c3', 'TLD');
      cache.set('ns|' + zone, { exp: now + 86400 });
    }
    return true;
  };

  let guard = 0, negative = false;
  while (guard++ < 8) {
    const labels = name.split('.'), tld = labels[labels.length - 1];
    const zone = labels.length >= 2 ? labels.slice(-2).join('.') : '';
    if (!delegation(zone, tld)) { negative = true; break; }
    const authoritative = ZONES[zone];
    if (!authoritative) {
      add('rl', 'NXDOMAIN: no authoritative server for ' + zone, 'c1', 'TLD');
      out.rcode = 'NXDOMAIN'; negative = true; break;
    }
    add('lr', (mode === 'recursive' ? 'Resolver → authoritative: ' : 'Requester → authoritative: ') + name + ' ' + qtype + '?', 'c0', 'Authoritative');
    out.ms += 35;
    const rec = DNS_DATA[name];
    if (!rec) {
      add('rl', 'NXDOMAIN: name does not exist', 'c1', 'Authoritative');
      out.rcode = 'NXDOMAIN'; negative = true; break;
    }
    if (rec[qtype]) {
      add('rl', 'Answer: ' + rec[qtype].join(', '), 'c2', 'Authoritative');
      rec[qtype].forEach(v => out.answers.push({ name, type: qtype, ttl: ttlFor(qtype), v }));
      break;
    }
    if (rec.CNAME && qtype !== 'CNAME') {
      add('rl', 'CNAME: ' + name + ' → ' + rec.CNAME[0], 'c3', 'Authoritative');
      out.answers.push({ name, type: 'CNAME', ttl: ttlFor('CNAME'), v: rec.CNAME[0] });
      name = rec.CNAME[0];
      continue;
    }
    add('rl', 'NOERROR: name exists, but no ' + qtype + ' record', 'c4', 'Authoritative');
    out.rcode = 'NODATA'; negative = true; break;
  }
  if (guard >= 8 && !out.answers.length && !negative) out.rcode = 'SERVFAIL';

  const cacheKey = key(originalName, qtype);
  if (out.answers.length) {
    cache.set(cacheKey, { rrs: out.answers, rcode: out.rcode, exp: now + Math.max(1, Math.min(...out.answers.map(a => a.ttl))) });
  } else if (negative) {
    cache.set(cacheKey, { rrs: [], rcode: out.rcode, exp: now + DEFAULT_NEGATIVE_TTL, negative: true });
    out.negativeTtl = DEFAULT_NEGATIVE_TTL;
  }
  out.serverCount = new Set(out.servers).size;
  return out;
}
