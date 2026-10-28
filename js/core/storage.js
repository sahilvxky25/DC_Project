/**
 * Saved progress, local account caches, and optional Firebase Cloud Firestore sync.
 *
 * The active user's progress is kept in a UID-specific localStorage key for fast/offline access
 * and synchronized to users/{uid}/progress/overview after the cloud copy has been read. The legacy
 * "dcl.v2" key is left untouched for compatibility, but is not automatically imported into an
 * account because it has no UID attached and could belong to a different user on a shared browser.
 */

import { db } from '../auth/firebase-client.js';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

/** Legacy/guest localStorage key; kept for schema compatibility. */
export const STORE = 'dcl.v2';

const CLOUD_SCHEMA_VERSION = 1;
const CLOUD_DEBOUNCE_MS = 650;
const accountStore = uid => `${STORE}.user.${uid}`;
const cloudDoc = uid => doc(db, 'users', uid, 'progress', 'overview');

/**
 * Builds a brand-new, empty progress object.
 * @returns {{visited:Object,flags:Object,ach:Object,runs:Array,stats:Object,notes:Object,tut:Object,theme:string,last:string}}
 */
export const fresh = () => ({
  visited: {},
  flags: {},
  ach: {},
  runs: [],
  stats: { subnetOk: 0, quizBest: 0, quizRuns: 0 },
  notes: {},
  tut: {},
  theme: '',
  last: '',
});

/** The shared live progress binding used by the rest of the application. */
export let P = fresh();

function normaliseProgress(value) {
  const defaults = fresh();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = Object.assign(defaults, source);
  for (const key of ['visited', 'flags', 'ach', 'notes', 'tut']) {
    result[key] = result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
      ? result[key]
      : {};
  }
  result.runs = Array.isArray(result.runs) ? result.runs : [];
  result.stats = Object.assign(fresh().stats,
    result.stats && typeof result.stats === 'object' ? result.stats : {});
  result.theme = typeof result.theme === 'string' ? result.theme : '';
  result.last = typeof result.last === 'string' ? result.last : '';
  return result;
}

function readSnapshot(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Account keys use an envelope so merge decisions can compare snapshot times.
    if (parsed && parsed.progress && typeof parsed.progress === 'object') {
      return {
        progress: normaliseProgress(parsed.progress),
        clientUpdatedAt: Number(parsed.clientUpdatedAt) || 0,
      };
    }
    // Accept an older raw P object in a UID-specific key, if one exists.
    return { progress: normaliseProgress(parsed), clientUpdatedAt: 0 };
  } catch (error) {
    return null;
  }
}

function persistLocal(progress, uid, clientUpdatedAt = Date.now()) {
  try {
    if (uid) {
      localStorage.setItem(accountStore(uid), JSON.stringify({
        schemaVersion: CLOUD_SCHEMA_VERSION,
        clientUpdatedAt,
        progress,
      }));
    } else {
      localStorage.setItem(STORE, JSON.stringify(progress));
    }
  } catch (error) {
    // The in-memory app must still work when browser storage is blocked or full.
  }
}

function mergeTimestampMaps(localMap, cloudMap) {
  const merged = { ...cloudMap, ...localMap };
  for (const key of Object.keys(merged)) {
    const localValue = localMap?.[key];
    const cloudValue = cloudMap?.[key];
    if (typeof localValue === 'number' && typeof cloudValue === 'number') {
      merged[key] = Math.max(localValue, cloudValue);
    } else if (localValue === undefined) {
      merged[key] = cloudValue;
    } else if (cloudValue === undefined) {
      merged[key] = localValue;
    }
  }
  return merged;
}

/**
 * Merge snapshots conservatively: union visited markers/achievements/flags, preserve the higher
 * numeric stats and best scores, deduplicate run history, and take preference/note fields from the
 * newest snapshot. This avoids losing progress when two devices have been used offline.
 */
function mergeProgress(localValue, cloudValue, localTime = 0, cloudTime = 0) {
  const local = normaliseProgress(localValue);
  const cloud = normaliseProgress(cloudValue);
  const localIsNewer = localTime >= cloudTime;
  const newer = localIsNewer ? local : cloud;
  const older = localIsNewer ? cloud : local;

  const runsByKey = new Map();
  for (const run of [...(cloud.runs || []), ...(local.runs || [])]) {
    if (!run || typeof run !== 'object') continue;
    const key = run.ts != null ? String(run.ts) : JSON.stringify(run);
    runsByKey.set(key, run);
  }
  const runs = [...runsByKey.values()]
    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))
    .slice(0, 12);

  const stats = { ...cloud.stats, ...local.stats };
  for (const key of new Set([...Object.keys(local.stats), ...Object.keys(cloud.stats)])) {
    const a = local.stats[key];
    const b = cloud.stats[key];
    if (typeof a === 'number' && typeof b === 'number') stats[key] = Math.max(a, b);
    else if (a === undefined) stats[key] = b;
    else if (b === undefined) stats[key] = a;
  }

  return normaliseProgress({
    ...newer,
    visited: mergeTimestampMaps(local.visited, cloud.visited),
    flags: mergeTimestampMaps(local.flags, cloud.flags),
    ach: mergeTimestampMaps(local.ach, cloud.ach),
    runs,
    stats,
    notes: { ...older.notes, ...newer.notes },
    tut: { ...older.tut, ...newer.tut },
    theme: newer.theme,
    last: newer.last || older.last || '',
  });
}

