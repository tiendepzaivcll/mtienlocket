export const MAX_NOTIFICATION_READ_ENTRIES = 200;

const KEY_PREFIX = "locket-pro.notifications.read.v1:";
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function notificationId(value) {
  if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) return null;
  const id = String(value).trim();
  return /^[A-Za-z0-9_-]{1,100}$/.test(id) && !BLOCKED_KEYS.has(id) ? id : null;
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function notificationReadKey(accountId = "guest") {
  const account = (typeof accountId === "string" || typeof accountId === "number")
    ? String(accountId).trim() || "guest" : "guest";
  try { return KEY_PREFIX + encodeURIComponent(account); }
  catch { return `${KEY_PREFIX}raw:${JSON.stringify(account)}`; }
}

// The representation is opaque to callers; timestamps are normalized for safe merges.
export function notificationVersion(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const id = notificationId(item.id);
  if (!id) return null;
  const timestamp = canonicalTimestamp(item.updated_at) || canonicalTimestamp(item.created_at);
  return JSON.stringify([id, timestamp]);
}

function parseVersion(value, expectedId) {
  if (typeof value !== "string" || value.length > 512) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length !== 2 || notificationId(parsed[0]) !== expectedId) return null;
    const timestamp = parsed[1] === null ? null : canonicalTimestamp(parsed[1]);
    if (parsed[1] !== null && !timestamp) return null;
    return {
      version: JSON.stringify([expectedId, timestamp]),
      time: timestamp === null ? Number.NEGATIVE_INFINITY : Date.parse(timestamp),
    };
  } catch { return null; }
}

function stateEntries(value) {
  const entries = new Map();
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      ![null, Object.prototype].includes(Object.getPrototypeOf(value))) return entries;
    for (const [key, version] of Object.entries(value)) {
      const id = notificationId(key);
      if (!id || id !== key) continue;
      const parsed = parseVersion(version, id);
      if (parsed) entries.set(id, parsed);
    }
  } catch { return new Map(); }
  return entries;
}

function boundedState(entries, preferred = new Set()) {
  const ordered = [...entries].sort(([idA, a], [idB, b]) => {
    const preference = Number(preferred.has(idB)) - Number(preferred.has(idA));
    if (preference) return preference;
    if (a.time !== b.time) return a.time > b.time ? -1 : 1;
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });
  const result = {};
  for (const [id, entry] of ordered.slice(0, MAX_NOTIFICATION_READ_ENTRIES)) result[id] = entry.version;
  return result;
}

export function readNotificationState(storage, key) {
  try {
    if (!storage || typeof storage.getItem !== "function" || typeof key !== "string" || !key) return {};
    const raw = storage.getItem(key);
    if (typeof raw !== "string") return {};
    return boundedState(stateEntries(JSON.parse(raw)));
  } catch { return {}; }
}

export function unreadNotifications(items, readState) {
  if (!Array.isArray(items)) return [];
  const read = stateEntries(readState);
  return items.filter((item) => {
    const id = notificationId(item?.id);
    const version = notificationVersion(item);
    const current = id && version ? parseVersion(version, id) : null;
    if (!current) return false;
    const previous = read.get(id);
    // A stale fetch must not make an older version unread after a newer one was read.
    return !previous || current.time > previous.time;
  });
}

export function mergeReadStates(a, b) {
  const merged = stateEntries(a);
  for (const [id, entry] of stateEntries(b)) {
    if (!merged.has(id) || entry.time > merged.get(id).time) merged.set(id, entry);
  }
  return boundedState(merged);
}

export function markNotificationsRead(items, previous = {}) {
  const merged = stateEntries(previous);
  const loaded = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const id = notificationId(item?.id);
    const version = notificationVersion(item);
    const entry = id && version ? parseVersion(version, id) : null;
    if (!entry) continue;
    loaded.add(id);
    if (!merged.has(id) || entry.time > merged.get(id).time) merged.set(id, entry);
  }
  // Keep visible notices marked even when old/deleted history fills the bounded map.
  return boundedState(merged, loaded);
}
