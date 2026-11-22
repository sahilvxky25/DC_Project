/**
 * Account-scoped recent module searches.
 * Search history lives in the existing progress document so it follows the signed-in user.
 */
import { P, save } from './storage.js';

const HISTORY_KEY = '__recentSearches';
const MAX_RECENT_SEARCHES = 5;

export function getRecentSearches() {
  const value = P.notes?.[HISTORY_KEY];
  return Array.isArray(value)
    ? value.filter(item => typeof item === 'string' && item.trim()).slice(0, MAX_RECENT_SEARCHES)
    : [];
}

export function recordSearch(query) {
  const value = String(query || '').trim().replace(/\\s+/g, ' ');
  if (!value) return getRecentSearches();

  const history = getRecentSearches().filter(
    item => item.toLocaleLowerCase() !== value.toLocaleLowerCase()
  );
  P.notes[HISTORY_KEY] = [value, ...history].slice(0, MAX_RECENT_SEARCHES);
  save();
  return P.notes[HISTORY_KEY];
}

export function clearRecentSearches() {
  P.notes[HISTORY_KEY] = [];
  save();
}
