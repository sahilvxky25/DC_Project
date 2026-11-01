/**
 * Educational network-performance simulation engine. No live network traffic is sent.
 */
const MAX_RETRIES = 20;
const MAX_PACKETS = 10000;

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let n = t;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function validatePerformanceConfig(input) {
  const config = {
    bandwidthMbps: Number(input.bandwidthMbps),
    rttMs: Number(input.rttMs),
    lossPercent: Number(input.lossPercent),
    packetSizeBytes: Number(input.packetSizeBytes),
    packetCount: Number(input.packetCount),
    retryMode: input.retryMode,
    maxRetries: Number(input.maxRetries),
    seed: Number(input.seed),
    model: input.model || 'stop-and-wait',
    windowSize: Number(input.windowSize ?? 5),
  };
  const errors = [];
  if (!Number.isFinite(config.bandwidthMbps) || config.bandwidthMbps < 1 || config.bandwidthMbps > 1000) errors.push('Bandwidth must be between 1 and 1,000 Mbps.');
  if (!Number.isFinite(config.rttMs) || config.rttMs < 1 || config.rttMs > 1000) errors.push('RTT must be between 1 and 1,000 ms.');
  if (!Number.isFinite(config.lossPercent) || config.lossPercent < 0 || config.lossPercent > 50) errors.push('Packet loss must be between 0% and 50%.');
  if (!Number.isInteger(config.packetSizeBytes) || config.packetSizeBytes < 64 || config.packetSizeBytes > 1500) errors.push('Packet size must be an integer from 64 to 1,500 bytes.');
  if (!Number.isInteger(config.packetCount) || config.packetCount < 1 || config.packetCount > MAX_PACKETS) errors.push('Packet count must be an integer from 1 to 10,000.');
  if (!['none', 'limited', 'unlimited'].includes(config.retryMode)) errors.push('Choose a valid retransmission mode.');
  if (!Number.isInteger(config.maxRetries) || config.maxRetries < 0 || config.maxRetries > MAX_RETRIES) errors.push('Maximum retries must be from 0 to 20.');
  if (!Number.isInteger(config.seed) || config.seed < 1 || config.seed > 2147483647) errors.push('Seed must be a positive integer.');
  if (!['stop-and-wait', 'sliding-window', 'udp'].includes(config.model)) errors.push('Choose a valid simulation model.');
  if (!Number.isInteger(config.windowSize) || config.windowSize < 1 || config.windowSize > 100) errors.push('Window size must be an integer from 1 to 100.');
  return { config, errors };
}

export function simulatePerformance(input) {
  const { config, errors } = validatePerformanceConfig(input);
  if (errors.length) return { errors, config, results: null };

  const random = mulberry32(config.seed);
  const serializationMs = (config.packetSizeBytes * 8) / (config.bandwidthMbps * 1000);
  const packetResults = [];
  let retransmissions = 0;
  let lostAttempts = 0;
  let deliveredPackets = 0;
  let totalAttempts = 0;
  let stoppedBySafetyLimit = false;

  for (let packet = 1; packet <= config.packetCount; packet += 1) {
    let attempt = 0;
    let delivered = false;
    // UDP is a best-effort one-shot model. The retry selector does not override it.
    const retryMode = config.model === 'udp' ? 'none' : config.retryMode;
    while (!delivered) {
      attempt += 1;
      totalAttempts += 1;
      const lost = random() < config.lossPercent / 100;
      if (!lost) {
        delivered = true;
        deliveredPackets += 1;
        packetResults.push({ packet, attempts: attempt, status: attempt > 1 ? 'Retransmitted · delivered' : 'Delivered' });
        break;
      }
      lostAttempts += 1;
      if (retryMode === 'none' || (retryMode === 'limited' && attempt > config.maxRetries) || (retryMode === 'unlimited' && attempt > MAX_RETRIES)) {
        packetResults.push({ packet, attempts: attempt, status: 'Undelivered' });
        if (retryMode === 'unlimited' && attempt > MAX_RETRIES) stoppedBySafetyLimit = true;
        break;
      }
      retransmissions += 1;
      if (totalAttempts >= MAX_PACKETS * (MAX_RETRIES + 1)) {
        stoppedBySafetyLimit = true;
        packetResults.push({ packet, attempts: attempt, status: 'Stopped by safety limit' });
        break;
      }
    }
    if (stoppedBySafetyLimit) break;
  }

  const attemptedOriginalPackets = packetResults.length;
  const deliveredPayloadBits = deliveredPackets * config.packetSizeBytes * 8;
  const idealSerializationMs = config.packetCount * serializationMs;
  const totalSerializationMs = totalAttempts * serializationMs;
  let elapsedMs;
  let modelDescription;

  if (config.model === 'stop-and-wait') {
    elapsedMs = totalSerializationMs + totalAttempts * config.rttMs;
    modelDescription = 'Stop-and-wait ARQ: each transmission attempt waits one RTT for acknowledgement or loss detection.';
  } else if (config.model === 'sliding-window') {
    const rounds = Math.ceil(totalAttempts / config.windowSize);
    elapsedMs = totalSerializationMs + rounds * config.rttMs;
    modelDescription = 'Sliding-window approximation: up to ' + config.windowSize + ' attempts are in flight per RTT round. This simplified model does not implement exact TCP congestion control.';
  } else {
    elapsedMs = totalSerializationMs + config.rttMs / 2;
    modelDescription = 'UDP best-effort: each original packet is sent once, lost packets are not retransmitted, and completion is approximated as serialization plus half the configured RTT.';
  }

  const throughputMbps = elapsedMs > 0 ? deliveredPayloadBits / (elapsedMs / 1000) / 1e6 : 0;
  const deliveryRatio = attemptedOriginalPackets > 0 ? deliveredPackets / attemptedOriginalPackets * 100 : 0;
  const linkUtilization = elapsedMs > 0 ? Math.min(100, idealSerializationMs / elapsedMs * 100) : 0;

  return {
    errors: [],
    config,
    results: {
      serializationMs, idealSerializationMs, totalTimeMs: elapsedMs, throughputMbps,
      deliveryRatio, deliveredPackets, attemptedOriginalPackets,
      undeliveredPackets: attemptedOriginalPackets - deliveredPackets,
      retransmissions, lostAttempts, totalAttempts, linkUtilization, packetResults,
      stoppedBySafetyLimit, deliveredPayloadBits,
      complete: attemptedOriginalPackets === config.packetCount && !stoppedBySafetyLimit,
      model: config.model, modelDescription,
    },
  };
}

export const PERFORMANCE_LIMITS = Object.freeze({ maxRetries: MAX_RETRIES, maxPackets: MAX_PACKETS });
