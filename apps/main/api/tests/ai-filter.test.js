const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const aiFilterService = require("../src/services/AiFilter");
const {
  _private: { hasAiFilterAccess },
} = require("../src/middlewares/requireAiFilterAccess");

test("AI Filter catalog exposes all filters without leaking prompts", () => {
  const groups = aiFilterService.publicCatalog().groups;
  const filters = groups.flatMap((group) => group.filters);

  assert.equal(groups.length, 7);
  assert.equal(filters.length, 36);
  assert.equal(new Set(filters.map((filter) => filter.filter_id)).size, 36);
  assert.equal(filters.some((filter) => "prompt" in filter), false);
});

test("AI Filter result parser returns the generated image", () => {
  const result = aiFilterService._private.extractCloudflareGeneratedImage({
    success: true,
    result: { image: "data:image/png;base64,aGVsbG8=" },
  });

  assert.deepEqual(result, {
    imageBase64: "aGVsbG8=",
    mimeType: "image/png",
    text: "",
  });
});

test("AI Filter detects the bare JPEG base64 returned by Cloudflare", () => {
  const result = aiFilterService._private.extractCloudflareGeneratedImage({
    success: true,
    result: { image: "/9j/2Q==" },
  });

  assert.equal(result.imageBase64, "/9j/2Q==");
  assert.equal(result.mimeType, "image/jpeg");
});

test("AI Filter blocks private network addresses", () => {
  assert.equal(aiFilterService._private.isPrivateAddress("127.0.0.1"), true);
  assert.equal(aiFilterService._private.isPrivateAddress("192.168.0.10"), true);
  assert.equal(aiFilterService._private.isPrivateAddress("8.8.8.8"), false);
  assert.equal(aiFilterService._private.isPrivateAddress("::1"), true);
});

test("AI Filter normalizes provider input to a bounded JPEG", async () => {
  const source = await sharp({
    create: {
      width: 1800,
      height: 1200,
      channels: 4,
      background: { r: 25, g: 80, b: 140, alpha: 0.75 },
    },
  })
    .webp()
    .toBuffer();

  const result = await aiFilterService._private.normalizeInputImage(
    source,
    "image/webp",
  );
  const output = Buffer.from(result.data, "base64");
  const metadata = await sharp(output).metadata();

  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.byteLength, output.length);
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 683);
});

test("AI Filter builds a fixed Cloudflare endpoint and validates model names", () => {
  const { cloudflareEndpoint, resolveCloudflareModel } = aiFilterService._private;

  assert.equal(
    resolveCloudflareModel("@cf/black-forest-labs/flux-2-klein-9b"),
    "@cf/black-forest-labs/flux-2-klein-9b",
  );
  assert.equal(
    resolveCloudflareModel("https://malicious.example/model"),
    "@cf/black-forest-labs/flux-2-klein-9b",
  );
  assert.equal(
    cloudflareEndpoint({
      accountId: "52e104a64ac21a3a7e548efc29c42c25",
      model: "@cf/black-forest-labs/flux-2-klein-9b",
    }),
    "https://api.cloudflare.com/client/v4/accounts/52e104a64ac21a3a7e548efc29c42c25/ai/run/@cf/black-forest-labs/flux-2-klein-9b",
  );
});

test("AI Filter parses Kira base64 responses", async () => {
  const result = await aiFilterService._private.extractKiraGeneratedImage({
    data: [{ b64_json: "/9j/2Q==", mime_type: "image/jpeg" }],
  });

  assert.deepEqual(result, {
    imageBase64: "/9j/2Q==",
    mimeType: "image/jpeg",
    text: "",
  });
});

test("AI Filter access requires an active account with explicit permission", () => {
  assert.equal(hasAiFilterAccess({ active: true, aiFilterEnabled: true }), true);
  assert.equal(hasAiFilterAccess({ active: true }), false);
  assert.equal(hasAiFilterAccess({ active: true, aiFilterEnabled: false }), false);
  assert.equal(hasAiFilterAccess({ active: false, aiFilterEnabled: true }), false);
  assert.equal(hasAiFilterAccess({ disabled: true, aiFilterEnabled: true }), false);
});
