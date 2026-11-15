const { db } = require("../../config/firebase-admin-config");

const COLLECTION = "caption_presets";
const ALLOWED_SECTIONS = new Set([
  "suggest",
  "holiday",
  "decorative",
  "custome",
  "background",
  "image_icon",
  "image_gif",
  "special",
]);
const PROTECTED_PRESET_IDS = new Set([
  "weather",
  "location",
  "time",
  "music",
  "poll",
  "color_palette",
  "star_sign",
  "review",
  "standard",
  "caption:weather",
  "caption:location",
  "caption:time",
  "caption:music",
  "caption:poll",
  "caption:color_palette",
  "caption:star_sign",
  "caption:review",
  "caption:standard",
]);

const cleanText = (value, maxLength = 200) =>
  String(value ?? "").trim().slice(0, maxLength);

const normalizeSectionId = (value) => {
  const sectionId = cleanText(value, 40).toLowerCase();
  if (!ALLOWED_SECTIONS.has(sectionId)) {
    const error = new Error("Nhóm caption không hợp lệ");
    error.status = 400;
    throw error;
  }
  return sectionId;
};

const normalizePresetId = (value) => {
  const presetId = cleanText(value, 100);
  if (!/^[a-zA-Z0-9:_-]+$/.test(presetId)) {
    const error = new Error("ID caption chỉ được chứa chữ, số, dấu :, _ hoặc -");
    error.status = 400;
    throw error;
  }
  return presetId;
};

const normalizeColor = (value, fallback) => {
  const color = cleanText(value, 30);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : fallback;
};

const normalizePreset = (input = {}) => {
  const sectionId = normalizeSectionId(input.sectionId || input.section_id || input.category);
  const presetId = normalizePresetId(input.presetId || input.preset_id || input.overlay_id);
  const overlayId = normalizePresetId(input.overlayId || input.overlay_id || presetId);
  const colorTop = normalizeColor(input.color_top, "#000000");
  const colorBottom = normalizeColor(input.color_bottom, colorTop);
  const textColor = normalizeColor(input.text_color, "#FFFFFF");
  const orderIndex = Number(input.order_index ?? input.order_id ?? 9999);
  const caption = cleanText(input.caption ?? input.preset_caption ?? input.text, 300);
  const icon = cleanText(
    typeof input.icon === "string" ? input.icon : input.icon?.data,
    1000,
  );

  return {
    sectionId,
    presetId,
    overlayId,
    caption,
    icon,
    type: cleanText(input.type || sectionId, 50),
    color_top: colorTop,
    color_bottom: colorBottom,
    text_color: textColor,
    active: input.active !== false,
    order_index: Number.isFinite(orderIndex) ? orderIndex : 9999,
    is_editable: input.is_editable !== false,
    custom: input.custom === true || input.admin_custom === true,
    deleted: input.deleted === true,
  };
};

const documentId = (sectionId, presetId) =>
  Buffer.from(`${sectionId}\u0000${presetId}`).toString("base64url");

const snapshotToList = (snapshot) =>
  snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

const list = async () => {
  if (!db) throw Object.assign(new Error("Firestore chưa sẵn sàng"), { status: 500 });
  return snapshotToList(await db.collection(COLLECTION).get());
};

const save = async (input) => {
  if (!db) throw Object.assign(new Error("Firestore chưa sẵn sàng"), { status: 500 });
  const preset = normalizePreset(input);
  preset.deleted = false;
  preset.updatedAt = new Date().toISOString();
  const id = documentId(preset.sectionId, preset.presetId);
  await db.collection(COLLECTION).doc(id).set(preset, { merge: true });
  return { id, ...preset };
};

const remove = async (sectionIdValue, presetIdValue) => {
  if (!db) throw Object.assign(new Error("Firestore chưa sẵn sàng"), { status: 500 });
  const sectionId = normalizeSectionId(sectionIdValue);
  const presetId = normalizePresetId(presetIdValue);
  if (
    PROTECTED_PRESET_IDS.has(presetId) ||
    presetId.startsWith("holiday_") ||
    presetId.startsWith("star_sign_")
  ) {
    throw Object.assign(new Error("Caption hệ thống không thể bị xoá"), { status: 409 });
  }
  const id = documentId(sectionId, presetId);
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (existing.exists && existing.data()?.custom === true) {
    await ref.delete();
    return { id, sectionId, presetId, deletedPermanently: true };
  }
  await ref.set(
    { sectionId, presetId, deleted: true, active: false, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  return { id, sectionId, presetId };
};

const toThemeItem = (preset) => ({
  id: preset.overlayId === preset.presetId ? undefined : preset.presetId,
  overlay_id: preset.overlayId,
  preset_id: preset.overlayId,
  caption: preset.caption,
  preset_caption: preset.caption,
  text: preset.caption,
  icon: preset.icon ? { data: preset.icon, type: /^https?:\/\//i.test(preset.icon) ? "image" : "emoji" } : {},
  type: preset.type,
  active: preset.active !== false,
  order_id: preset.order_index,
  order_index: preset.order_index,
  background: { colors: [preset.color_top, preset.color_bottom].filter(Boolean) },
  color_top: preset.color_top,
  color_bottom: preset.color_bottom,
  text_color: preset.text_color,
  is_editable: preset.is_editable !== false,
  source: "admin",
  admin_custom: preset.custom === true,
});

const applyOverrides = (themes, overrides) => {
  const result = (themes || []).map((section) => ({
    ...section,
    items: Array.isArray(section.items) ? [...section.items] : [],
  }));

  for (const rawOverride of overrides || []) {
    let preset;
    try {
      preset = normalizePreset(rawOverride);
    } catch {
      continue;
    }
    let section = result.find((candidate) => candidate.items.some(
      (item) => (item.id || item.admin_id || item.preset_id || item.overlay_id) === preset.presetId,
    ));
    const existingSection = section;
    if (!section) section = result.find((item) => item.section_id === preset.sectionId);
    const existingIndex = section?.items.findIndex(
      (item) => (item.id || item.admin_id || item.preset_id || item.overlay_id) === preset.presetId,
    ) ?? -1;

    if (preset.deleted) {
      if (existingIndex >= 0) section.items.splice(existingIndex, 1);
      continue;
    }

    if (!section) {
      section = {
        section_id: preset.sectionId,
        name: preset.sectionId,
        order_id: result.length + 1,
        active: true,
        items: [],
      };
      result.push(section);
    }

    const themeItem = toThemeItem(preset);
    if (existingSection && existingIndex >= 0) {
      section.items[existingIndex] = { ...section.items[existingIndex], ...themeItem };
    } else {
      section.items.push(themeItem);
    }
  }

  for (const section of result) {
    section.items.sort((a, b) =>
      Number(a.order_index ?? a.order_id ?? 9999) - Number(b.order_index ?? b.order_id ?? 9999),
    );
  }
  return result;
};

const applyStoredOverrides = async (themes) => {
  try {
    return applyOverrides(themes, await list());
  } catch (error) {
    console.warn("[caption-presets] Dùng caption mặc định:", error.message);
    return themes;
  }
};

module.exports = {
  ALLOWED_SECTIONS,
  PROTECTED_PRESET_IDS,
  applyOverrides,
  applyStoredOverrides,
  list,
  normalizePreset,
  remove,
  save,
};
