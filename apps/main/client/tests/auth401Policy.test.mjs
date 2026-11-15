import test from "node:test";
import assert from "node:assert/strict";
import {
  decideAuth401Action,
  decideRefreshErrorAction,
  isTerminalRefreshError,
} from "../src/libs/auth401Policy.js";

test("refreshes the first 401 but does not logout after a retried request", () => {
  assert.equal(decideAuth401Action({ status: 401 }).action, "refresh-and-retry");
  assert.equal(
    decideAuth401Action({ status: 401, isRetry: true }).action,
    "reject-no-logout",
  );
});

test("only explicit terminal codes destroy the local session", () => {
  const terminal = {
    response: { data: { code: "REFRESH_TOKEN_EXPIRED", terminal: true } },
  };
  const temporary = {
    response: { data: { code: "UPSTREAM_UNAVAILABLE", terminal: false } },
  };

  assert.equal(isTerminalRefreshError(terminal), true);
  assert.equal(decideRefreshErrorAction(terminal).action, "logout-and-reject");
  assert.equal(isTerminalRefreshError(temporary), false);
  assert.equal(decideRefreshErrorAction(temporary).action, "reject-only");
});
