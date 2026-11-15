import test from "node:test";
import assert from "node:assert/strict";
import {
  assertJsonSerializable,
  toJsonSerializable,
} from "../src/utils/standardize/jsonSerializable.js";

test("removes cyclic branches from a restored upload payload", () => {
  const payload = {
    contentType: "image",
    mediaInfo: { publicUrl: "https://media.example.com/image.jpg" },
    options: { caption: "hello" },
  };
  payload.resumeState = { payload };

  const safe = assertJsonSerializable(payload);

  assert.equal(safe.options.caption, "hello");
  assert.equal(safe.resumeState.payload, undefined);
  assert.doesNotThrow(() => JSON.stringify(safe));
});

test("keeps repeated non-cyclic values and normalizes JSON edge cases", () => {
  const shared = { value: 1 };
  const safe = toJsonSerializable({
    first: shared,
    second: shared,
    count: 12n,
    invalidNumber: Number.NaN,
  });

  assert.deepEqual(safe.first, { value: 1 });
  assert.deepEqual(safe.second, { value: 1 });
  assert.equal(safe.count, "12");
  assert.equal(safe.invalidNumber, null);
});
