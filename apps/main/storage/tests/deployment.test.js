const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { getStorageConfig, StorageConfigurationError } = require("../config/storage-env");
const { generatePresignedUrlV3 } = require("../src/controllers/PresignedController");

const valid = {
  R2_ENDPOINT: "https://testaccount.r2.cloudflarestorage.com",
  R2_ACCESS_KEY: "test-access-key", R2_SECRET_KEY: "test-secret-key", R2_BUCKET: "test-bucket",
  MEDIA_API_URL: "https://media.example.test/",
};

test("R2 settings require credentials, bucket and separate public HTTPS URL", () => {
  assert.throws(() => getStorageConfig({}), (error) => error instanceof StorageConfigurationError && error.fields.length === 5);
  for (const [field, value] of [
    ["R2_ENDPOINT", "https://not-r2.example.test"],
    ["R2_ENDPOINT", "http://testaccount.r2.cloudflarestorage.com"],
    ["R2_BUCKET", "invalid/bucket"],
    ["MEDIA_API_URL", "http://media.example.test"],
    ["MEDIA_API_URL", "https://user:password@media.example.test"],
    ["MEDIA_API_URL", "https://media.example.test/?token=private"],
  ]) {
    assert.throws(() => getStorageConfig({ ...valid, [field]: value }), (error) => error.fields.includes(field));
  }
  assert.equal(getStorageConfig(valid).mediaUrl, "https://media.example.test");
});

test("health stays available without R2 and destructive routes require a server token", async (t) => {
  const saved = { ...process.env };
  for (const name of Object.keys(valid)) delete process.env[name];
  process.env.STORAGE_INTERNAL_TOKEN = "test-server-only-token";
  delete process.env.CLEANER_KEY_ID;
  const app = require("../app");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base)).status, 200);
    for (const path of ["/api/delete", "/api/cleanByDay"]) {
      await t.test(`${path} rejects missing and incorrect tokens`, async () => {
        for (const token of [undefined, "incorrect-token"]) {
          const response = await fetch(base + path, { method: "POST", headers: {
            "Content-Type": "application/json", ...(token ? { "x-storage-token": token } : {}),
          }, body: "{}" });
          assert.equal(response.status, 401);
        }
        const authorized = await fetch(base + path, { method: "POST", headers: {
          "Content-Type": "application/json", "x-storage-token": process.env.STORAGE_INTERNAL_TOKEN,
        }, body: "{}" });
        assert.equal(authorized.status, 400, "valid internal token reaches handler body validation");
      });
    }
    delete process.env.STORAGE_INTERNAL_TOKEN;
    assert.equal((await fetch(base + "/api/delete", { method: "POST" })).status, 503);
    assert.equal((await fetch(base + "/api/autoCleanByDay", { method: "POST" })).status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
});

test("unconfigured presign returns a useful 503 before creating an S3 client", async () => {
  const saved = process.env.MEDIA_API_URL;
  delete process.env.MEDIA_API_URL;
  const result = {};
  const response = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
  try {
    await generatePresignedUrlV3({ user: { uid: "test-user" }, body: {
      filename: "image.jpg", contentType: "image/jpeg", type: "image",
    } }, response);
    assert.equal(result.status, 503);
    assert.equal(result.body.errorCode, "STORAGE_NOT_CONFIGURED");
    assert.match(result.body.message, /MEDIA_API_URL/);
  } finally {
    if (saved === undefined) delete process.env.MEDIA_API_URL;
    else process.env.MEDIA_API_URL = saved;
  }
});
