/**
 * Module bookmarks stored inside the existing account-scoped progress document.
 * The reserved notes key keeps this small feature compatible with the current progress schema.
 */
import { P, save } from './storage.js';

const BOOKMARKS_KEY = '__moduleBookmarks';

function bookmarkMap() {
  if (!P.notes || typeof P.notes !== 'object') P.notes = {};
  if (!P.notes[BOOKMARKS_KEY] || typeof P.notes[BOOKMARKS_KEY] !== 'object') {
    P.notes[BOOKMARKS_KEY] = {};
  }
  return P.notes[BOOKMARKS_KEY];
}

export const isBookmarked = id => Boolean(bookmarkMap()[id]);

export function toggleBookmark(id) {
  if (!id) return false;
  const bookmarks = bookmarkMap();
  if (bookmarks[id]) delete bookmarks[id];
  else bookmarks[id] = Date.now();
  save();
  return Boolean(bookmarks[id]);
}

export const bookmarkedIds = () =>
  Object.keys(bookmarkMap()).filter(id => Boolean(bookmarkMap()[id]));
