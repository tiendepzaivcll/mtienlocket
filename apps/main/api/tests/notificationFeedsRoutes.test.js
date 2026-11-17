const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");

const TEST_SECRET = "notification-feeds-route-test-secret-only";
const oldSecret = process.env.ADMIN_JWT_SECRET;
const oldPassword = process.env.ADMIN_PASSWORD;
process.env.ADMIN_JWT_SECRET = TEST_SECRET;
process.env.ADMIN_PASSWORD = "notification-feeds-route-test-password-only";
const adminRouter = require("../src/routes/admin.route");
const publicRouter = require("../src/routes/public.route");
const notifications = require("../src/services/Notifications/store");
if (oldSecret === undefined) delete process.env.ADMIN_JWT_SECRET;
else process.env.ADMIN_JWT_SECRET = oldSecret;
if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
else process.env.ADMIN_PASSWORD = oldPassword;

const clone = (value) => JSON.parse(JSON.stringify(value));

function fakeFirestore(initialItems) {
  let persisted = { items: clone(initialItems) };
  let transactions = Promise.resolve();
  const state = { reads: 0, writes: 0, failReads: false };
  const snapshot = () => ({ exists: true, data: () => clone(persisted) });
  const ref = {
    async get() {
      state.reads += 1;
      if (state.failReads) throw new Error("Test Firestore is offline");
      return snapshot();
    },
  };
  const db = {
    collection(name) {
      assert.equal(name, "app_settings");
      return { doc(id) { assert.equal(id, "notifications"); return ref; } };
    },
    runTransaction(work) {
      const execution = transactions.then(async () => {
        if (state.failReads) throw new Error("Test Firestore is offline");
        let next;
        const result = await work({
          async get(actualRef) { assert.equal(actualRef, ref); return snapshot(); },
          set(actualRef, value) { assert.equal(actualRef, ref); next = clone(value); },
        });
        if (next) { persisted = next; state.writes += 1; }
        return result;
      });
      transactions = execution.catch(() => {});
      return execution;
    },
  };
  return { db, state };
}

function articleFor(item) {
  return {
    id: item.id,
    slug: `notification-${item.id}`,
    title: item.title,
    description: item.message,
    message: item.message,
    author: "MTIEN",
    category: "announcement",
    published_at: item.created_at,
    updated_at: item.updated_at,
    pinned: item.pinned,
    thumbnail: null,
    source: "admin-notification",
    content: { blocks: [{ type: "text", data: item.message, className: "whitespace-pre-wrap break-words" }] },
  };
}

