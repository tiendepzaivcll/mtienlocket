// stores/useOverlayStore.js
import { create } from "zustand";
import { getAllOverlayCaption } from "@/services";

const USER_CAPTION_KEY = "Yourcaptions";
const CAPTION_OVERLAYS_CACHE_KEY = "captionOverlays:v7-admin";
const LEGACY_CAPTION_OVERLAYS_CACHE_KEYS = [
  "captionOverlays",
  "captionOverlays:v2",
  "captionOverlays:v5-holiday-icons",
  "captionOverlays:v6-native-time",
];

const sortByOrderIndex = (themes) => {
  return [...themes].sort(
    (a, b) => (a.order_index ?? a.order_id ?? 9999) - (b.order_index ?? b.order_id ?? 9999)
  );
};

const EXCLUDED_OVERLAY_IDS = new Set(["tis_the_season"]);
const DEFAULT_CAPTION_MEDIA_COLORS = ["#3A3A3C", "#1C1C1E"];

const normalizeThemeItem = (item, section = {}) => {
  const overlayId = item.overlay_id || item.preset_id || item.id;
  const caption = item.caption ?? item.preset_caption ?? item.text ?? "";
  const itemType = item.type || section.type;
  const iconData =
    typeof item.icon === "string"
      ? item.icon
      : item.icon?.data || item.icon?.url || "";
  const isNativeTimeCaption =
    itemType === "time" ||
    overlayId === "time" ||
    overlayId === "caption:time" ||
    iconData.includes("/holiday_indicators/");
  let backgroundColors = Array.isArray(item.background?.colors)
    ? item.background.colors
    : Array.isArray(item.background)
      ? item.background
      : [item.color_top || item.top, item.color_bottom || item.color_bot].filter(Boolean);

  backgroundColors = backgroundColors.filter((color) => color && typeof color === "string");

  if (isNativeTimeCaption) {
    backgroundColors = [];
  }

  if (
    !isNativeTimeCaption &&
    backgroundColors.length < 2 &&
    (itemType === "caption_image" ||
      itemType === "image_icon" ||
      section.section_id === "caption_icon_by_locketdio")
  ) {
    backgroundColors = DEFAULT_CAPTION_MEDIA_COLORS;
  }

  return {
    ...item,
    admin_id: item.admin_id || item.id || item.preset_id || overlayId,
    section_id: item.section_id || section.section_id,
    section_name: item.section_name || section.name,
    overlay_id: overlayId,
    preset_id: item.preset_id || overlayId,
    type: isNativeTimeCaption ? "time" : itemType,
    caption,
    preset_caption: item.preset_caption ?? caption,
    color_top: isNativeTimeCaption
      ? ""
      : item.color_top || item.top || backgroundColors[0] || "",
    color_bottom: isNativeTimeCaption
      ? ""
      : item.color_bottom || item.color_bot || backgroundColors[1] || "",
    text_color: item.text_color || item.color_text || "#FFFFFF",
    background: {
      ...(typeof item.background === "object" && !Array.isArray(item.background)
        ? item.background
        : {}),
      colors: backgroundColors,
    },
    order_index: item.order_index ?? item.order_id ?? 9999,
  };
};

const flattenThemes = (themes = []) =>
  themes.flatMap((theme) => {
    if (Array.isArray(theme.items)) {
      return theme.items.map((item) => normalizeThemeItem(item, theme));
    }
    return [normalizeThemeItem(theme)];
  }).filter((item) => item.active !== false && !EXCLUDED_OVERLAY_IDS.has(item.overlay_id));

