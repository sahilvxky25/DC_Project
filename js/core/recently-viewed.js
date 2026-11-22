/**
 * Recently viewed learning screens.
 *
 * Timestamps are stored in the existing account-scoped progress notes so the list
 * follows the learner across devices without changing the Firestore document schema.
 */
import { P, save } from './storage.js';

const RECENT_KEY = '__recentlyViewedModules';
const MAX_RECENT = 30;

function recentMap() {
  if (!P.notes || typeof P.notes !== 'object') P.notes = {};
  const value = P.notes[RECENT_KEY];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/** Record a module/core-lab screen visit and move it to the top of the list. */
export function recordRecentlyViewed(id) {
  if (typeof id !== 'string' || !id.trim()) return;
  const recent = recentMap();
  recent[id] = Date.now();
  const keep = Object.entries(recent)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, MAX_RECENT);
  P.notes[RECENT_KEY] = Object.fromEntries(keep);
  save();
}

/** Return most-recent-first entries as { id, viewedAt }. */
export function getRecentlyViewed(limit = MAX_RECENT) {
  return Object.entries(recentMap())
    .filter(([id, timestamp]) => typeof id === 'string' && Number.isFinite(Number(timestamp)))
    .map(([id, timestamp]) => ({ id, viewedAt: Number(timestamp) }))
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, Math.max(0, limit));
}
