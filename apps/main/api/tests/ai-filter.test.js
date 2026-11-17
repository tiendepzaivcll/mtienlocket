const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const axios = require("axios");
const dns = require("node:dns").promises;
const aiFilterService = require("../src/services/AiFilter");
const { settingsStore } = require("../src/services/AiFilter/settingsStore");
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

test("HY4 chat selection is rejected before DNS, input download or provider generation", async (t) => {
  t.mock.method(settingsStore, "load", async () => ({ modelId: "kira-hy4-flash-free" }));
  t.mock.method(dns, "lookup", async () => { assert.fail("Unsupported model must not resolve input image host"); });
  t.mock.method(axios, "get", async () => { assert.fail("Unsupported model must not download input image"); });
  t.mock.method(axios, "post", async () => { assert.fail("Unsupported model must not call an image provider"); });
  const filterId = aiFilterService.publicCatalog().groups[0].filters[0].filter_id;
  await assert.rejects(
    aiFilterService.generateFilteredImage({ imageUrl: "https://127.0.0.1/private.jpg", filterId }),
    (error) => error.status === 409 && error.code === "AI_FILTER_MODEL_NOT_IMAGE" &&
      /HY4/.test(error.message) && /không tạo được ảnh/.test(error.message),
  );
});

test("Kira image models receive normalized raw base64 image objects instead of public URLs", async (t) => {
  const previousEnv = Object.fromEntries(["KIRA_API_KEY", "KIRA_API_BASE_URL", "AI_FILTER_ALLOWED_IMAGE_HOSTS"]
    .map((key) => [key, process.env[key]]));
  process.env.KIRA_API_KEY = "test-key-not-a-real-provider-credential";
  process.env.KIRA_API_BASE_URL = "https://kira.invalid/api/v1";
  process.env.AI_FILTER_ALLOWED_IMAGE_HOSTS = "media.example.com";
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const inputUrl = "https://media.example.com/input.png";
  const source = await sharp({ create: { width: 80, height: 60, channels: 4,
    background: { r: 30, g: 80, b: 150, alpha: 0.6 } } }).png().toBuffer();
  const expected = await aiFilterService._private.normalizeInputImage(source, "image/png");
  const filterId = aiFilterService.publicCatalog().groups[0].filters[0].filter_id;
  t.mock.method(dns, "lookup", async (host) => {
    assert.equal(host, "media.example.com");
    return [{ address: "93.184.216.34", family: 4 }];
  });
  t.mock.method(axios, "get", async (url, options) => {
    assert.equal(url, inputUrl);
    assert.equal(options.maxRedirects, 0, "input download keeps redirect protection");
    assert.equal(options.maxContentLength, 12 * 1024 * 1024);
    return { data: source, headers: { "content-type": "image/png" } };
  });
  let selectedModelId;
  const posted = [];
  t.mock.method(settingsStore, "load", async () => ({ modelId: selectedModelId }));
  t.mock.method(axios, "post", async (endpoint, payload, options) => {
    assert.equal(endpoint, "https://kira.invalid/api/v1/images/generations");
    assert.equal(payload.aspect_ratio, "1:1");
    assert.equal(payload.size, "1024x1024");
    assert.ok(payload.prompt);
    assert.deepEqual(payload.reference_images, [{ mime_type: "image/jpeg", data: expected.data }]);
    assert.equal(payload.reference_images[0].data.startsWith("data:"), false);
    assert.equal(JSON.stringify(payload).includes(inputUrl), false);
    assert.equal(options.headers.Authorization, "Bearer test-key-not-a-real-provider-credential");
    posted.push(payload.model);
    return { data: { data: [{ b64_json: "/9j/2Q==", mime_type: "image/jpeg" }] } };
  });

  for (const [id, model] of [["kira-nano-banana", "gemini-2.5-flash-image"], ["kira-2.0-image", "kira-2.0-image"]]) {
    selectedModelId = id;
    const result = await aiFilterService.generateFilteredImage({ imageUrl: inputUrl, filterId });
    assert.equal(result.model, model);
    assert.equal(result.provider, "kira");
    assert.equal(result.imageBase64, "/9j/2Q==");
    assert.equal(result.mimeType, "image/jpeg");
  }
  assert.deepEqual(posted, ["gemini-2.5-flash-image", "kira-2.0-image"]);
});
