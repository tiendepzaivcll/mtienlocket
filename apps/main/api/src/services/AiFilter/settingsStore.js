const MODEL_OPTIONS = Object.freeze([
  Object.freeze({
    id: "kira-nano-banana",
    label: "Kira Nano Banana",
    provider: "kira",
    model: "gemini-2.5-flash-image",
  }),
  Object.freeze({
    id: "kira-2.0-image",
    label: "Kira 2.0 Image",
    provider: "kira",
    model: "kira-2.0-image",
  }),
  Object.freeze({
    id: "kira-hy4-flash-free",
    label: "Kira HY4 Flash Free",
    provider: "kira",
    model: "hy4-flash-free",
  }),
  Object.freeze({
    id: "cloudflare-flux-2-klein-9b",
    label: "Cloudflare FLUX 2 Klein 9B",
    provider: "cloudflare",
    model: "@cf/black-forest-labs/flux-2-klein-9b",
  }),
]);

const DEFAULT_MODEL_ID = "cloudflare-flux-2-klein-9b";
const CACHE_TTL_MS = 30_000;
const LEGACY_MODEL_ALIASES = new Map([
  ["kira-hy-image-v3.5-free", "kira-hy4-flash-free"],
  ["hy-image-v3.5-free", "kira-hy4-flash-free"],
]);

const findModelOption = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const modelId = LEGACY_MODEL_ALIASES.get(normalized) || normalized;
  return MODEL_OPTIONS.find(
    (option) =>
      option.id.toLowerCase() === modelId ||
      option.model.toLowerCase() === modelId,
  ) || null;
};

const envModelOption = () =>
  findModelOption(process.env.AI_FILTER_ACTIVE_MODEL) ||
  findModelOption(process.env.CLOUDFLARE_AI_MODEL) ||
  findModelOption(process.env.KIRA_IMAGE_MODEL) ||
  findModelOption(DEFAULT_MODEL_ID);

const isProviderConfigured = (provider) => {
  if (provider === "kira") {
    return Boolean(String(process.env.KIRA_API_KEY || "").trim());
  }
  if (provider === "cloudflare") {
    const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
    const token = String(process.env.CLOUDFLARE_AI_API_TOKEN || "").trim();
    return /^[a-f0-9]{32}$/i.test(accountId) && Boolean(token);
  }
  return false;
};

function createAiFilterSettingsStore({ getDocument, now = Date.now }) {
  let current = null;
  let checkedAt = 0;
  let pending = null;
  let loadError = false;

  async function load({ force = false } = {}) {
    if (!force && checkedAt && now() - checkedAt < CACHE_TTL_MS) return current;
    if (pending) return pending;

    pending = (async () => {
      try {
        const ref = getDocument();
        if (!ref) {
          loadError = true;
          return current;
        }
        const document = await ref.get();
        const option = document.exists
          ? findModelOption(document.data()?.modelId)
          : null;
        current = option
          ? {
              modelId: option.id,
              updatedAt: document.data()?.updatedAt || null,
            }
          : null;
        loadError = false;
      } catch {
        // A temporary Firestore issue must not stop image generation. Keep the
        // last known selection and otherwise fall back to the server env.
        loadError = true;
      } finally {
        checkedAt = now();
      }
      return current;
    })().finally(() => {
      pending = null;
    });

    return pending;
  }

  async function save(modelId) {
    const option = findModelOption(modelId);
    if (!option) {
      const error = new Error("Mô hình AI không được hỗ trợ.");
      error.status = 400;
      error.code = "AI_FILTER_MODEL_INVALID";
      throw error;
    }

    const ref = getDocument();
    if (!ref) {
      const error = new Error("Firestore chưa sẵn sàng để lưu mô hình AI.");
      error.status = 503;
      error.code = "AI_FILTER_SETTINGS_UNAVAILABLE";
      throw error;
    }

    const updatedAt = new Date(now()).toISOString();
    await ref.set({ modelId: option.id, updatedAt });
    current = { modelId: option.id, updatedAt };
    checkedAt = now();
    loadError = false;
    return current;
  }

  return {
    load,
    save,
    peek: () => current,
    loadFailed: () => loadError,
  };
}

const settingsStore = createAiFilterSettingsStore({
  getDocument: () => {
    if (!process.env.FIREBASE_PROJECT_ID) return null;
    const { db } = require("../../config/firebase-admin-config");
    return db?.collection("server_settings").doc("ai_filter_model") || null;
  },
});

const getActiveModel = async ({ force = false } = {}) => {
  const saved = await settingsStore.load({ force });
  return findModelOption(saved?.modelId) || envModelOption();
};

const getSettingsStatus = async ({ force = false } = {}) => {
  const active = await getActiveModel({ force });
  const saved = settingsStore.peek();
  return {
    activeModelId: active.id,
    source: saved ? "admin" : "env",
    updatedAt: saved?.updatedAt || null,
    storageAvailable: !settingsStore.loadFailed(),
    models: MODEL_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
      provider: option.provider,
      configured: isProviderConfigured(option.provider),
    })),
  };
};

module.exports = {
  DEFAULT_MODEL_ID,
  MODEL_OPTIONS,
  createAiFilterSettingsStore,
  envModelOption,
  findModelOption,
  getActiveModel,
  getSettingsStatus,
  isProviderConfigured,
  settingsStore,
};
