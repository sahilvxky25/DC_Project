import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, mergeProgress, normaliseProgress, readProgressSnapshot, writeProgressSnapshot, isCurrentActivation } from '../js/core/progress-merge.js';

test('concurrent device updates preserve independent visited markers and achievements', () => {
  const deviceA = fresh();
  deviceA.visited.tcp = 100;
  deviceA.ach.handshake = 101;
  const deviceB = fresh();
  deviceB.visited.udp = 102;
  deviceB.ach.datagram = 103;

  const merged = mergeProgress(deviceA, deviceB, 10, 11);
  assert.deepEqual(merged.visited, { tcp: 100, udp: 102 });
  assert.deepEqual(merged.ach, { handshake: 101, datagram: 103 });
});

test('offline recovery merges cached progress with newer cloud progress', () => {
  const offline = fresh();
  offline.visited.dns = 10;
  offline.stats.quizBest = 3;
  offline.runs = [{ id: 'offline-run', ts: 20, score: 4 }];

  const cloud = fresh();
  cloud.visited.http = 30;
  cloud.stats.quizBest = 5;
  cloud.runs = [{ id: 'cloud-run', ts: 31, score: 5 }];

  const recovered = mergeProgress(offline, cloud, 20, 30);
  assert.deepEqual(recovered.visited, { dns: 10, http: 30 });
  assert.equal(recovered.stats.quizBest, 5);
  assert.deepEqual(recovered.runs.map(run => run.id).sort(), ['cloud-run', 'offline-run']);
});

test('same timestamp quiz attempts are not collapsed when their content differs', () => {
  const local = fresh();
  const cloud = fresh();
  local.runs = [{ ts: 500, score: 4, module: 'tcp' }];
  cloud.runs = [{ ts: 500, score: 5, module: 'dns' }];

  const merged = mergeProgress(local, cloud, 10, 10);
  assert.equal(merged.runs.length, 2);
});

test('explicit run IDs deduplicate the same quiz attempt across devices', () => {
  const local = fresh();
  const cloud = fresh();
  local.runs = [{ id: 'attempt-1', ts: 500, score: 5 }];
  cloud.runs = [{ id: 'attempt-1', ts: 500, score: 5 }];

  const merged = mergeProgress(local, cloud, 10, 10);
  assert.equal(merged.runs.length, 1);
});

test('conflicting note and tutorial values use the newest snapshot', () => {
  const local = fresh();
  const cloud = fresh();
  local.notes.topic = 'local edit';
  local.tut.lesson = { completed: false };
  cloud.notes.topic = 'cloud edit';
  cloud.tut.lesson = { completed: true };

  const merged = mergeProgress(local, cloud, 10, 20);
  assert.equal(merged.notes.topic, 'cloud edit');
  assert.deepEqual(merged.tut.lesson, { completed: true });
});

test('merging preserves the 12 most recent quiz runs', () => {
  const local = fresh();
  local.runs = Array.from({ length: 8 }, (_, i) => ({ id: `local-${i}`, ts: i + 1 }));
  const cloud = fresh();
  cloud.runs = Array.from({ length: 8 }, (_, i) => ({ id: `cloud-${i}`, ts: i + 9 }));

  const merged = mergeProgress(local, cloud, 20, 10);
  assert.equal(merged.runs.length, 12);
  assert.equal(merged.runs[0].ts, 16);
  assert.equal(merged.runs.at(-1).ts, 5);
});

test('malformed persisted progress is normalized to a safe empty shape', () => {
  const normalized = normaliseProgress({
    visited: [],
    notes: null,
    runs: {},
    stats: 'invalid',
    theme: 42,
    last: null,
  });
  assert.deepEqual(normalized.visited, {});
  assert.deepEqual(normalized.notes, {});
  assert.deepEqual(normalized.runs, []);
  assert.equal(normalized.stats.quizRuns, 0);
  assert.equal(normalized.theme, '');
  assert.equal(normalized.last, '');
});

test('merging is idempotent for unioned markers and stable run IDs', () => {
  const a = fresh();
  a.visited.tcp = 1;
  a.runs = [{ id: 'same', ts: 2, score: 4 }];
  const b = fresh();
  b.visited.udp = 3;
  b.runs = [{ id: 'same', ts: 2, score: 4 }];

  const once = mergeProgress(a, b, 10, 11);
  const twice = mergeProgress(once, b, 11, 11);
  assert.deepEqual(twice.visited, once.visited);
  assert.deepEqual(twice.runs, once.runs);
});

test('blocked or full browser storage does not crash progress handling', () => {
  const blocked = {
    getItem() { throw new Error('storage blocked'); },
    setItem() { throw new Error('quota exceeded'); },
  };
  assert.equal(readProgressSnapshot(blocked, 'account-a'), null);
  assert.equal(writeProgressSnapshot(blocked, 'account-a', { progress: fresh() }), false);
});

test('account caches remain UID-scoped and never fall back to another user key', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
  };
  writeProgressSnapshot(storage, 'dcl.v2.user.A', { clientUpdatedAt: 1, progress: { visited: { tcp: 1 } } });
  writeProgressSnapshot(storage, 'dcl.v2.user.B', { clientUpdatedAt: 2, progress: { visited: { dns: 1 } } });
  assert.deepEqual(readProgressSnapshot(storage, 'dcl.v2.user.A').progress.visited, { tcp: 1 });
  assert.deepEqual(readProgressSnapshot(storage, 'dcl.v2.user.B').progress.visited, { dns: 1 });
  assert.equal(readProgressSnapshot(storage, 'dcl.v2.user.C'), null);
});

test('late asynchronous work from a previous account activation is rejected', () => {
  assert.equal(isCurrentActivation('user-B', 2, 'user-A', 1), false);
  assert.equal(isCurrentActivation('user-B', 2, 'user-B', 2), true);
  assert.equal(isCurrentActivation('user-B', 3, 'user-B', 2), false);
});