const groupThemesByType = (themes) => {
  const flatThemes = flattenThemes(Array.isArray(themes) ? themes : []);

  return {
    suggest: sortByOrderIndex(flatThemes.filter((t) => t.section_id === "suggest")),
    holiday: sortByOrderIndex(flatThemes.filter((t) => t.section_id === "holiday" || t.type === "holiday")),
    decorative: sortByOrderIndex(flatThemes.filter((t) => t.section_id === "decorative" || t.type === "decorative")),
    custome: sortByOrderIndex(
      flatThemes.filter((t) => t.section_id === "decorative_by_t97" || t.section_id === "decorative_by_dio" || t.type === "custome" || t.type === "template")
    ),
    background: sortByOrderIndex(flatThemes.filter((t) => t.type === "background")),
    image_icon: sortByOrderIndex(
      flatThemes.filter((t) => t.section_id === "caption_icon_by_locketdio" || t.type === "image_icon" || t.type === "caption_image")
    ),
    image_gif: sortByOrderIndex(flatThemes.filter((t) => t.type === "image_gif" || t.type === "caption_gif")),
    special: sortByOrderIndex(flatThemes.filter((t) => t.type === "special")),
  };
};

const normalizeGroupedThemes = (grouped = {}) => ({
  suggest: sortByOrderIndex((grouped.suggest || []).map((item) => normalizeThemeItem(item))),
  holiday: sortByOrderIndex((grouped.holiday || []).map((item) => normalizeThemeItem(item))),
  decorative: sortByOrderIndex((grouped.decorative || []).map((item) => normalizeThemeItem(item))),
  custome: sortByOrderIndex((grouped.custome || []).map((item) => normalizeThemeItem(item))),
  background: sortByOrderIndex((grouped.background || []).map((item) => normalizeThemeItem(item))),
  image_icon: sortByOrderIndex((grouped.image_icon || []).map((item) => normalizeThemeItem(item))),
  image_gif: sortByOrderIndex((grouped.image_gif || []).map((item) => normalizeThemeItem(item))),
  special: sortByOrderIndex((grouped.special || []).map((item) => normalizeThemeItem(item))),
});

const overlayIdentity = (item = {}) =>
  item.admin_id || item.id || item.preset_id || item.overlay_id;

const cacheCaptionOverlays = (captionOverlays) => {
  sessionStorage.setItem(CAPTION_OVERLAYS_CACHE_KEY, JSON.stringify(captionOverlays));
};

