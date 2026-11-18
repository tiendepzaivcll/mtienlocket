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
    supportsImageGeneration: false,
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

const envModelOption = (customKiraKey) => {
  const explicit =
    findModelOption(process.env.AI_FILTER_ACTIVE_MODEL) ||
    findModelOption(process.env.CLOUDFLARE_AI_MODEL) ||
    findModelOption(process.env.KIRA_IMAGE_MODEL);

  if (explicit && isProviderConfigured(explicit.provider, customKiraKey)) {
    return explicit;
  }

  const kiraConfigured = isProviderConfigured("kira", customKiraKey);
  const cloudflareConfigured = isProviderConfigured("cloudflare");

  if (kiraConfigured && !cloudflareConfigured) {
    return findModelOption("kira-nano-banana") || findModelOption("kira-2.0-image");
  }
  if (cloudflareConfigured && !kiraConfigured) {
    return findModelOption("cloudflare-flux-2-klein-9b");
  }

  return explicit || findModelOption(DEFAULT_MODEL_ID) || findModelOption("kira-nano-banana");
};

const isProviderConfigured = (provider, customKiraKey) => {
  if (provider === "kira") {
    return Boolean(String(customKiraKey || settingsStore?.peek?.()?.kiraApiKey || process.env.KIRA_API_KEY || "").trim());
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
        const doc = await ref.get();
        if (!doc || !doc.exists) {
          current = null;
          loadError = false;
          return current;
        }
        const data = doc.data() || {};
        const option = findModelOption(data.modelId);
        current = {
          modelId: option ? option.id : null,
          kiraApiKey: typeof data.kiraApiKey === "string" ? data.kiraApiKey.trim() : null,
          updatedAt: data.updatedAt || null,
        };
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

  async function save(payload) {
    const modelId = typeof payload === "string" ? payload : payload?.modelId;
    const kiraApiKey = typeof payload === "object" ? payload?.kiraApiKey : undefined;

    const option = modelId ? findModelOption(modelId) : null;
    if (modelId && !option) {
      const error = new Error("Mô hình AI không được hỗ trợ.");
      error.status = 400;
      error.code = "AI_FILTER_MODEL_INVALID";
      throw error;
    }

    const ref = getDocument();
    if (!ref) {
      const error = new Error("Firestore chưa sẵn sàng để lưu cấu hình AI.");
      error.status = 503;
      error.code = "AI_FILTER_SETTINGS_UNAVAILABLE";
      throw error;
    }

    const updatedAt = new Date(now()).toISOString();
    const updateData = { updatedAt };
    if (option) updateData.modelId = option.id;
    if (typeof kiraApiKey === "string") updateData.kiraApiKey = kiraApiKey.trim();

    await ref.set(updateData, { merge: true });
    current = {
      ...(current || {}),
      ...updateData,
    };
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
  const savedModel = findModelOption(saved?.modelId);
  const customKey = saved?.kiraApiKey || null;
  const selected = (savedModel && isProviderConfigured(savedModel.provider, customKey) && savedModel.supportsImageGeneration !== false)
    ? savedModel
    : envModelOption(customKey);
  return {
    ...selected,
    kiraApiKey: customKey,
  };
};

const getSettingsStatus = async ({ force = false } = {}) => {
  const active = await getActiveModel({ force });
  const saved = settingsStore.peek();
  const customKey = saved?.kiraApiKey || "";
  const effectiveKiraKey = customKey || String(process.env.KIRA_API_KEY || "").trim();
  const maskedKey = effectiveKiraKey
    ? (effectiveKiraKey.length > 8 ? `${effectiveKiraKey.slice(0, 4)}••••${effectiveKiraKey.slice(-4)}` : "••••••••")
    : null;

  return {
    activeModelId: active.id,
    supportsImageGeneration: active.supportsImageGeneration !== false,
    source: saved?.modelId ? "admin" : "env",
    updatedAt: saved?.updatedAt || null,
    storageAvailable: !settingsStore.loadFailed(),
    hasKiraApiKey: Boolean(effectiveKiraKey),
    kiraApiKeyMasked: maskedKey,
    hasCustomKiraKey: Boolean(customKey),
    models: MODEL_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
      provider: option.provider,
      supportsImageGeneration: option.supportsImageGeneration !== false,
      configured: isProviderConfigured(option.provider, customKey),
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
