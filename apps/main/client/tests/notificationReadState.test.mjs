import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NOTIFICATION_READ_ENTRIES,
  notificationReadKey,
  notificationVersion,
  unreadNotifications,
  readNotificationState,
  markNotificationsRead,
  mergeReadStates,
} from "../src/utils/notificationReadState.js";

const notice = (id, updated_at = "2026-11-17T01:00:00.000Z", extra = {}) => ({
  id, title: `Notice ${id}`, message: "Message", pinned: false,
  created_at: "2026-11-16T01:00:00.000Z", updated_at, ...extra,
});
const storageFrom = (value) => ({ getItem: () => value });

test("opening marks current versions read, preserves notices and survives localStorage reload", () => {
  const items = [notice("one"), notice("two")];
  assert.deepEqual(unreadNotifications(items, {}), items);
  const state = markNotificationsRead(items);
  assert.deepEqual(unreadNotifications(items, state), []);
  const reloaded = readNotificationState(storageFrom(JSON.stringify(state)), notificationReadKey("account-one"));
  assert.deepEqual(reloaded, state);
  assert.deepEqual(unreadNotifications(items, reloaded), []);
  assert.equal(items.length, 2);
  assert.equal(items[0].message, "Message");
});

test("new or edited notices become unread but pinning and ordering alone do not", () => {
  const initial = [notice("one"), notice("two")];
  const state = markNotificationsRead(initial);
  const edited = notice("one", "2026-11-17T02:00:00.000Z", { message: "Edited" });
  const added = notice("three", "2026-11-17T03:00:00.000Z");
  assert.deepEqual(unreadNotifications([added, initial[1], edited], state).map((item) => item.id), ["three", "one"]);
  assert.deepEqual(unreadNotifications([{ ...initial[1], pinned: true }, initial[0]], state), []);
});

test("deleting a notice or loading only a subset does not forget another known version", () => {
  const first = notice("one");
  const second = notice("two");
  const state = markNotificationsRead([second], markNotificationsRead([first]));
  assert.equal(Object.keys(state).length, 2);
  assert.deepEqual(unreadNotifications([second], state), []);
  assert.deepEqual(unreadNotifications([first, second], state), []);
  assert.equal(unreadNotifications([notice("one", "2026-11-18T01:00:00.000Z")], state).length, 1);
});

test("versions canonicalize timezone offsets and fall back to creation time when updated time is invalid", () => {
  const utc = notice("one", "2026-11-17T01:00:00.000Z");
  const offset = notice("one", "2026-11-17T08:00:00+07:00");
  assert.equal(notificationVersion(utc), notificationVersion(offset));
  const fallback = notice("two", "invalid timestamp");
  assert.equal(notificationVersion(fallback), notificationVersion({ ...fallback, updated_at: undefined }));
  const undated = { id: "undated" };
  assert.deepEqual(unreadNotifications([undated], markNotificationsRead([undated])), []);
  assert.equal(notificationVersion(null), null);
  assert.equal(notificationVersion({ title: "Missing ID" }), null);
});

test("per-account and guest keys isolate browser read markers", () => {
  const keys = [notificationReadKey(), notificationReadKey("account-one"), notificationReadKey("account-two")];
  assert.equal(new Set(keys).size, 3);
  assert.equal(notificationReadKey("Account-One"), notificationReadKey(" Account-One "));
  assert.notEqual(notificationReadKey("Account-One"), notificationReadKey("account-one"));
  const saved = new Map([[keys[1], JSON.stringify(markNotificationsRead([notice("one")]))]]);
  const storage = { getItem: (key) => saved.get(key) ?? null };
  assert.equal(unreadNotifications([notice("one")], readNotificationState(storage, keys[1])).length, 0);
  assert.equal(unreadNotifications([notice("one")], readNotificationState(storage, keys[2])).length, 1);
  assert.equal(unreadNotifications([notice("one")], readNotificationState(storage, keys[0])).length, 1);
  assert.doesNotThrow(() => notificationReadKey("\ud800"));
});

test("malformed JSON, arrays, mismatched IDs and prototype payloads cannot corrupt the map", () => {
  const key = notificationReadKey();
  for (const raw of ["not JSON", "null", "[]", '"string"', "42", '{"one":{}}', '{"one":"invalid"}']) {
    assert.deepEqual(readNotificationState(storageFrom(raw), key), {});
  }
  const good = notificationVersion(notice("one"));
  const malicious = JSON.stringify({ one: good, other: good, constructor: good, prototype: good });
  const withProto = `${malicious.slice(0, -1)},"__proto__":{"polluted":true}}`;
  assert.deepEqual(readNotificationState(storageFrom(withProto), key), { one: good });
  assert.equal({}.polluted, undefined);
  assert.deepEqual(mergeReadStates(Object.create({ one: good }), []), {});
  assert.deepEqual(unreadNotifications([null, {}, { id: "__proto__" }], {}), []);
});

test("unavailable browser storage never causes read-state failures", () => {
  const key = notificationReadKey();
  for (const storage of [undefined, {}, { getItem() { throw new Error("SecurityError"); } },
    { get getItem() { throw new Error("Storage blocked"); } }]) {
    assert.deepEqual(readNotificationState(storage, key), {});
  }
  assert.deepEqual(readNotificationState(storageFrom(null), key), {});
});

test("merging tabs and marking stale items never downgrades a newer read version", () => {
  const older = notice("one");
  const newer = notice("one", "2026-11-17T02:00:00.000Z");
  const tabA = markNotificationsRead([older]);
  const tabB = markNotificationsRead([newer, notice("two")]);
  const merged = mergeReadStates(tabA, tabB);
  assert.deepEqual(mergeReadStates(tabB, tabA), merged);
  assert.equal(merged.one, notificationVersion(newer));
  assert.deepEqual(unreadNotifications([older, newer, notice("two")], merged), []);
  assert.equal(markNotificationsRead([older], merged).one, notificationVersion(newer));
});

test("bounded merge is deterministic and marking retains loaded old notices before deleted history", () => {
  const history = Array.from({ length: 300 }, (_, index) =>
    notice(`history-${String(index).padStart(3, "0")}`,
      new Date(Date.UTC(2026, 10, 17, 0, index)).toISOString()));
  const a = Object.fromEntries(history.slice(0, 150).map((item) => [item.id, notificationVersion(item)]));
  const b = Object.fromEntries(history.slice(150).map((item) => [item.id, notificationVersion(item)]));
  const merged = mergeReadStates(a, b);
  assert.equal(Object.keys(merged).length, MAX_NOTIFICATION_READ_ENTRIES);
  assert.deepEqual(mergeReadStates(b, a), merged);
  assert.equal(merged["history-000"], undefined);
  assert.ok(merged["history-299"]);
  const loadedOld = notice("still-visible", "2020-01-01T00:00:00.000Z");
  const marked = markNotificationsRead([loadedOld], merged);
  assert.equal(Object.keys(marked).length, MAX_NOTIFICATION_READ_ENTRIES);
  assert.equal(marked[loadedOld.id], notificationVersion(loadedOld));
  assert.deepEqual(unreadNotifications([loadedOld], marked), []);
  const raw = JSON.stringify({ ...a, ...b });
  assert.deepEqual(readNotificationState(storageFrom(raw), notificationReadKey()), merged);
});
