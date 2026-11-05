/**
 * Saved progress for the signed-in account.
 *
 * The source of truth is the BitSecure database: progress is loaded from the server when you sign in
 * and saved back in the background (GET/PUT /api/progress). A copy is also kept in this browser's
 * localStorage under dcl.v2.user.{id}, so the app keeps working offline and loads instantly.
 *
 * Safety rules:
 *   - Progress is merged, never blindly overwritten: visited screens, achievements and statistics are
 *     combined from every device, so signing in on a new browser cannot erase older progress.
 *   - A save is only sent after a successful read from the server, and carries the version that was
 *     read. If another device saved in between, the server answers 409 and this client merges and retries.
 *   - If the server cannot be reached, nothing is lost: progress stays in the local copy and is sent later.
 *
 * The legacy "dcl.v2" key is used only while nobody is signed in (for example the saved theme on the
 * login screen). It is never imported into an account.
 */
import { ApiError, authedRequest } from '../auth/api.js';

/** Legacy/guest localStorage key; kept for schema compatibility. */
export const STORE = 'dcl.v2';

const SCHEMA_VERSION = 1;
const SYNC_DEBOUNCE_MS = 1500;
const RETRY_MS = 15000;
const READ_TIMEOUT_MS = 6000;
const FLUSH_TIMEOUT_MS = 4000;
const accountStore = uid => `${STORE}.user.${uid}`;

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

/** JSON with sorted keys, so two equal documents compare equal whatever order the server returns. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function readSnapshot(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Account keys use an envelope; also accept a plain progress object.
    if (parsed && parsed.progress && typeof parsed.progress === 'object') {
      return { progress: normaliseProgress(parsed.progress), clientUpdatedAt: Number(parsed.clientUpdatedAt) || 0 };
    }
    return { progress: normaliseProgress(parsed), clientUpdatedAt: 0 };
  } catch (error) {
    return null;
  }
}

function persistLocal(progress, uid, clientUpdatedAt = Date.now()) {
  try {
    if (uid) {
      localStorage.setItem(accountStore(uid), JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
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

/* ---------------------------- merging ---------------------------- */

/** Union of two {key: timestamp} maps, keeping the larger timestamp for keys present in both. */
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
 * Combine this browser's progress with the server's. Counters take the larger value, collections are
 * unioned, and single values (theme, last screen, notes) come from whichever side was changed last.
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

/** Replace the contents of P in place, so code holding a reference to the P object sees the update. */
function replaceProgress(next) {
  for (const key of Object.keys(P)) delete P[key];
  Object.assign(P, normaliseProgress(next));
}

/* ---------------------------- server sync ---------------------------- */

let activeUid = null;
let attemptId = 0;          // bumped whenever the account changes or a read is abandoned
let cloudReady = false;     // true once progress has been read from the server for this sign-in
let serverVersion = 0;      // version of the server copy this client last saw
let lastSyncedKey = '';     // stable form of what the server is known to hold
let forceNext = false;      // set by resetProgress(): the next save replaces the server copy
let syncTimer = null;
let queue = Promise.resolve();

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout')), ms);
  promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
});

