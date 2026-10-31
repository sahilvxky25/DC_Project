/**
 * Pure firewall rule evaluation for the Firewall and Access Control Lab.
 * This is a learning simulation only; it never configures the host firewall or sends packets.
 */
const PROTOCOLS = new Set(['TCP', 'UDP', 'ICMP', 'ANY']);
const ACTIONS = new Set(['ALLOW', 'DENY']);

export const DEFAULT_RULES = [
  { id: 'r1', name: 'Allow HTTPS', protocol: 'TCP', port: '443', action: 'ALLOW', enabled: true },
  { id: 'r2', name: 'Block SSH', protocol: 'TCP', port: '22', action: 'DENY', enabled: true },
  { id: 'r3', name: 'Allow DNS', protocol: 'UDP', port: '53', action: 'ALLOW', enabled: true },
  { id: 'r4', name: 'Default deny', protocol: 'ANY', port: 'ANY', action: 'DENY', enabled: true },
];

export function validateRule(rule) {
  if (!rule || !String(rule.name || '').trim()) return 'Enter a rule name.';
  if (!PROTOCOLS.has(String(rule.protocol).toUpperCase())) return 'Choose a supported protocol.';
  if (!ACTIONS.has(String(rule.action).toUpperCase())) return 'Choose Allow or Deny.';
  const port = String(rule.port).toUpperCase();
  if (port !== 'ANY' && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    return 'Port must be Any or an integer from 1 to 65535.';
  }
  if (String(rule.protocol).toUpperCase() === 'ICMP' && port !== 'ANY') {
    return 'ICMP does not use TCP/UDP ports; choose Any.';
  }
  return '';
}

export function validatePacket(packet) {
  const protocol = String(packet.protocol || '').toUpperCase();
  if (!PROTOCOLS.has(protocol) || protocol === 'ANY') return 'Choose TCP, UDP, or ICMP for a packet.';
  const port = String(packet.port ?? '').trim().toUpperCase();
  if (protocol === 'ICMP') {
    if (port !== '' && port !== 'ANY') return 'ICMP packets do not have a port; leave the port blank.';
  } else if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    return 'Enter a destination port from 1 to 65535.';
  }
  for (const key of ['sourceIp', 'destinationIp']) {
    const value = String(packet[key] || '').trim();
    if (value && !isIPv4(value)) return `${key === 'sourceIp' ? 'Source' : 'Destination'} IP must be a valid IPv4 address.`;
  }
  return '';
}

export function isIPv4(value) {
  const parts = String(value).split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function ipToInt(value) {
  return value.split('.').reduce((total, part) => ((total * 256) + Number(part)) >>> 0, 0);
}

function ipMatches(value, ruleValue) {
  const pattern = String(ruleValue || 'ANY').trim().toUpperCase();
  if (!pattern || pattern === 'ANY') return true;
  const match = pattern.match(/^(.+)\/(\d{1,2})$/);
  if (match) {
    if (!isIPv4(value)) return false;
    const prefix = Number(match[2]);
    if (prefix < 0 || prefix > 32 || !isIPv4(match[1])) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ipToInt(value) & mask) === (ipToInt(match[1]) & mask);
  }
  return isIPv4(value) && isIPv4(pattern) && value === pattern;
}

export function packetMatchesRule(packet, rule) {
  if (rule.enabled === false) return false;
  const protocol = String(rule.protocol).toUpperCase();
  if (protocol !== 'ANY' && protocol !== String(packet.protocol).toUpperCase()) return false;
  const rulePort = String(rule.port).toUpperCase();
  if (rulePort !== 'ANY' && Number(rulePort) !== Number(packet.port)) return false;
  if (rule.sourceIp && !ipMatches(String(packet.sourceIp || ''), rule.sourceIp)) return false;
  if (rule.destinationIp && !ipMatches(String(packet.destinationIp || ''), rule.destinationIp)) return false;
  return true;
}

export function evaluatePacket(packet, rules) {
  const trace = [];
  for (const [index, rule] of rules.entries()) {
    if (rule.enabled === false) {
      trace.push({ ruleId: rule.id, index, status: 'skipped', explanation: 'Rule is disabled.' });
      continue;
    }
    const matched = packetMatchesRule(packet, rule);
    trace.push({
      ruleId: rule.id,
      index,
      status: matched ? 'matched' : 'no-match',
      explanation: matched
        ? `Packet matches ${rule.name} (${rule.protocol} / port ${rule.port}).`
        : 'Protocol, destination port, or configured IP criteria did not match.',
    });
    if (matched) {
      return {
        action: String(rule.action).toUpperCase(),
        ruleId: rule.id,
        ruleName: rule.name,
        reason: `First-match policy: ${rule.name} matched, so evaluation stops and the ${String(rule.action).toLowerCase()} action is applied.`,
        trace,
      };
    }
  }
  return {
    action: 'DENY',
    ruleId: null,
    ruleName: 'Default policy',
    reason: 'No enabled rule matched. The default-deny policy blocks this packet.',
    trace,
  };
}

export function createRuleId() {
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
