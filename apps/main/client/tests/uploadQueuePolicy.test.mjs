import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_UPLOAD_AUTO_RETRY,
  UPLOAD_QUEUE_ERROR,
  classifyUploadFailure,
  shouldAutoRetryUpload,
  shouldResumeAfterReconnect,
  uploadRetryRemainingMs,
} from "../src/stores/PostStores/uploadQueuePolicy.js";

test("upload policy retries temporary server failures with a limit", () => {
  const policy = classifyUploadFailure({ response: { status: 503 } });
  assert.equal(policy.code, UPLOAD_QUEUE_ERROR.SERVER);
  assert.equal(shouldAutoRetryUpload({}, policy, 0), true);
  assert.equal(shouldAutoRetryUpload({}, policy, MAX_UPLOAD_AUTO_RETRY), false);
});

test("upload policy does not retry exhausted Firebase permission failures", () => {
  const policy = classifyUploadFailure({
    code: "FIREBASE_STORAGE_FINALIZE_FORBIDDEN",
    response: { status: 403 },
  });
  assert.equal(policy.code, UPLOAD_QUEUE_ERROR.STORAGE_REJECTED);
  assert.equal(policy.autoRetry, false);
});

test("upload policy recognizes transfer-stage Firebase permission failures", () => {
  const result = classifyUploadFailure({
    response: {
      status: 403,
      data: { code: "FIREBASE_STORAGE_TRANSFER_FORBIDDEN" },
    },
  });
  assert.equal(result.code, UPLOAD_QUEUE_ERROR.STORAGE_REJECTED);
  assert.equal(result.autoRetry, false);
});

test("upload policy separates missing R2 media from temporary R2 outages", () => {
  const missing = classifyUploadFailure({
    response: { status: 404, data: { code: "R2_MEDIA_NOT_FOUND" } },
  });
  const outage = classifyUploadFailure({
    response: { status: 502, data: { code: "R2_DOWNLOAD_FAILED" } },
  });
  assert.equal(missing.code, UPLOAD_QUEUE_ERROR.MEDIA_EXPIRED);
  assert.equal(missing.autoRetry, false);
  assert.equal(outage.code, UPLOAD_QUEUE_ERROR.STORAGE_REJECTED);
  assert.equal(outage.autoRetry, true);
});

test("only recoverable failures from the current page session resume", () => {
  const item = { queueSessionId: "current", errorCode: UPLOAD_QUEUE_ERROR.OFFLINE };
  assert.equal(shouldResumeAfterReconnect(item, "current"), true);
  assert.equal(shouldResumeAfterReconnect(item, "old"), false);
});

test("upload retry countdown reaches zero without becoming negative", () => {
  assert.equal(uploadRetryRemainingMs({ nextRetryAt: 5000 }, 3000), 2000);
  assert.equal(uploadRetryRemainingMs({ nextRetryAt: 5000 }, 6000), 0);
});
