const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createNotificationStore,
  validateInput,
  projectNotification,
  MAX_DOCUMENT_BYTES,
} = require("../src/services/Notifications/store");

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function fakeFirestore(initial = null) {
  let data = clone(initial);
  let tail = Promise.resolve();
  let heldRead = null;
  const state = { reads: 0, transactions: 0, writes: 0, failReads: false, failWrites: false };
  const snapshot = (value) => ({ exists: value !== null, data: () => clone(value) });
  const ref = {
    async get() {
      state.reads += 1;
      if (state.failReads) throw new Error("Firestore offline");
      const value = clone(data);
      const hold = heldRead;
      heldRead = null;
      if (hold) await hold;
      return snapshot(value);
    },
  };
  const db = {
    collection(name) {
      assert.equal(name, "app_settings");
      return { doc(id) { assert.equal(id, "notifications"); return ref; } };
    },
    runTransaction(work) {
      const execute = tail.then(async () => {
        state.transactions += 1;
        if (state.failReads) throw new Error("Firestore offline");
        let changed = false;
        let nextData;
        const result = await work({
          async get(actualRef) { assert.equal(actualRef, ref); return snapshot(data); },
          set(actualRef, value) { assert.equal(actualRef, ref); changed = true; nextData = clone(value); },
        });
        if (state.failWrites) throw new Error("Firestore write failed");
        if (changed) { data = nextData; state.writes += 1; }
        return result;
      });
      tail = execute.catch(() => {});
      return execute;
    },
  };
  return {
    db, state,
    persisted: () => clone(data),
    holdNextRead() {
      let release;
      heldRead = new Promise((resolve) => { release = resolve; });
      return release;
    },
  };
}

function harness(initial = null) {
  const fake = fakeFirestore(initial);
  let time = Date.parse("2026-11-16T10:00:00.000Z");
  let sequence = 0;
  const store = createNotificationStore({
    getDatabase: () => fake.db,
    now: () => time,
    idFactory: () => `notification-${++sequence}`,
  });
  return { ...fake, store, advance(ms) { time += ms; } };
}

test("notification validation requires bounded text and strict boolean pinning", () => {
  assert.deepEqual(validateInput({ title: " Hello ", message: " Body " }), {
    title: "Hello", message: "Body", pinned: false,
  });
  for (const input of [null, [], {}, { title: " ", message: "a" },
    { title: "a", message: "" }, { title: "x".repeat(161), message: "a" },
    { title: "a", message: "x".repeat(5001) }, { title: "a", message: "b", pinned: "true" },
    { title: "a", message: "b", pinned: 1 }]) {
    assert.throws(() => validateInput(input), (error) => error.status === 400);
  }
  assert.doesNotThrow(() => validateInput({ title: "x".repeat(160), message: "x".repeat(5000), pinned: true }));
  assert.deepEqual(validateInput({ pinned: false }, { partial: true }), { pinned: false });
  assert.throws(() => validateInput({ pinned: null }, { partial: true }));
  assert.throws(() => validateInput({}, { partial: true }));
});

test("notification CRUD persists only the public fields and preserves creation time", async () => {
  const h = harness();
  assert.deepEqual(await h.store.list(), []);
  const item = await h.store.create({ title: "Hi", message: "A new update", pinned: false,
    id: "forged-id", author: "Someone else", created_at: "forged timestamp" });
  assert.equal(item.id, "notification-1");
  assert.equal(item.author, "MTIEN");
  assert.equal(item.created_at, "2026-11-16T10:00:00.000Z");
  h.advance(1000);
  const updated = await h.store.update(item.id, { title: "Updated", pinned: true, author: "forged" });
  assert.equal(updated.title, "Updated");
  assert.equal(updated.message, item.message);
  assert.equal(updated.created_at, item.created_at);
  assert.equal(updated.updated_at, "2026-11-16T10:00:01.000Z");
  assert.equal(updated.author, "MTIEN");
  assert.deepEqual(h.persisted().items, [updated]);
  await assert.rejects(h.store.update("missing", { pinned: true }), (error) => error.status === 404);
  await assert.rejects(h.store.remove("missing"), (error) => error.status === 404);
  await h.store.remove(item.id);
  assert.deepEqual(await h.store.list(), []);
  assert.deepEqual(h.persisted().items, []);
});

test("pinned items sort before newer ordinary posts without editing changing creation order", async () => {
  const h = harness();
  const pinned = await h.store.create({ title: "Pinned", message: "First", pinned: true });
  h.advance(1000);
  const older = await h.store.create({ title: "Older", message: "Second" });
  h.advance(1000);
  const newest = await h.store.create({ title: "Newest", message: "Third" });
  h.advance(1000);
  await h.store.update(older.id, { message: "Edited later" });
  assert.deepEqual((await h.store.list()).map((item) => item.id), [pinned.id, newest.id, older.id]);
  await h.store.update(pinned.id, { pinned: false });
  assert.deepEqual((await h.store.list()).map((item) => item.id), [newest.id, older.id, pinned.id]);
});

