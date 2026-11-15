import test from "node:test";
import assert from "node:assert/strict";
import {
  isChunkLoadError,
  isUploadBusy,
  shouldReloadForVersion,
} from "../src/utils/pwaUtils/updatePolicy.js";

test("PWA update waits while an upload is active", () => {
  assert.equal(isUploadBusy({ isQueueRunning: true }), true);
  assert.equal(
    isUploadBusy({ uploadItems: [{ status: "uploading" }] }),
    true,
  );
  assert.equal(isUploadBusy({ uploadItems: [{ status: "failed" }] }), false);
});

test("chunk recovery recognizes browser dynamic import errors", () => {
  assert.equal(
    isChunkLoadError(new Error("Failed to fetch dynamically imported module")),
    true,
  );
  assert.equal(isChunkLoadError(new Error("ordinary validation error")), false);
});

test("version reload has a per-commit loop guard", () => {
  assert.equal(
    shouldReloadForVersion({ runningCommit: "old", serverCommit: "new" }),
    true,
  );
  assert.equal(
    shouldReloadForVersion({
      runningCommit: "old",
      serverCommit: "new",
      guardCommit: "new",
    }),
    false,
  );
});
