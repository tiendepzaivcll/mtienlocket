const test = require("node:test");
const assert = require("node:assert/strict");
const appCheckService = require(
  "../src/services/AppCheck/appCheckService",
);
const { instanceAppcheck } = require("../src/libs/instanceAppcheck");
const { _private, normalizeDeviceCheckToken } = appCheckService;

test("normalizes current and legacy DeviceCheck shapes", () => {
  assert.deepEqual(normalizeDeviceCheckToken("abc"), {
    deviceToken: "abc",
    limitedUse: false,
  });
  assert.deepEqual(
    normalizeDeviceCheckToken({ device_token: "legacy", limited_use: true }),
    { deviceToken: "legacy", limitedUse: true },
  );
});

test("keeps generated App Check TTL below the upstream expiry", () => {
  assert.equal(_private.parseTtlSeconds("3600s"), 3300);
  assert.equal(_private.parseTtlSeconds("invalid"), 3300);
});

test("recognizes expired JWT App Check tokens", () => {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }),
  ).toString("base64url");
  assert.equal(_private.tokenIsUsable(`${header}.${payload}.signature`), false);
});

test("exchanges DeviceCheck once and reuses the generated token cache", async () => {
  const originalPost = instanceAppcheck.post;
  const previous = {
    direct: process.env.LOCKET_APP_CHECK_TOKEN,
    firebase: process.env.FIREBASE_APPCHECK_TOKEN,
    device: process.env.LOCKET_APP_CHECK_DEVICE_TOKEN,
  };
  let calls = 0;
  let capturedBody;

  try {
    delete process.env.LOCKET_APP_CHECK_TOKEN;
    delete process.env.FIREBASE_APPCHECK_TOKEN;
    process.env.LOCKET_APP_CHECK_DEVICE_TOKEN = "device-source";
    _private.reset();
    instanceAppcheck.post = async (_url, body) => {
      calls += 1;
      capturedBody = body;
      return { data: { token: "generated-token", ttl: "3600s" } };
    };

    const first = await appCheckService.getOrCreateAppCheckToken();
    const second = await appCheckService.getOrCreateAppCheckToken();

    assert.equal(first, "generated-token");
    assert.equal(second, "generated-token");
    assert.equal(calls, 1);
    assert.deepEqual(capturedBody, {
      device_token: "device-source",
      limited_use: false,
    });
  } finally {
    instanceAppcheck.post = originalPost;
    _private.reset();
    for (const [key, value] of [
      ["LOCKET_APP_CHECK_TOKEN", previous.direct],
      ["FIREBASE_APPCHECK_TOKEN", previous.firebase],
      ["LOCKET_APP_CHECK_DEVICE_TOKEN", previous.device],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("force refresh bypasses a configured token rejected by Firebase", async () => {
  const originalPost = instanceAppcheck.post;
  const previous = {
    direct: process.env.LOCKET_APP_CHECK_TOKEN,
    device: process.env.LOCKET_APP_CHECK_DEVICE_TOKEN,
  };

  try {
    process.env.LOCKET_APP_CHECK_TOKEN = "configured-token";
    process.env.LOCKET_APP_CHECK_DEVICE_TOKEN = "device-source";
    _private.reset();
    instanceAppcheck.post = async () => ({
      data: { token: "fresh-generated-token", ttl: "3600s" },
    });

    assert.equal(
      await appCheckService.getOrCreateAppCheckToken(),
      "configured-token",
    );
    assert.equal(
      await appCheckService.getOrCreateAppCheckToken({ forceRefresh: true }),
      "fresh-generated-token",
    );
  } finally {
    instanceAppcheck.post = originalPost;
    _private.reset();
    for (const [key, value] of [
      ["LOCKET_APP_CHECK_TOKEN", previous.direct],
      ["LOCKET_APP_CHECK_DEVICE_TOKEN", previous.device],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
