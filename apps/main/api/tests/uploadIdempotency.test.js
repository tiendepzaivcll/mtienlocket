const test = require("node:test");
const assert = require("node:assert/strict");
const {
  runIdempotentUpload,
  _private,
} = require("../src/services/LocketMoment/uploadIdempotency");
const {
  isValidClientUploadId,
} = require("../src/middlewares/upload-idempotency");

test.beforeEach(() => {
  _private.results.clear();
  _private.inFlight.clear();
});

test("accepts UUID upload keys and rejects oversized or unsafe keys", () => {
  assert.equal(
    isValidClientUploadId("550e8400-e29b-41d4-a716-446655440000"),
    true,
  );
  assert.equal(isValidClientUploadId("../unsafe key"), false);
  assert.equal(isValidClientUploadId("a".repeat(129)), false);
});

test("replays a successful upload without executing it twice", async () => {
  let calls = 0;
  const work = async () => {
    calls += 1;
    return { momentId: "moment-1" };
  };

  const first = await runIdempotentUpload({
    userId: "user-1",
    clientUploadId: "upload-1",
    work,
  });
  const second = await runIdempotentUpload({
    userId: "user-1",
    clientUploadId: "upload-1",
    work,
  });

  assert.equal(calls, 1);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.deepEqual(second.result, { momentId: "moment-1" });
});

test("joins concurrent requests for the same upload", async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const work = async () => {
    calls += 1;
    await gate;
    return "done";
  };

  const first = runIdempotentUpload({
    userId: "user-2",
    clientUploadId: "upload-2",
    work,
  });
  const second = runIdempotentUpload({
    userId: "user-2",
    clientUploadId: "upload-2",
    work,
  });
  release();

  const outcomes = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(outcomes.filter((item) => item.replayed).length, 1);
});

test("does not cache failed uploads", async () => {
  let calls = 0;
  const work = async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary");
    return "ok";
  };

  await assert.rejects(
    runIdempotentUpload({
      userId: "user-3",
      clientUploadId: "upload-3",
      work,
    }),
    /temporary/,
  );
  const retry = await runIdempotentUpload({
    userId: "user-3",
    clientUploadId: "upload-3",
    work,
  });

  assert.equal(calls, 2);
  assert.equal(retry.result, "ok");
});
