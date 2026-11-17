import test from "node:test";
import assert from "node:assert/strict";
import { clearAccountStores } from "../src/cache/accountDataPolicy.js";

test("account cleanup includes every personal store before resolving", async () => {
  const cleared = [];
  await clearAccountStores(["main", "uploads", "diary"].map((name) => async () => {
    await Promise.resolve();
    cleared.push(name);
  }));
  assert.deepEqual(cleared.sort(), ["diary", "main", "uploads"]);
});

test("a failed account store does not skip others or return before pending cleanup", async () => {
  let finish;
  let pendingFinished = false;
  const held = new Promise((resolve) => { finish = resolve; });
  const cleanup = clearAccountStores([
    () => { throw new Error("blocked database"); },
    async () => { await held; pendingFinished = true; },
  ]);
  let settled = false;
  cleanup.catch(() => { settled = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  finish();
  await assert.rejects(cleanup, /Chưa xóa hết dữ liệu tài khoản/);
  assert.equal(pendingFinished, true);
});