let activeUid = null;
let activationToken = 0;
let cloudReady = false;
let syncTimer = null;
let writeQueue = Promise.resolve();

function clearSyncTimer() {
  if (syncTimer !== null) clearTimeout(syncTimer);
  syncTimer = null;
}

function scheduleCloudSync() {
  if (!activeUid || !cloudReady) return;
  clearSyncTimer();
  const uid = activeUid;
  const token = activationToken;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    if (activeUid !== uid || activationToken !== token || !cloudReady) return;
    void flushProgressSync();
  }, CLOUD_DEBOUNCE_MS);
}

/**
 * Persist immediately to the active account's local cache. Cloud writes are debounced so multiple
 * related changes (e.g. a quiz result and its achievement) do not create needless writes.
 */
export const save = () => {
  const updatedAt = Date.now();
  persistLocal(P, activeUid, updatedAt);
  if (activeUid && cloudReady) scheduleCloudSync();
};

/**
 * Read the user's cloud progress before the app is shown, then merge it with their UID-specific
 * local cache. Legacy global progress is deliberately not attached to the first account automatically.
 */
export async function activateProgressForUser(uid) {
  if (!uid) return false;
  const token = ++activationToken;
  clearSyncTimer();
  activeUid = uid;
  cloudReady = false;

  const localSnapshot = readSnapshot(accountStore(uid));
  P = normaliseProgress(localSnapshot?.progress || fresh());

  try {
    const snapshot = await getDoc(cloudDoc(uid));
    if (token !== activationToken || activeUid !== uid) return false;

    const cloudData = snapshot.exists() ? snapshot.data() : null;
    const cloudProgress = cloudData?.progress
      ? normaliseProgress(cloudData.progress)
      : null;
    const cloudTime = Number(cloudData?.clientUpdatedAt) || 0;

    if (cloudProgress) {
      P = mergeProgress(
        localSnapshot?.progress || fresh(),
        cloudProgress,
        localSnapshot?.clientUpdatedAt || 0,
        cloudTime
      );
    }

    cloudReady = true;
    // Save the merged local cache immediately and upload it once the debounce expires.
    save();
    return true;
  } catch (error) {
    // Authentication still works offline. Keep local progress, but don't upload until a cloud read
    // succeeds; this prevents a failed read from overwriting data that already exists in Firestore.
    if (token === activationToken && activeUid === uid) {
      cloudReady = false;
      persistLocal(P, uid);
      console.warn('[BitSecure] Cloud progress could not be loaded; using this account’s local cache.', error);
    }
    return false;
  }
}

/**
 * Flush the latest snapshot before sign-out. The queued write always targets the captured UID, and
 * Firestore rules independently enforce that the authenticated user owns the document.
 */
export async function flushProgressSync() {
  const uid = activeUid;
  const token = activationToken;
  if (!uid) return false;

  clearSyncTimer();
  const clientUpdatedAt = Date.now();
  const progress = normaliseProgress(P);
  persistLocal(progress, uid, clientUpdatedAt);
  if (!cloudReady) return false;

  const write = async () => {
    if (activeUid !== uid || activationToken !== token || !cloudReady) return false;
    await setDoc(cloudDoc(uid), {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      clientUpdatedAt,
      updatedAt: serverTimestamp(),
      progress,
    });
    return true;
  };

  const operation = writeQueue.catch(() => false).then(write);
  writeQueue = operation;
  try {
    return await operation;
  } catch (error) {
    console.warn('[BitSecure] Cloud progress could not be saved; it remains in this device’s local cache.', error);
    return false;
  }
}

/**
 * Clear the active account context on sign-out so another account can never reuse the previous
 * account's in-memory progress. UID-specific local caches remain available to their owner.
 */
export function deactivateProgressUser() {
  activationToken++;
  clearSyncTimer();
  activeUid = null;
  cloudReady = false;
  P = fresh();
}

/**
 * Clears all progress, achievements and notes but keeps the chosen theme, then saves.
 */
export function resetProgress() {
  const theme = P.theme;
  P = fresh();
  P.theme = theme;
  save();
}
