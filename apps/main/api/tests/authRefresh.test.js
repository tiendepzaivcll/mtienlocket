const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRefreshTokenRequestBody,
  classifyFirebaseRefreshError,
} = require("../src/services/LocketAuth/AuthService");

test("uses Firebase secure-token form field names", () => {
  const body = new URLSearchParams(buildRefreshTokenRequestBody("refresh value"));
  assert.equal(body.get("grant_type"), "refresh_token");
  assert.equal(body.get("refresh_token"), "refresh value");
  assert.equal(body.has("grantType"), false);
});

test("classifies explicit invalid refresh tokens as terminal", () => {
  const error = classifyFirebaseRefreshError({
    response: { status: 400, data: { error: { message: "INVALID_REFRESH_TOKEN" } } },
  });
  assert.equal(error.status, 401);
  assert.equal(error.code, "REFRESH_TOKEN_INVALID");
  assert.equal(error.terminal, true);
});

test("keeps unknown upstream and network errors non-terminal", () => {
  const upstream = classifyFirebaseRefreshError({
    response: { status: 401, data: { error: { message: "UNKNOWN" } } },
  });
  const network = classifyFirebaseRefreshError(new Error("network timeout"));

  assert.equal(upstream.status, 502);
  assert.equal(upstream.terminal, false);
  assert.equal(network.status, 503);
  assert.equal(network.terminal, false);
});
