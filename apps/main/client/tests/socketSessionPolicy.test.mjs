import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSocketSessionUid,
  shouldForceSocketReconnect,
} from "../src/socket/socketSessionPolicy.js";

test("socket session uses stored localId even when cached user has no uid", () => {
  assert.equal(
    resolveSocketSessionUid({
      storedLocalId: "firebase-user-id",
      user: { username: "cached-user" },
    }),
    "firebase-user-id",
  );
});

test("socket session falls back to supported user identity fields", () => {
  assert.equal(
    resolveSocketSessionUid({ user: { localId: "local-id" } }),
    "local-id",
  );
  assert.equal(resolveSocketSessionUid({ user: { uid: "uid" } }), "uid");
  assert.equal(resolveSocketSessionUid({ user: {} }), null);
});

test("only an explicit server disconnect needs a forced reconnect", () => {
  assert.equal(shouldForceSocketReconnect("io server disconnect"), true);
  assert.equal(shouldForceSocketReconnect("transport close"), false);
  assert.equal(shouldForceSocketReconnect("ping timeout"), false);
});
