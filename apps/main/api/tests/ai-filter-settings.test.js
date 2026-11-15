const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createAiFilterSettingsStore,
  findModelOption,
} = require("../src/services/AiFilter/settingsStore");

test("AI Filter model registry contains all admin choices", () => {
  assert.equal(findModelOption("kira-nano-banana")?.model, "gemini-2.5-flash-image");
  assert.equal(findModelOption("kira-2.0-image")?.provider, "kira");
  assert.equal(
    findModelOption("kira-hy-image-v3.5-free")?.model,
    "hy-image-v3.5-free",
  );
  assert.equal(
    findModelOption("cloudflare-flux-2-klein-9b")?.model,
    "@cf/black-forest-labs/flux-2-klein-9b",
  );
  assert.equal(findModelOption("unknown-model"), null);
});

test("AI Filter model selection persists and becomes active immediately", async () => {
  let persisted = null;
  let timestamp = 1_700_000_000_000;
  const document = {
    async get() {
      return {
        exists: Boolean(persisted),
        data: () => persisted,
      };
    },
    async set(value) {
      persisted = value;
    },
  };
  const store = createAiFilterSettingsStore({
    getDocument: () => document,
    now: () => timestamp,
  });

  assert.equal(await store.load({ force: true }), null);
  const saved = await store.save("kira-nano-banana");
  assert.equal(saved.modelId, "kira-nano-banana");
  assert.equal(store.peek().modelId, "kira-nano-banana");

  timestamp += 31_000;
  persisted = {
    modelId: "cloudflare-flux-2-klein-9b",
    updatedAt: new Date(timestamp).toISOString(),
  };
  assert.equal(
    (await store.load()).modelId,
    "cloudflare-flux-2-klein-9b",
  );
});

test("AI Filter settings reject unsupported model ids", async () => {
  const store = createAiFilterSettingsStore({
    getDocument: () => ({ set: async () => {} }),
  });

  await assert.rejects(
    () => store.save("arbitrary-provider-model"),
    (error) => error.code === "AI_FILTER_MODEL_INVALID" && error.status === 400,
  );
});