test("simultaneous creates and updates share a Firestore transaction without lost notifications", async () => {
  const h = harness();
  const created = await Promise.all(Array.from({ length: 20 }, (_, index) =>
    h.store.create({ title: `Post ${index}`, message: `Message ${index}` })));
  assert.equal(h.persisted().items.length, 20);
  assert.equal(new Set(h.persisted().items.map((item) => item.id)).size, 20);
  await Promise.all([
    h.store.update(created[0].id, { title: "Changed" }),
    h.store.update(created[0].id, { pinned: true }),
    h.store.remove(created[1].id),
  ]);
  const items = await h.store.list();
  assert.equal(items.length, 19);
  assert.equal(items[0].id, created[0].id);
  assert.equal(items[0].title, "Changed");
  assert.equal(items[0].pinned, true);
  assert.equal(h.state.transactions, 23);
});

test("public reads share a 30-second cache, return copies, and refresh after mutations", async () => {
  const h = harness();
  await Promise.all(Array.from({ length: 8 }, () => h.store.list()));
  assert.equal(h.state.reads, 1);
  await h.store.create({ title: "New", message: "Saved" });
  const first = await h.store.list();
  assert.equal(h.state.reads, 2);
  first[0].title = "Tampered cache";
  assert.equal((await h.store.list())[0].title, "New");
  h.advance(29_999);
  await h.store.list();
  assert.equal(h.state.reads, 2);
  h.advance(1);
  await h.store.list();
  assert.equal(h.state.reads, 3);
  await h.store.list({ force: true });
  assert.equal(h.state.reads, 4);
});

test("a delayed read cannot repopulate a stale public cache after a successful write", async () => {
  const h = harness();
  const releaseOldRead = h.holdNextRead();
  const oldRead = h.store.list();
  const created = await h.store.create({ title: "Published", message: "Visible now" });
  assert.equal((await h.store.list())[0].id, created.id);
  releaseOldRead();
  assert.deepEqual(await oldRead, []);
  assert.equal((await h.store.list())[0].id, created.id);
  assert.equal(h.state.reads, 2);
});

test("Firestore failures are explicit and do not fall back to an empty or stale successful response", async () => {
  const unavailable = createNotificationStore({ getDatabase: () => null });
  await assert.rejects(unavailable.list(), (error) => error.status === 503);
  await assert.rejects(unavailable.create({ title: "Hi", message: "Message" }), (error) => error.status === 503);
  const h = harness();
  await h.store.create({ title: "Persisted", message: "Real content" });
  await h.store.list();
  h.advance(30_000);
  h.state.failReads = true;
  await assert.rejects(h.store.list(), (error) => error.status === 503);
  h.state.failReads = false;
  h.state.failWrites = true;
  await assert.rejects(h.store.create({ title: "Failed", message: "Not published" }), (error) => error.status === 503);
  assert.equal(h.persisted().items.length, 1);
});

test("100-item and document-byte limits fail safely without deleting older announcements", async () => {
  const h = harness();
  for (let index = 0; index < 100; index += 1) {
    await h.store.create({ title: `Item ${index}`, message: "Message" });
  }
  await assert.rejects(h.store.create({ title: "Overflow", message: "No" }),
    (error) => error.status === 409 && error.code === "NOTIFICATION_LIMIT_REACHED");
  assert.equal(h.persisted().items.length, 100);

  const large = harness();
  let limitError;
  for (let index = 0; index < 100; index += 1) {
    try { await large.store.create({ title: `Large ${index}`, message: "界".repeat(5000) }); }
    catch (error) { limitError = error; break; }
  }
  assert.equal(limitError?.status, 409);
  assert.equal(limitError?.code, "NOTIFICATION_STORAGE_LIMIT");
  assert.ok(large.persisted().items.length < 100);
  assert.ok(Buffer.byteLength(JSON.stringify(large.persisted()), "utf8") <= MAX_DOCUMENT_BYTES);
});

test("public projection strips unrelated fields and corrupt persisted data fails explicitly", async () => {
  const h = harness();
  const item = await h.store.create({ title: "Title", message: "Body" });
  assert.deepEqual(projectNotification({ ...item, author: "forged", internalToken: "not public" }), item);
  const malformed = harness({ items: [{ ...item, pinned: "true" }] });
  await assert.rejects(malformed.store.list(),
    (error) => error.status === 503 && error.code === "NOTIFICATION_DATA_INVALID");
});
