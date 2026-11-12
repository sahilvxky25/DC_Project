/** Pure progress data helpers; kept free of Firebase and browser dependencies for Node tests. */
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

export function normaliseProgress(value) {
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
export function mergeProgress(localValue, cloudValue, localTime = 0, cloudTime = 0) {
  const local = normaliseProgress(localValue);
  const cloud = normaliseProgress(cloudValue);
  const localIsNewer = localTime >= cloudTime;
  const newer = localIsNewer ? local : cloud;
  const older = localIsNewer ? cloud : local;

  const runsByKey = new Map();
  for (const run of [...(cloud.runs || []), ...(local.runs || [])]) {
    if (!run || typeof run !== 'object') continue;
    const key = run.id != null ? String(run.id) : (run.ts != null ? `${run.ts}:${JSON.stringify(run)}` : JSON.stringify(run));
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
