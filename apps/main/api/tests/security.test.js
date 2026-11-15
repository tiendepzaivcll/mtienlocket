const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  createRateLimiter,
  _private: rateLimitPrivate,
} = require("../src/middlewares/rate-limit");
const {
  validateUploadPayload,
  isPrivateHostname,
} = require("../src/middlewares/validate-upload-payload");
const { normalizeRoute } = require("../src/middlewares/request-telemetry");

function mockResponse() {
  const res = new EventEmitter();
  res.headers = {};
  res.statusCode = 200;
  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
  res.status = (status) => {
    res.statusCode = status;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

test.beforeEach(() => rateLimitPrivate.buckets.clear());

test("rate limiter rejects requests above a scoped quota", () => {
  const limiter = createRateLimiter({
    name: "test",
    windowMs: 60_000,
    limit: 1,
    keyGenerator: () => "same-user",
  });
  const request = { ip: "127.0.0.1" };
  let calls = 0;

  limiter(request, mockResponse(), () => {
    calls += 1;
  });
  const blocked = mockResponse();
  limiter(request, blocked, () => {
    calls += 1;
  });

  assert.equal(calls, 1);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.code, "RATE_LIMITED");
});

test("R2 payload validation requires a complete external media reference", () => {
  const validRequest = {
    body: {
      mediaInfo: {
        type: "image",
        publicUrl: "https://media.example.com/a.jpg",
        path: "uploads/a.jpg",
        size: 1024,
      },
    },
  };
  let continued = false;
  validateUploadPayload(validRequest, mockResponse(), () => {
    continued = true;
  });
  assert.equal(continued, true);

  const invalidResponse = mockResponse();
  validateUploadPayload(
    { body: { mediaInfo: { type: "image", size: 1024 } } },
    invalidResponse,
    () => {},
  );
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(invalidResponse.body.code, "R2_MEDIA_INFO_MISSING");
});

test("private download targets are identifiable for production SSRF defense", () => {
  assert.equal(isPrivateHostname("127.0.0.1"), true);
  assert.equal(isPrivateHostname("192.168.0.10"), true);
  assert.equal(isPrivateHostname("media.example.com"), false);
});

test("telemetry removes long dynamic ids from route labels", () => {
  assert.equal(
    normalizeRoute("get", "/items/abcdefghijklmnopqrstuvwxyz1234567890?token=x"),
    "GET /items/:id",
  );
});
