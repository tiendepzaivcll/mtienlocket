const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateDownloadedMedia,
} = require("../src/services/DataProcessing/downloadMedia");

test("accepts an R2 object whose bytes and media type match", () => {
  assert.deepEqual(
    validateDownloadedMedia({
      buffer: Buffer.alloc(8),
      expectedSize: 8,
      mediaType: "video",
      contentType: "video/mp4",
    }),
    { actualSize: 8, contentType: "video/mp4" },
  );
});

test("rejects a partial or replaced R2 object", () => {
  assert.throws(
    () =>
      validateDownloadedMedia({
        buffer: Buffer.alloc(7),
        expectedSize: 8,
        mediaType: "video",
        contentType: "video/mp4",
      }),
    (error) => error.code === "R2_MEDIA_SIZE_MISMATCH" && error.status === 409,
  );
});

test("rejects an R2 object with the opposite media type", () => {
  assert.throws(
    () =>
      validateDownloadedMedia({
        buffer: Buffer.alloc(8),
        expectedSize: 8,
        mediaType: "video",
        contentType: "image/jpeg",
      }),
    (error) => error.code === "R2_MEDIA_TYPE_MISMATCH" && error.status === 415,
  );
});
