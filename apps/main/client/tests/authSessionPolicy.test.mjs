import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_SESSION_CHANGED,
  assertCurrentAccount,
  assertSameRefreshSession,
  isCurrentAccount,
  isSameRefreshSession,
} from "../src/libs/authSessionPolicy.js";
import { decideRefreshErrorAction } from "../src/libs/auth401Policy.js";

const first = { localId: "account-a", idToken: "access-a", refreshToken: "refresh-a" };
const second = { localId: "account-b", idToken: "access-b", refreshToken: "refresh-b" };
const changed = (error) => error.code === AUTH_SESSION_CHANGED &&
  decideRefreshErrorAction(error).action === "reject-only";

test("delayed refresh cannot restore credentials after logout or replace a new account", () => {
  assert.throws(() => assertSameRefreshSession(first, {}), changed);
  assert.throws(() => assertSameRefreshSession(first, second), changed);
  assert.equal(isSameRefreshSession(first, { ...first }), true);
});

test("refresh credentials rotated in another tab invalidate the old refresh result", () => {
  assert.throws(() => assertSameRefreshSession(first, { ...first, refreshToken: "rotated-a" }), changed);
});

test("old-account successes and 401s are rejected instead of retrying with the new account", () => {
  assert.throws(() => assertCurrentAccount(first.localId, second), changed);
  assert.throws(() => assertCurrentAccount(first.localId, {}), changed);
  assert.equal(isCurrentAccount(null, second), false);
  assert.equal(isCurrentAccount(first.localId, { localId: first.localId }), false);
});

test("ordinary same-account token renewal preserves request identity", () => {
  assert.doesNotThrow(() => assertCurrentAccount(first.localId, {
    ...first, idToken: "renewed-access-a", refreshToken: "rotated-a",
  }));
});
