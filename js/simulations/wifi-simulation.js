/**
 * Educational Wi-Fi simulation helpers.
 * Scores are normalized 0–100 values, not measured dBm or radio propagation.
 */
export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function calculateDistance(a, b) {
  return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y));
}

export function calculateObstacleLoss(ap, device, obstacles = []) {
  let loss = 0;
  const x1 = Number(ap.x), y1 = Number(ap.y), x2 = Number(device.x), y2 = Number(device.y);
  for (const obstacle of obstacles) {
    if (segmentIntersectsRect(x1, y1, x2, y2, obstacle)) loss += Number(obstacle.loss) || 0;
  }
  return loss;
}

function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  const left = Number(rect.x), top = Number(rect.y);
  const right = left + Number(rect.w), bottom = top + Number(rect.h);
  // Liang–Barsky segment/rectangle intersection.
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - left, right - x1, y1 - top, bottom - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

export function channelsOverlap(a, b, band = '2.4 GHz') {
  if (band === '2.4 GHz') return Math.abs(Number(a) - Number(b)) < 5;
  // Simplified channel model: identical or adjacent 5 GHz channels may contend.
  return Math.abs(Number(a) - Number(b)) <= 4;
}

export function calculateInterference(ap, accessPoints, band = ap.band) {
  let score = 0;
  for (const other of accessPoints) {
    if (other.id === ap.id || other.band !== band) continue;
    const distance = calculateDistance(ap, other);
    if (!channelsOverlap(ap.channel, other.channel, band) || distance > 360) continue;
    const proximity = clamp(1 - distance / 360, 0, 1);
    score += (ap.channel === other.channel ? 28 : 16) * proximity;
  }
  return clamp(score);
}

export function calculateSignalStrength(ap, device, obstacles = [], accessPoints = []) {
  const distance = calculateDistance(ap, device);
  // The 5 GHz model attenuates more quickly than the 2.4 GHz model by design.
  const distanceLoss = distance * (ap.band === '5 GHz' ? 0.22 : 0.15);
  const obstacleLoss = calculateObstacleLoss(ap, device, obstacles);
  const interference = calculateInterference(ap, accessPoints, ap.band) * 0.35;
  return Math.round(clamp((Number(ap.power) || 85) - distanceLoss - obstacleLoss - interference));
}

export function getConnectionStatus(ap, device, obstacles = [], accessPoints = []) {
  if (!ap || !device || device.ssid !== ap.ssid || device.band !== ap.band) return 'Not connected';
  return calculateSignalStrength(ap, device, obstacles, accessPoints) >= 12 ? 'Connected' : 'Out of range';
}

export function compareWifiBands(distance = 120, obstacles = []) {
  const ap = { id: 'compare', x: 0, y: 0, ssid: 'Demo', power: 85, channel: 6, band: '2.4 GHz' };
  const device = { x: distance, y: 0, ssid: 'Demo', band: '2.4 GHz' };
  const low = calculateSignalStrength(ap, device, obstacles, [ap]);
  const high = calculateSignalStrength({ ...ap, band: '5 GHz', channel: 36 }, { ...device, band: '5 GHz' }, obstacles, [{ ...ap, band: '5 GHz', channel: 36 }]);
  return { '2.4 GHz': low, '5 GHz': high };
}
