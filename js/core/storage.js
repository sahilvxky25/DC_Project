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
  runTransaction
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { fresh, normaliseProgress, mergeProgress, readProgressSnapshot, writeProgressSnapshot, isCurrentActivation } from './progress-merge.js';

/** Legacy/guest localStorage key; kept for schema compatibility. */
export const STORE = 'dcl.v2';

const CLOUD_SCHEMA_VERSION = 1;
const CLOUD_DEBOUNCE_MS = 650;
const accountStore = uid => `${STORE}.user.${uid}`;
const cloudDoc = uid => doc(db, 'users', uid, 'progress', 'overview');


/** The shared live progress binding used by the rest of the application. */
export let P = fresh();

function readSnapshot(key) {
  try {
    return readProgressSnapshot(localStorage, key);
  } catch {
    return null;
  }
}

function persistLocal(progress, uid, clientUpdatedAt = Date.now()) {
  const value = uid
    ? { schemaVersion: CLOUD_SCHEMA_VERSION, clientUpdatedAt, progress }
    : progress;
  try {
    writeProgressSnapshot(localStorage, uid ? accountStore(uid) : STORE, value);
  } catch {
    // Accessing the localStorage property itself can throw in restricted browser contexts.
  }
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
    if (!isCurrentActivation(activeUid, activationToken, uid, token) || !cloudReady) return;
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
  // Preserve in-memory edits when this is a reconnect/retry for the same account. This matters
  // when localStorage is blocked or full and therefore could not persist the offline changes.
  const inMemoryProgress = activeUid === uid ? normaliseProgress(P) : null;
  activeUid = uid;
  cloudReady = false;

  const localSnapshot = readSnapshot(accountStore(uid));
  const cachedProgress = normaliseProgress(localSnapshot?.progress || fresh());
  const localProgress = inMemoryProgress
    ? mergeProgress(cachedProgress, inMemoryProgress, localSnapshot?.clientUpdatedAt || 0, Date.now())
    : cachedProgress;
  P = localProgress;

  try {
    const snapshot = await getDoc(cloudDoc(uid));
    if (!isCurrentActivation(activeUid, activationToken, uid, token)) return false;

    const cloudData = snapshot.exists() ? snapshot.data() : null;
    const cloudProgress = cloudData?.progress
      ? normaliseProgress(cloudData.progress)
      : null;
    const cloudTime = Number(cloudData?.clientUpdatedAt) || 0;

    if (cloudProgress) {
      P = mergeProgress(
        localProgress,
        cloudProgress,
        inMemoryProgress ? Date.now() : (localSnapshot?.clientUpdatedAt || 0),
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
    if (isCurrentActivation(activeUid, activationToken, uid, token)) {
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
    const ref = cloudDoc(uid);
    // A Firestore transaction re-reads the latest cloud snapshot on contention, then merges it
    // with this device's changes. This prevents two devices from blindly replacing one another.
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (activeUid !== uid || activationToken !== token || !cloudReady) return;
      const cloudData = snapshot.exists() ? snapshot.data() : null;
      const merged = mergeProgress(
        progress,
        cloudData?.progress || fresh(),
        clientUpdatedAt,
        Number(cloudData?.clientUpdatedAt) || 0
      );
      transaction.set(ref, {
        schemaVersion: CLOUD_SCHEMA_VERSION,
        clientUpdatedAt: Math.max(clientUpdatedAt, Number(cloudData?.clientUpdatedAt) || 0),
        updatedAt: serverTimestamp(),
        progress: merged,
      });
    });
    return isCurrentActivation(activeUid, activationToken, uid, token);
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

// Recover automatically when a device reconnects. Always re-read cloud state before uploading.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const uid = activeUid;
    if (uid) void activateProgressForUser(uid);
  });
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
