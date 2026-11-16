const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");

const TEST_SECRET = "notifications-route-test-secret-only";
const originalSecret = process.env.ADMIN_JWT_SECRET;
const originalPassword = process.env.ADMIN_PASSWORD;
process.env.ADMIN_JWT_SECRET = TEST_SECRET;
process.env.ADMIN_PASSWORD = "notifications-route-test-password-only";
const adminRouter = require("../src/routes/admin.route");
const publicRouter = require("../src/routes/public.route");
const notificationStore = require("../src/services/Notifications/store");
if (originalSecret === undefined) delete process.env.ADMIN_JWT_SECRET;
else process.env.ADMIN_JWT_SECRET = originalSecret;
if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
else process.env.ADMIN_PASSWORD = originalPassword;

test("notification routes keep admin CRUD authenticated and expose public announcements safely", async (t) => {
  const originalMethods = Object.fromEntries(
    ["list", "create", "update", "remove"].map((name) => [name, notificationStore[name]]),
  );
  const calls = [];
  let items = [];
  let failure = null;
  const timestamp = "2026-11-16T06:00:00.000Z";
  const raiseFailure = () => { if (failure) throw failure; };
  notificationStore.list = async (options) => {
    calls.push({ method: "list", options });
    raiseFailure();
    return items.map((item) => ({ ...item }));
  };
  notificationStore.create = async (input) => {
    calls.push({ method: "create", input });
    raiseFailure();
    const item = { id: "notice-one", title: input.title, message: input.message,
      pinned: input.pinned, created_at: timestamp, updated_at: timestamp, author: "MTIEN" };
    items.push(item);
    return { ...item };
  };
  notificationStore.update = async (id, input) => {
    calls.push({ method: "update", id, input });
    raiseFailure();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw Object.assign(new Error("Không tìm thấy thông báo"), { status: 404 });
    items[index] = { ...items[index], ...input, updated_at: "2026-11-16T06:01:00.000Z" };
    return { ...items[index] };
  };
  notificationStore.remove = async (id) => {
    calls.push({ method: "remove", id });
    raiseFailure();
    if (!items.some((item) => item.id === id)) {
      throw Object.assign(new Error("Không tìm thấy thông báo"), { status: 404 });
    }
    items = items.filter((item) => item.id !== id);
  };
  t.after(() => Object.assign(notificationStore, originalMethods));

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
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, { method = "GET", token, body } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const adminToken = jwt.sign({ role: "admin" }, TEST_SECRET, { expiresIn: "1h" });
  const nonAdminToken = jwt.sign({ role: "vip" }, TEST_SECRET, { expiresIn: "1h" });
  const forgedToken = jwt.sign({ role: "admin" }, "another-test-key", { expiresIn: "1h" });

  await t.test("all four admin operations reject missing, forged and non-admin credentials", async () => {
    const operations = [
      ["GET", "/admin/notifications"],
      ["POST", "/admin/notifications"],
      ["PATCH", "/admin/notifications/notice-one"],
      ["DELETE", "/admin/notifications/notice-one"],
    ];
    for (const [method, path] of operations) {
      for (const [token, status] of [[undefined, 401], [forgedToken, 403], [nonAdminToken, 403]]) {
        const result = await request(path, {
          method, token, ...(method === "POST" || method === "PATCH"
            ? { body: { title: "Unauthorized notice", message: "Must not persist", pinned: false } } : {}),
        });
        assert.equal(result.status, status, `${method} ${path}`);
        assert.equal(result.body.success, false);
      }
    }
    assert.equal(calls.length, 0, "unauthorized traffic must never reach the notification store");
  });

  await t.test("admin creates, lists and updates a notification while public reads need no login", async () => {
    const input = { title: "Thông báo mới", message: "Hỗ trợ qua admin MTIEN", pinned: false };
    const created = await request("/admin/notifications", { method: "POST", token: adminToken, body: input });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, { success: true, data: {
      id: "notice-one", ...input, created_at: timestamp, updated_at: timestamp, author: "MTIEN",
    } });

    const listed = await request("/admin/notifications", { token: adminToken });
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body, { success: true, data: [created.body.data] });
    assert.equal(calls.at(-1).options?.force, true, "admin refresh must bypass public read cache");

    const changed = await request("/admin/notifications/notice-one", {
      method: "PATCH", token: adminToken, body: { pinned: true, title: "Thông báo đã cập nhật" },
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.data.pinned, true);
    assert.equal(changed.body.data.title, "Thông báo đã cập nhật");
    assert.equal(changed.body.data.created_at, timestamp);
    assert.equal(changed.body.data.author, "MTIEN");

    const publicResult = await request("/v1/public/notification");
    assert.equal(publicResult.status, 200);
    assert.deepEqual(publicResult.body, { success: true, notifications: [changed.body.data] });
    assert.equal(Boolean(calls.at(-1).options?.force), false, "public reads may use the bounded read cache");
    assert.deepEqual(Object.keys(publicResult.body.notifications[0]).sort(),
      ["id", "title", "message", "pinned", "created_at", "updated_at", "author"].sort());
  });

  await t.test("public projection strips internal document fields and keeps the fixed admin attribution", async () => {
    items[0].internalNote = "private-test-metadata";
    items[0].author = "untrusted stored attribution";
    const result = await request("/v1/public/notification");
    assert.equal(result.status, 200);
    const [notice] = result.body.notifications;
    assert.equal(notice.author, "MTIEN");
    assert.equal(notice.internalNote, undefined);
    assert.deepEqual(Object.keys(notice).sort(),
      ["id", "title", "message", "pinned", "created_at", "updated_at", "author"].sort());
    delete items[0].internalNote;
    items[0].author = "MTIEN";
  });

  await t.test("delete persists absence and unknown notification ids return 404", async () => {
    const deleted = await request("/admin/notifications/notice-one", { method: "DELETE", token: adminToken });
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body, { success: true });
    assert.deepEqual((await request("/v1/public/notification")).body,
      { success: true, notifications: [] });
    const missing = await request("/admin/notifications/notice-one", {
      method: "PATCH", token: adminToken, body: { title: "Missing" },
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.success, false);
  });

  await t.test("store outages are surfaced instead of publishing an empty successful result", async () => {
    failure = Object.assign(new Error("Thông báo tạm thời không khả dụng"), { status: 503, code: "NOTIFICATIONS_UNAVAILABLE" });
    const publicFailure = await request("/v1/public/notification");
    assert.equal(publicFailure.status, 503);
    assert.equal(publicFailure.body.success, false);
    assert.equal(publicFailure.body.notifications, undefined);
    const adminFailure = await request("/admin/notifications", { token: adminToken });
    assert.equal(adminFailure.status, 503);
    assert.equal(adminFailure.body.success, false);
    const createFailure = await request("/admin/notifications", {
      method: "POST", token: adminToken, body: { title: "Outage", message: "Must not pretend to save", pinned: false },
    });
    assert.equal(createFailure.status, 503);
    assert.equal(createFailure.body.success, false);
  });
});
