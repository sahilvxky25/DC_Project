/**
 * Pure helpers for the browser-only Network Topology Builder.
 * This is an educational model, not a real packet transmitter or full routing stack.
 */
import { cidrInfo, ip4, p4 } from '../core/addressing.js';

export function validateTopology(devices, links) {
  const errors = [];
  const byId = new Map(devices.map(device => [device.id, device]));
  const seen = new Map();

  for (const device of devices) {
    if (!['pc', 'router', 'switch', 'server'].includes(device.type)) {
      errors.push({ deviceId: device.id, message: 'Unknown device type.' });
    }
    if (device.type === 'switch') continue;
    const ip = p4(device.config.ip);
    const prefix = Number(device.config.prefix);
    if (ip === null) {
      errors.push({ deviceId: device.id, message: 'Enter a valid IPv4 address.' });
      continue;
    }
    if (!Number.isInteger(prefix) || prefix < 1 || prefix > 32) {
      errors.push({ deviceId: device.id, message: 'Prefix must be between /1 and /32.' });
      continue;
    }
    const network = cidrInfo(ip, prefix);
    if (prefix < 31 && (ip === network.n || ip === network.b)) {
      errors.push({ deviceId: device.id, message: 'This IP is the network or broadcast address for its prefix.' });
    }
    if (seen.has(ip)) {
      errors.push({ deviceId: device.id, message: `Duplicate IP address also used by ${seen.get(ip)}.` });
    } else {
      seen.set(ip, device.name);
    }
    if (device.config.gateway && p4(device.config.gateway) === null) {
      errors.push({ deviceId: device.id, message: 'Default gateway is not a valid IPv4 address.' });
    }
  }

  for (const link of links) {
    if (!byId.has(link.source) || !byId.has(link.target) || link.source === link.target) {
      errors.push({ linkId: link.id, message: 'Cable endpoint is invalid.' });
    }
  }
  return errors;
}

function connectedComponent(startId, links) {
  const adjacency = new Map();
  links.forEach(link => {
    if (link.status === 'down') return;
    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
    if (!adjacency.has(link.target)) adjacency.set(link.target, []);
    adjacency.get(link.source).push(link.target);
    adjacency.get(link.target).push(link.source);
  });
  const visited = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

export function testConnectivity(devices, links, sourceId, targetId) {
  const source = devices.find(device => device.id === sourceId);
  const target = devices.find(device => device.id === targetId);
  if (!source || !target) return { ok: false, message: 'Choose both a source and a destination.' };
  if (source.id === target.id) return { ok: false, message: 'Choose two different devices.' };
  if (source.type === 'switch' || target.type === 'switch') {
    return { ok: false, message: 'Choose an end device (PC or server) as source and destination.' };
  }

  const errors = validateTopology(devices, links);
  const endpointErrors = errors.filter(error => error.deviceId === source.id || error.deviceId === target.id);
  if (endpointErrors.length) return { ok: false, message: endpointErrors.map(error => error.message).join(' ') };

  const sourceIp = p4(source.config.ip);
  const targetIp = p4(target.config.ip);
  const sourcePrefix = Number(source.config.prefix);
  const targetPrefix = Number(target.config.prefix);
  if (sourceIp === null || targetIp === null) return { ok: false, message: 'Both end devices need valid IPv4 addresses.' };
  if (sourceIp === targetIp) return { ok: false, message: 'The source and destination have the same IP address.' };

  const reachable = connectedComponent(source.id, links);
  if (!reachable.has(target.id)) return { ok: false, message: 'No physical path exists. Connect the devices with cables and check that each cable is up.' };

  const sourceNet = cidrInfo(sourceIp, sourcePrefix);
  const targetNet = cidrInfo(targetIp, targetPrefix);
  const sameSubnet = (sourceIp & sourceNet.m) >>> 0 === (targetIp & sourceNet.m) >>> 0;
  if (sameSubnet) {
    return { ok: true, message: 'Connectivity test passed: a cable path connects both devices on the same IP subnet.' };
  }

  const path = findPath(source.id, target.id, links, devices);
  const routerOnPath = path && path.some(id => devices.find(device => device.id === id)?.type === 'router');
  if (!routerOnPath) return { ok: false, message: 'The devices are on different subnets. Add a router between the networks.' };
  const gateway = p4(source.config.gateway);
  if (gateway === null) return { ok: false, message: 'The source is on a different subnet and has no valid default gateway.' };
  const router = path.map(id => devices.find(device => device.id === id)).find(device => device?.type === 'router');
  if (!router) return { ok: false, message: 'No router is available on the path.' };
  const routerIp = p4(router.config.ip);
  if (routerIp === null || (gateway !== routerIp && !path.some(id => {
    const candidate = devices.find(device => device.id === id);
    return candidate?.type === 'router' && p4(candidate.config.gateway) === gateway;
  }))) {
    return { ok: false, message: 'The source default gateway does not match the router configured on this simplified path.' };
  }
  return {
    ok: true,
    message: `Connectivity test passed: the virtual path includes ${path.filter(id => devices.find(device => device.id === id)?.type === 'router').length} router(s). Routing is simplified for learning.`,
  };
}

export function findPath(sourceId, targetId, links, devices) {
  const adjacency = new Map();
  links.filter(link => link.status !== 'down').forEach(link => {
    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
    if (!adjacency.has(link.target)) adjacency.set(link.target, []);
    adjacency.get(link.source).push(link.target);
    adjacency.get(link.target).push(link.source);
  });
  const queue = [[sourceId]];
  const visited = new Set([sourceId]);
  while (queue.length) {
    const path = queue.shift();
    const last = path[path.length - 1];
    if (last === targetId) return path;
    for (const next of adjacency.get(last) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push([...path, next]);
    }
  }
  return null;
}

export function packetRoute(devices, links, sourceId, targetId) {
  const path = findPath(sourceId, targetId, links, devices);
  if (!path) return { path: null, message: 'Packet dropped: no cable path to destination.' };
  const result = testConnectivity(devices, links, sourceId, targetId);
  if (!result.ok) return { path, message: `Packet dropped: ${result.message}` };
  return { path, message: 'Packet delivered successfully in the virtual topology.' };
}

export function formatDeviceAddress(device) {
  const ip = p4(device.config.ip);
  return ip === null ? 'IP not set' : `${ip4(ip)}/${device.config.prefix}`;
}
