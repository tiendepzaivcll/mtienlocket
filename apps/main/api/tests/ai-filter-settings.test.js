const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createAiFilterSettingsStore,
  envModelOption,
  findModelOption,
} = require("../src/services/AiFilter/settingsStore");

test("AI Filter model registry contains all admin choices", () => {
  assert.equal(findModelOption("kira-nano-banana")?.model, "gemini-2.5-flash-image");
  assert.equal(findModelOption("kira-2.0-image")?.provider, "kira");
  assert.equal(
    findModelOption("kira-hy4-flash-free")?.model,
    "hy4-flash-free",
  );
  assert.equal(
    findModelOption("cloudflare-flux-2-klein-9b")?.model,
    "@cf/black-forest-labs/flux-2-klein-9b",
  );
  assert.equal(findModelOption("unknown-model"), null);
});

test("HY4 replaces HY Image 3.5 for new choices and legacy identifiers", () => {
  for (const identifier of ["kira-hy4-flash-free", "hy4-flash-free",
    "kira-hy-image-v3.5-free", "hy-image-v3.5-free"]) {
    const option = findModelOption(identifier);
    assert.equal(option.id, "kira-hy4-flash-free");
    assert.equal(option.model, "hy4-flash-free");
    assert.equal(option.label, "Kira HY4 Flash Free");
    assert.equal(option.provider, "kira");
  }
});

test("saved HY Image 3.5 settings load as HY4 and save the canonical model id", async () => {
  let persisted = { modelId: "kira-hy-image-v3.5-free", updatedAt: "2026-11-16T00:00:00.000Z" };
  let writes = 0;
  const store = createAiFilterSettingsStore({
    getDocument: () => ({
      get: async () => ({ exists: true, data: () => persisted }),
      set: async (value) => { writes += 1; persisted = value; },
    }),
  });
  const loaded = await store.load({ force: true });
  assert.equal(loaded.modelId, "kira-hy4-flash-free");
  assert.equal(loaded.updatedAt, "2026-11-16T00:00:00.000Z");
  assert.equal(writes, 0);
  await store.save("hy-image-v3.5-free");
  assert.equal(persisted.modelId, "kira-hy4-flash-free");
  assert.equal(writes, 1);
});

test("legacy model environment settings resolve to HY4", (t) => {
  const names = ["AI_FILTER_ACTIVE_MODEL", "CLOUDFLARE_AI_MODEL", "KIRA_IMAGE_MODEL"];
  const original = names.map((name) => [name, process.env[name]]);
  t.after(() => {
    for (const [name, value] of original) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  for (const name of names) delete process.env[name];
  for (const [name, value] of [["AI_FILTER_ACTIVE_MODEL", "kira-hy-image-v3.5-free"],
    ["KIRA_IMAGE_MODEL", "hy-image-v3.5-free"]]) {
    process.env[name] = value;
    assert.equal(envModelOption().id, "kira-hy4-flash-free");
    assert.equal(envModelOption().model, "hy4-flash-free");
    delete process.env[name];
  }
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