test("admin announcements populate public feeds and bell from the same persistent cached source", async (t) => {
  const previous = {
    id: "before-one", title: "Đã đăng trước khi có bảng tin", message: "Thông báo cũ vẫn xuất hiện.\nLiên hệ admin MTIEN.",
    pinned: true, created_at: "2026-11-15T03:00:00.000Z", updated_at: "2026-11-15T03:00:00.000Z", author: "MTIEN",
  };
  const second = {
    id: "before-two", title: "Thông báo trước đó thứ hai", message: "Đầy đủ nội dung thông báo.",
    pinned: false, created_at: "2026-11-15T04:00:00.000Z", updated_at: "2026-11-15T04:00:00.000Z", author: "MTIEN",
  };
  const fake = fakeFirestore([previous, second]);
  let time = Date.parse("2026-11-17T01:00:00.000Z");
  let sequence = 0;
  const realStore = notifications.createNotificationStore({
    getDatabase: () => fake.db,
    now: () => time,
    idFactory: () => `future-${++sequence}`,
  });
  const originalMethods = Object.fromEntries(["list", "create", "update", "remove"].map((key) => [key, notifications[key]]));
  Object.assign(notifications, Object.fromEntries(Object.keys(originalMethods).map((key) => [key, realStore[key]])));
  t.after(() => Object.assign(notifications, originalMethods));

  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  app.use("/v1/public", publicRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections?.();
  }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const adminToken = jwt.sign({ role: "admin" }, TEST_SECRET, { expiresIn: "1h" });
  const request = async (path, { method = "GET", body, admin = false } = {}) => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        ...(admin ? { Authorization: `Bearer ${adminToken}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  let future;

  await t.test("preexisting announcements appear as raw articles and unauthenticated detail shares the bell cache", async () => {
    const feed = await request("/v1/public/feeds");
    assert.equal(feed.status, 200);
    assert.equal(feed.headers.get("cache-control"), "no-store");
    assert.deepEqual(feed.body, [articleFor(previous), articleFor(second)]);
    const bell = await request("/v1/public/notification");
    assert.equal(bell.status, 200);
    assert.equal(bell.headers.get("cache-control"), "no-store");
    assert.deepEqual(bell.body.notifications, [previous, second]);
    const detail = await request(`/v1/public/feeds?slug=notification-${previous.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.headers.get("cache-control"), "no-store");
    assert.deepEqual(detail.body, articleFor(previous));
    assert.equal(fake.state.reads, 1, "feed, bell and article detail must share the cached Firestore read");
    assert.equal(fake.state.writes, 0);
  });

  await t.test("future admin-created announcements invalidate both public surfaces immediately", async () => {
    const created = await request("/admin/notifications", {
      method: "POST", admin: true,
      body: { title: "Thông báo tương lai", message: "Nội dung vừa được admin đăng.", pinned: false },
    });
    assert.equal(created.status, 201);
    future = created.body.data;
    const bell = await request("/v1/public/notification");
    const feed = await request("/v1/public/feeds");
    assert.deepEqual(bell.body.notifications.map((item) => item.id), [previous.id, future.id, second.id]);
    assert.deepEqual(feed.body, [articleFor(previous), articleFor(future), articleFor(second)]);
    assert.equal(fake.state.reads, 2, "one invalidation should require one shared new read");
    assert.equal(fake.state.writes, 1);
  });

  await t.test("title, body and pin edits update feed cards, detail and bell while retaining publication time", async () => {
    time += 1000;
    const changed = await request(`/admin/notifications/${future.id}`, {
      method: "PATCH", admin: true,
      body: { title: "Tiêu đề đã đổi", message: "Dòng thứ nhất.\n<script>Đây là văn bản</script>", pinned: true },
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.data.created_at, future.created_at);
    assert.notEqual(changed.body.data.updated_at, future.updated_at);
    future = changed.body.data;
    const feed = await request("/v1/public/feeds");
    const detail = await request(`/v1/public/feeds?slug=notification-${future.id}`);
    const bell = await request("/v1/public/notification");
    assert.deepEqual(feed.body, [articleFor(future), articleFor(previous), articleFor(second)]);
    assert.deepEqual(detail.body, articleFor(future));
    assert.equal(detail.body.content.blocks[0].type, "text", "admin text must not become an HTML content block");
    assert.deepEqual(bell.body.notifications.map((item) => item.id), [future.id, previous.id, second.id]);
    assert.equal(fake.state.reads, 3);
  });

  await t.test("deleting old and new notices removes their cards and makes direct detail reload return 404", async () => {
    for (const item of [previous, future]) {
      const removed = await request(`/admin/notifications/${item.id}`, { method: "DELETE", admin: true });
      assert.equal(removed.status, 200);
      assert.deepEqual(removed.body, { success: true });
      const detail = await request(`/v1/public/feeds?slug=notification-${item.id}`);
      assert.equal(detail.status, 404);
      assert.equal(detail.body.success, false);
      assert.equal(detail.headers.get("cache-control"), "no-store");
      const feed = await request("/v1/public/feeds");
      const bell = await request("/v1/public/notification");
      assert.equal(feed.body.some((article) => article.id === item.id), false);
      assert.equal(bell.body.notifications.some((notice) => notice.id === item.id), false);
    }
    assert.deepEqual((await request("/v1/public/feeds")).body, [articleFor(second)]);
    assert.equal(fake.state.reads, 5);
    assert.equal(fake.state.writes, 4);
  });

  await t.test("an expired shared cache surfaces storage failure as 503 rather than an empty successful feed", async () => {
    time += 30_001;
    fake.state.failReads = true;
    for (const path of ["/v1/public/feeds", `/v1/public/feeds?slug=notification-${second.id}`, "/v1/public/notification"]) {
      const result = await request(path);
      assert.equal(result.status, 503);
      assert.equal(result.headers.get("cache-control"), "no-store");
      assert.equal(result.body.success, false);
      assert.equal(Array.isArray(result.body), false);
    }
    fake.state.failReads = false;
    const recovered = await request("/v1/public/feeds");
    assert.equal(recovered.status, 200);
    assert.deepEqual(recovered.body, [articleFor(second)]);
  });
});