export const useOverlayStore = create((set, get) => ({
  captionOverlays: {
    suggest: [],
    holiday: [],
    decorative: [],
    custome: [],
    background: [],
    image_icon: [],
    image_gif: [],
    special: [],
  },
  isLoading: false,
  error: null,

  fetchCaptionOverlays: async () => {
    // tránh gọi API nhiều lần
    if (get().captionOverlays.decorative.length > 0) return;

    set({ isLoading: true, error: null });

    try {
      // check sessionStorage
      for (const key of LEGACY_CAPTION_OVERLAYS_CACHE_KEYS) {
        sessionStorage.removeItem(key);
      }

      const result = await getAllOverlayCaption();
      if (!Array.isArray(result)) throw new Error("Không tải được danh sách caption");
      const grouped = groupThemesByType(result);

      sessionStorage.setItem(CAPTION_OVERLAYS_CACHE_KEY, JSON.stringify(grouped));

      set({
        captionOverlays: grouped,
        isLoading: false,
      });
    } catch (err) {
      console.error("Lỗi khi fetch themes:", err);
      const cached = sessionStorage.getItem(CAPTION_OVERLAYS_CACHE_KEY);
      const fallback = cached ? normalizeGroupedThemes(JSON.parse(cached)) : null;
      set({
        ...(fallback ? { captionOverlays: fallback } : {}),
        error: err,
        isLoading: false,
      });
    }
  },

  // optional: clear cache khi cần
  clearCaptionOverlays: () => {
    sessionStorage.removeItem(CAPTION_OVERLAYS_CACHE_KEY);
    for (const key of LEGACY_CAPTION_OVERLAYS_CACHE_KEYS) {
      sessionStorage.removeItem(key);
    }
    set({
      captionOverlays: {
        suggest: [],
        holiday: [],
        decorative: [],
        custome: [],
        background: [],
        image_icon: [],
        image_gif: [],
        special: [],
      },
    });
  },

   /* ===============================
   *  USER CAPTIONS (LOCAL)
   * =============================== */
  userCaptions: JSON.parse(localStorage.getItem(USER_CAPTION_KEY) || "[]"),

  loadUserCaptions: () => {
    const saved = JSON.parse(localStorage.getItem(USER_CAPTION_KEY) || "[]");
    set({ userCaptions: saved });
  },

  addUserCaptionById: async (captionId) => {
    const error = new Error("Tính năng thêm caption bằng mã đã được tắt");
    console.warn("Bỏ qua caption id:", captionId);
    return { success: false, error };
  },

  removeUserCaption: (id) => {
    const updated = get().userCaptions.filter((c) => c.id !== id);
    localStorage.setItem(USER_CAPTION_KEY, JSON.stringify(updated));
    set({ userCaptions: updated });
  },

  clearUserCaptions: () => {
    localStorage.removeItem(USER_CAPTION_KEY);
    set({ userCaptions: [] });
  },

  /* ===============================
   *  CAPTION OVERLAY MANAGEMENT
   * =============================== */
  
  // Update an existing caption in a specific type
  updateCaptionOverlay: (typeKey, presetId, updates) => {
    const current = get().captionOverlays;
    if (!current[typeKey]) return;

    const updated = sortByOrderIndex(current[typeKey].map((item) =>
      overlayIdentity(item) === presetId ? normalizeThemeItem({ ...item, ...updates }) : item
    ));

    const captionOverlays = {
      ...current,
      [typeKey]: updated,
    };

    set({ captionOverlays });
    cacheCaptionOverlays(captionOverlays);

    // Also update localStorage if editing user-saved captions
    if (typeKey === "customized" || typeKey === "themed") {
      const allCaptions = [];
      const updatedState = get().captionOverlays;
      Object.values(updatedState).forEach((typeItems) => {
        if (Array.isArray(typeItems)) {
          allCaptions.push(...typeItems);
        }
      });
      localStorage.setItem(USER_CAPTION_KEY, JSON.stringify(allCaptions));
    }
  },

  // Delete a caption from a specific type
  deleteCaptionOverlay: (typeKey, presetId) => {
    const current = get().captionOverlays;
    if (!current[typeKey]) return;

    const updated = current[typeKey].filter((item) => overlayIdentity(item) !== presetId);

    const captionOverlays = {
      ...current,
      [typeKey]: updated,
    };

    set({ captionOverlays });
    cacheCaptionOverlays(captionOverlays);

    // Also update localStorage if deleting user-saved captions
    if (typeKey === "customized" || typeKey === "themed" || typeKey === "gif" || typeKey === "icon" || typeKey === "image") {
      const allCaptions = [];
      const updatedState = get().captionOverlays;
      Object.values(updatedState).forEach((typeItems) => {
        if (Array.isArray(typeItems)) {
          allCaptions.push(...typeItems);
        }
      });
      localStorage.setItem(USER_CAPTION_KEY, JSON.stringify(allCaptions));
    }
  },

  // Add a new caption to a specific type
  addCaptionOverlay: (typeKey, captionData) => {
    const current = get().captionOverlays;
    if (!current[typeKey]) return false;

    // Ensure caption has all required fields
    const newCaption = {
      preset_id: captionData.preset_id || `custom_${Date.now()}`,
      caption: captionData.caption || "",
      color_top: captionData.color_top || "#000000",
      color_bottom: captionData.color_bottom || "#000000",
      text_color: captionData.text_color || "#FFFFFF",
      icon: captionData.icon || "✨",
      type: typeKey,
      ...captionData,
    };

    const updated = sortByOrderIndex([
      ...current[typeKey].filter((item) => overlayIdentity(item) !== overlayIdentity(newCaption)),
      normalizeThemeItem(newCaption),
    ]);

    const captionOverlays = {
      ...current,
      [typeKey]: updated,
    };

    set({ captionOverlays });
    cacheCaptionOverlays(captionOverlays);

    // Also update localStorage
    const allCaptions = [];
    const updatedState = get().captionOverlays;
    Object.values(updatedState).forEach((typeItems) => {
      if (Array.isArray(typeItems)) {
        allCaptions.push(...typeItems);
      }
    });
    localStorage.setItem(USER_CAPTION_KEY, JSON.stringify(allCaptions));

    return true;
  },
}));
