const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");

const {
  preserveSubmittedOverlay,
} = require("../src/services/LocketMoment/preserveSubmittedOverlay");
const {
  LOCKET_IMAGE_OUTPUT_MAX_BYTES,
  assertLocketImageOutput,
} = require("../src/config/imageUploadPolicy");
const {
  processImageBuffer,
} = require("../src/services/DataProcessing/processImageBuffer");

test("immediate post response keeps the submitted native overlay", () => {
  const result = preserveSubmittedOverlay(
    { id: "moment-1", caption: "", overlays: [] },
    {
      data: {
        overlays: [
          {
            overlay_id: "caption:weather",
            overlay_type: "caption",
            data: {
              type: "weather",
              text: "30°C",
              payload: { wk_condition: "thunderstorms" },
            },
          },
        ],
      },
    },
  );

  assert.equal(result.id, "moment-1");
  assert.equal(result.caption, "30°C");
  assert.equal(result.overlays[0].overlay_id, "caption:weather");
});

test("real server overlay is never replaced by a submitted snapshot", () => {
  const result = preserveSubmittedOverlay(
    {
      id: "moment-2",
      caption: "Server caption",
      overlays: [{ data: { type: "weather", text: "Server caption" } }],
    },
    {
      data: {
        overlays: [{ data: { type: "weather", text: "Local caption" } }],
      },
    },
  );

  assert.equal(result.caption, "Server caption");
  assert.equal(result.overlays[0].data.text, "Server caption");
});

test("Firebase image policy rejects an object above one megabyte", () => {
  assert.doesNotThrow(() =>
    assertLocketImageOutput(Buffer.alloc(LOCKET_IMAGE_OUTPUT_MAX_BYTES)),
  );
  assert.throws(
    () =>
      assertLocketImageOutput(
        Buffer.alloc(LOCKET_IMAGE_OUTPUT_MAX_BYTES + 1),
      ),
    (error) => error?.code === "IMAGE_OUTPUT_BUDGET_EXCEEDED",
  );
});

test("image processor keeps a smaller native square without upscaling", async () => {
  const source = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 30, g: 110, b: 210 },
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const output = await processImageBuffer({
    imageBuffer: source,
    resolution: 2048,
    maxSizeMB: 2,
  });
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, 800);
  assert.ok(output.length <= LOCKET_IMAGE_OUTPUT_MAX_BYTES);
});