function parseServerTime(value) {
  if (!value) return 0;
  const text = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`; // naive timestamps are UTC
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : 0;
}

/** Read the server copy and merge it with the local one. Never uploads. */
async function readFromServer(myAttempt, localTime) {
  const response = await authedRequest('/api/progress');
  if (myAttempt !== attemptId || !activeUid) return false;   // account changed or read abandoned
  serverVersion = response.version;
  if (response.data) {
    const merged = mergeProgress(P, response.data, localTime, parseServerTime(response.updated_at));
    replaceProgress(merged);
    lastSyncedKey = stable(normaliseProgress(response.data));
  } else {
    lastSyncedKey = '';
  }
  cloudReady = true;
  persistLocal(P, activeUid);
  return true;
}

/** Upload the current progress if it differs from the server copy; merge and retry on a version conflict. */
async function pushToServer(myAttempt) {
  for (let tries = 0; tries < 4; tries += 1) {
    if (myAttempt !== attemptId || !activeUid || !cloudReady) return false;
    const current = normaliseProgress(P);
    const key = stable(current);
    if (key === lastSyncedKey && !forceNext) return true;
    try {
      const response = await authedRequest('/api/progress', {
        method: 'PUT',
        body: { base_version: serverVersion, data: current },
      });
      if (myAttempt !== attemptId) return false;
      serverVersion = response.version;
      lastSyncedKey = stable(normaliseProgress(response.data));
      forceNext = false;
      return true;
    } catch (error) {
      const detail = error instanceof ApiError && error.status === 409 ? error.data?.detail : null;
      if (!detail || typeof detail !== 'object') throw error;
      // Another device saved first: adopt its version, then merge (unless this save is a deliberate reset).
      serverVersion = Number(detail.version) || 0;
      if (detail.data && !forceNext) {
        replaceProgress(mergeProgress(P, detail.data, Date.now(), 0));
        persistLocal(P, activeUid);
      }
    }
  }
  return false;
}

/** One sync round: read first if we never managed to, then push. Rounds run one at a time. */
function syncNow() {
  const myAttempt = attemptId;
  queue = queue.then(async () => {
    if (myAttempt !== attemptId || !activeUid) return;
    try {
      if (!cloudReady) {
        const snap = readSnapshot(accountStore(activeUid));
        await readFromServer(myAttempt, snap?.clientUpdatedAt || 0);
      }
      await pushToServer(myAttempt);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return; // session expired: keep local copy
      scheduleSync(RETRY_MS);                                        // offline or server error: try again later
    }
  });
  return queue;
}

function scheduleSync(delay = SYNC_DEBOUNCE_MS) {
  if (!activeUid) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, delay);
}

/** Persist the current progress locally right away and queue a background save to the server. */
export const save = () => {
  persistLocal(P, activeUid);
  scheduleSync();
};

/**
 * Load this account's progress before the app is shown: local copy first, then merged with the server.
 * If the server is slow or unreachable the local copy is used and syncing resumes in the background.
 * @param {string} uid the account's user id from the backend
 */
export async function activateProgressForUser(uid) {
  if (!uid) return false;
  clearTimeout(syncTimer);
  activeUid = uid;
  attemptId += 1;
  cloudReady = false;
  serverVersion = 0;
  lastSyncedKey = '';
  forceNext = false;
  const snap = readSnapshot(accountStore(uid));
  P = snap?.progress || fresh();
  const myAttempt = attemptId;
  try {
    await withTimeout(readFromServer(myAttempt, snap?.clientUpdatedAt || 0), READ_TIMEOUT_MS);
  } catch (error) {
    if (myAttempt === attemptId) attemptId += 1; // abandon a slow read so it cannot change progress later
  }
  persistLocal(P, activeUid);
  scheduleSync(cloudReady ? SYNC_DEBOUNCE_MS : RETRY_MS);
  return true;
}

/** Save everything now (used just before sign-out). Resolves even if the server is unreachable. */
export async function flushProgressSync() {
  if (!activeUid) return false;
  clearTimeout(syncTimer);
  persistLocal(normaliseProgress(P), activeUid);
  try {
    await withTimeout(syncNow(), FLUSH_TIMEOUT_MS);
  } catch (error) {
    // Offline or slow: the local copy has the data and will be sent after the next sign-in.
  }
  return true;
}

/**
 * Clear the active account on sign-out so another account can never reuse the previous account's
 * in-memory progress. Each account's local copy stays available to its owner.
 */
export function deactivateProgressUser() {
  clearTimeout(syncTimer);
  attemptId += 1;
  activeUid = null;
  cloudReady = false;
  serverVersion = 0;
  lastSyncedKey = '';
  forceNext = false;
  P = fresh();
}

/**
 * Clears all progress, achievements and notes but keeps the chosen theme, then saves.
 * The reset replaces the copy on the server too.
 */
export function resetProgress() {
  const theme = P.theme;
  P = fresh();
  P.theme = theme;
  forceNext = true;
  save();
}

/* Best-effort save when the tab is closed or hidden while a change is waiting to be sent. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !activeUid || !cloudReady) return;
    const current = normaliseProgress(P);
    persistLocal(current, activeUid);
    if (stable(current) === lastSyncedKey && !forceNext) return;
    const myAttempt = attemptId;
    authedRequest('/api/progress', {
      method: 'PUT',
      body: { base_version: serverVersion, data: current },
      keepalive: true,
    }).then(response => {
      if (myAttempt !== attemptId) return;
      serverVersion = response.version;
      lastSyncedKey = stable(normaliseProgress(response.data));
      forceNext = false;
    }).catch(() => {});
  });
  window.addEventListener('online', () => scheduleSync(500));
}
