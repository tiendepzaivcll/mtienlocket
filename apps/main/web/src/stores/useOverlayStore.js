// stores/useOverlayStore.js
import { create } from "zustand";
import { getAllOverlayCaption, getCollabCaption } from "@/services";
import { MOCK_SECTIONS } from "./mockCaptions";

const USER_CAPTION_KEY = "Yourcaptions";

const sortByOrderIndex = (themes) => {
  return [...themes].sort(
    (a, b) => (a.order_index ?? 9999) - (b.order_index ?? 9999)
  );
};

// Helper: Normalize caption item to match component expectations
const normalizeCaption = (item) => ({
  ...item,
  // Ensure all caption label fields are set
  caption: item.caption || item.text || item.preset_caption || item.overlay_id || "",
  preset_caption: item.preset_caption || item.text || item.caption || item.overlay_id || "",

  // Ensure color fields from API format
  color_top: item.background?.colors?.[0] || item.color_top || "#000000",
  color_bottom: item.background?.colors?.[1] || item.color_bottom || "#000000",

  // Ensure consistent ID field
  preset_id: item.overlay_id || item.preset_id || item.id || "",

  // Backup text color
  text_color: item.text_color || "#FFFFFF",

  // Normalize icon: always object {type, data}
  icon:
    (item.icon && typeof item.icon === 'object' && item.icon.type && item.icon.data)
      ? item.icon
      : (typeof item.icon === 'string' && item.icon.startsWith('data:image/svg'))
        ? { type: 'svg', data: item.icon }
        : (typeof item.icon === 'string' && item.icon.startsWith('data:image/gif'))
          ? { type: 'gif', data: item.icon }
          : (typeof item.icon === 'string' && item.icon.trim().length === 2) // emoji
            ? { type: 'emoji', data: item.icon }
            : (typeof item.icon === 'string' && item.icon.trim().length === 1)
              ? { type: 'emoji', data: item.icon }
              : { type: 'emoji', data: '✨' }, // fallback default
});

// Helper: Flatten sections format to items array
const flattenSections = (sections) => {
  return sections.flatMap((section) => 
    section.items.map((item) => {
      const normalized = normalizeCaption({
        ...item,
        section_name: section.name,
        section_id: section.section_id,
      });
      return normalized;
    })
  );
};

// List of allowed decorative caption IDs/names
const ALLOWED_DECORATIVE = [
  "st. patty's day",
  "st_pattys_day",
  "tình yêu của mình đây",
  "mừng ngày phụ nữ",
  "ngày phụ nữ",
  "'tis the season",
  "tis_the_season",
  "party time",
  "party_time",
  "good morning",
  "good_morning",
  "good night",
  "good_night",
  "miss you",
  "miss_you",
  "ootd",
];

const isAllowedDecorative = (item) => {
  const caption = (item.caption || item.preset_caption || item.text || item.overlay_id || "").toLowerCase();
  const overlayId = (item.overlay_id || item.preset_id || "").toLowerCase();

  return ALLOWED_DECORATIVE.some(allowed =>
    caption.includes(allowed.toLowerCase()) ||
    overlayId.includes(allowed.toLowerCase().replace(/[' ]/g, '_'))
  );
};

const groupThemesByType = (themes) => {
  const decorativeAll = themes.filter((t) => t.type === "decorative" || t.type === "template");
  const decorativeFiltered = sortByOrderIndex(decorativeAll.filter(isAllowedDecorative));

  const grouped = {
    suggest: sortByOrderIndex(themes.filter((t) => t.section_id === "suggest")),
    decorative: decorativeFiltered,
    custome: sortByOrderIndex(themes.filter((t) => t.type === "template" || (t.type === "custom" && !t.background))),
    background: sortByOrderIndex(themes.filter((t) => t.type === "custom" || t.background || (t.type === "background"))),
    image_icon: sortByOrderIndex(themes.filter((t) => t.type === "image_icon" || t.type === "caption_image")),
    image_gif: sortByOrderIndex(themes.filter((t) => t.type === "image_gif" || t.type === "caption_gif")),
    special: sortByOrderIndex(themes.filter((t) => t.type === "special")),
  };
  
  console.log("📊 Grouped themes by type:", {
    suggest: grouped.suggest.length,
    decorative: grouped.decorative.length,
    custome: grouped.custome.length,
    background: grouped.background.length,
    image_icon: grouped.image_icon.length,
    image_gif: grouped.image_gif.length,
    special: grouped.special.length,
  });
  
  return grouped;
};

// 🎨 MOCK DATA - Dữ liệu mẫu cho các caption type chưa có
const MOCK_CAPTIONS = [
  // ===== SUGGEST THEME (Background) =====
  {
    preset_id: "galaxy",
    type: "background",
    overlay_id: "galaxy",
    color_top: "#5733FF",
    color_bottom: "#FF33B5",
    text_color: "#FFFFFF",
    caption: "",
    background: ["#5733FF", "#FF33B5"],
    icon: { type: "emoji", data: "🌈" },
    order_index: 0,
  },
  {
    preset_id: "peachy",
    type: "background",
    overlay_id: "peachy",
    color_top: "#FF9500",
    color_bottom: "#FF2D95",
    text_color: "#FFFFFF",
    caption: "",
    background: ["#FF9500", "#FF2D95"],
    icon: { type: "emoji", data: "🍑" },
    order_index: 1,
  },
  {
    preset_id: "sunset",
    type: "background",
    overlay_id: "sunset",
    color_top: "#FF5733",
    color_bottom: "#FFC300",
    text_color: "#FFFFFF",
    caption: "",
    background: ["#FF5733", "#FFC300"],
    icon: { type: "emoji", data: "🌅" },
    order_index: 2,
  },
  {
    preset_id: "aqua_fresh",
    type: "background",
    overlay_id: "aqua_fresh",
    color_top: "#33FF57",
    color_bottom: "#33CFFF",
    text_color: "#FFFFFF",
    caption: "",
    background: ["#33FF57", "#33CFFF"],
    icon: { type: "emoji", data: "💧" },
    order_index: 3,
  },
  {
    preset_id: "bubblegum",
    type: "background",
    overlay_id: "bubblegum",
    color_top: "#FF85B3",
    color_bottom: "#FFDDC1",
    text_color: "#333333",
    caption: "",
    background: ["#FF85B3", "#FFDDC1"],
    icon: { type: "emoji", data: "🍭" },
    order_index: 4,
  },
  {
    preset_id: "cotton_candy",
    type: "background",
    overlay_id: "cotton_candy",
    color_top: "#00B5FF",
    color_bottom: "#FFB6C1",
    text_color: "#FFFFFF",
    caption: "",
    background: ["#00B5FF", "#FFB6C1"],
    icon: { type: "emoji", data: "🍬" },
    order_index: 5,
  },

  // ===== CAPTION ĐẶC BIỆT (Special) =====
  {
    preset_id: "special:snow",
    type: "special",
    preset_caption: "❄️ Tuyết rơi",
    color_top: "#E0F4FF",
    color_bottom: "#B0E0E6",
    text_color: "#FFFFFF",
    icon: { type: "emoji", data: "❄️" },
    order_index: 0,
  },
  {
    preset_id: "special:fireworks",
    type: "special",
    preset_caption: "🎆 Pháo hoa",
    color_top: "#FF1493",
    color_bottom: "#FFD700",
    text_color: "#FFFFFF",
    icon: { type: "emoji", data: "🎆" },
    order_index: 1,
  },
  {
    preset_id: "special:sparkle",
    type: "special",
    preset_caption: "✨ Lấp lánh",
    color_top: "#FFD700",
    color_bottom: "#FF69B4",
    text_color: "#FFFFFF",
    icon: { type: "emoji", data: "✨" },
    order_index: 2,
  },
  {
    preset_id: "special:rain",
    type: "special",
    preset_caption: "🌧️ Mưa cát",
    color_top: "#4B0082",
    color_bottom: "#87CEEB",
    text_color: "#FFFFFF",
    icon: { type: "emoji", data: "🌧️" },
    order_index: 3,
  },

  // ===== CAPTION ICON (Image Icon - Early Access) =====
  {
    id: "icon:locket_gold_badge",
    type: "image_icon",
    preset_caption: "locket_gold_badge",
    icon: "/caption-icon/locket_gold_badge.png",
    color_top: "#FFD700",
    color_bottom: "#FFA500",
    text_color: "#FFFFFF",
    order_index: 0,
  },
  {
    id: "icon:celebrity_badge",
    type: "image_icon",
    preset_caption: "celebrity_badge",
    icon: "/caption-icon/celebrity_badge.png",
    color_top: "#8B5CF6",
    color_bottom: "#6D28D9",
    text_color: "#FFFFFF",
    order_index: 1,
  },
  {
    id: "icon:icon_locket_default",
    type: "image_icon",
    preset_caption: "icon_locket_default",
    icon: "/caption-icon/icon_locket_default.png",
    color_top: "#FFD700",
    color_bottom: "#FFA500",
    text_color: "#000000",
    order_index: 2,
  },
  {
    id: "icon:streak_restore",
    type: "image_icon",
    preset_caption: "Streakkkk!",
    icon: "/caption-icon/streak_restore.png",
    color_top: "#FF6B35",
    color_bottom: "#F72585",
    text_color: "#FFFFFF",
    order_index: 3,
  },
  {
    id: "icon:icon_pastel_3d_blue",
    type: "image_icon",
    preset_caption: "icon_pastel_3d_blue",
    icon: "/caption-icon/icon_pastel_3d_blue.png",
    color_top: "#00D4FF",
    color_bottom: "#0099CC",
    text_color: "#FFFFFF",
    order_index: 4,
  },
  {
    id: "icon:pastel_3d_pink",
    type: "image_icon",
    preset_caption: "pastel_3d_pink",
    icon: "/caption-icon/pastel_3d_pink.png",
    color_top: "#FF85B3",
    color_bottom: "#FF1493",
    text_color: "#FFFFFF",
    order_index: 5,
  },
  {
    id: "icon:gold_on_black_outline",
    type: "image_icon",
    preset_caption: "gold_on_black_outline",
    icon: "/caption-icon/gold_on_black_outline.png",
    color_top: "#1C1C1C",
    color_bottom: "#000000",
    text_color: "#FFD700",
    order_index: 6,
  },
  {
    id: "icon:locket_gold_logo",
    type: "image_icon",
    preset_caption: "locket_normal",
    icon: "/caption-icon/locket_gold_logo.png",
    color_top: "#FFD700",
    color_bottom: "#FF8C00",
    text_color: "#FFFFFF",
    order_index: 7,
  },
  {
    id: "icon:light_hearts",
    type: "image_icon",
    preset_caption: "light_hearts",
    icon: "/caption-icon/light_hearts.png",
    color_top: "#FF85B3",
    color_bottom: "#FFDDC1",
    text_color: "#FFFFFF",
    order_index: 8,
  },
  {
    id: "icon:flowers_magenta",
    type: "image_icon",
    preset_caption: "flowers_magenta",
    icon: "/caption-icon/flowers_magenta.png",
    color_top: "#FF00FF",
    color_bottom: "#8B008B",
    text_color: "#FFFFFF",
    order_index: 9,
  },
  {
    id: "icon:gem_bg_pink",
    type: "image_icon",
    preset_caption: "gem_bg_pink",
    icon: "/caption-icon/gem_bg_pink.png",
    color_top: "#FF69B4",
    color_bottom: "#FF1493",
    text_color: "#FFFFFF",
    order_index: 10,
  },
  {
    id: "icon:birthday_indicator",
    type: "image_icon",
    preset_caption: "Happy Birthday!",
    icon: "/caption-icon/birthday_indicator.png",
    color_top: "#FF6B6B",
    color_bottom: "#4ECDC4",
    text_color: "#FFFFFF",
    order_index: 11,
  },
  {
    id: "icon:aries",
    type: "image_icon",
    preset_caption: "Mùa Bạch Dương",
    icon: "/caption-icon/Aries.png",
    color_top: "#FF4500",
    color_bottom: "#FF6347",
    text_color: "#FFFFFF",
    order_index: 12,
  },
  {
    id: "icon:flame_fill",
    type: "image_icon",
    preset_caption: "Flame Fill",
    icon: "/caption-icon/flame_fill.png",
    color_top: "#FF6B35",
    color_bottom: "#F72585",
    text_color: "#FFFFFF",
    order_index: 13,
  },

  // ===== CAPTION GIF (Image Gif - Early Access) =====
  {
    id: "gif:party",
    type: "image_gif",
    preset_caption: "🎉 Tiệc tùng",
    icon: { type: "gif", data: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" },
    order_index: 0,
  },
  {
    id: "gif:celebration",
    type: "image_gif",
    preset_caption: "🎊 Ăn mừng",
    icon: { type: "gif", data: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" },
    order_index: 1,
  },
  {
    id: "gif:love",
    type: "image_gif",
    preset_caption: "💕 Yêu thương",
    icon: { type: "gif", data: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" },
    order_index: 2,
  },
];

export const useOverlayStore = create((set, get) => ({
  captionOverlays: {
    suggest: [],
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
    set({ isLoading: true, error: null });

    try {
      // Clear old cache to always get fresh data
      sessionStorage.removeItem("captionOverlays");

      // 🚀 Gọi API để lấy caption themes từ backend
      const apiData = await getAllOverlayCaption();
      console.log("📥 API Caption Themes raw response:", apiData);

      let result = [];

      // ✅ Nếu API trả về dữ liệu (sections format), flatten it
      if (apiData && Array.isArray(apiData) && apiData.length > 0) {
        const firstItem = apiData[0];
        console.log("🔍 First item structure:", firstItem);
        
        // Check if API data is sections format
        if (firstItem?.items && firstItem?.section_id) {
          // Format: [{ section_id, items: [...] }, ...]
          console.log("✅ Detected sections format - flattening...");
          result = flattenSections(apiData);
          console.log("✅ Loaded from API (sections format):", result.length, "items");
          console.table(result.slice(0, 3));
        } else {
          // Format: already flattened items
          console.log("ℹ️ Detected flat format");
          result = apiData;
          console.log("✅ Loaded from API (flat format):", result.length, "items");
        }
      } else {
        console.warn("⚠️ API returned empty data, using mock data");
        result = flattenSections(MOCK_SECTIONS);
      }
      
      const grouped = groupThemesByType(result);
      console.log("📤 Final grouped data ready for components");
      console.log("  ├─ suggest:", grouped.suggest.length, "items");
      console.log("  ├─ background:", grouped.background.length, "items");
      console.log("  ├─ decorative:", grouped.decorative.length, "items");
      console.log("  ├─ custome:", grouped.custome.length, "items");
      console.log("  ├─ image_icon:", grouped.image_icon.length, "items");
      console.log("  ├─ image_gif:", grouped.image_gif.length, "items");
      console.log("  └─ special:", grouped.special.length, "items");
      
      // Log sample items to verify normalization
      if (grouped.suggest.length > 0) {
        console.log("📋 Sample suggest item:", grouped.suggest[0]);
      }
      if (grouped.background.length > 0) {
        console.log("📋 Sample background item:", grouped.background[0]);
      }
      if (grouped.decorative.length > 0) {
        console.log("📋 Sample decorative item:", grouped.decorative[0]);
      }
      if (grouped.image_icon.length > 0) {
        console.log("📋 Sample image_icon item:", grouped.image_icon[0]);
      }

      sessionStorage.setItem("captionOverlays", JSON.stringify(grouped));

      set({
        captionOverlays: grouped,
        isLoading: false,
      });
    } catch (err) {
      console.error("❌ Lỗi khi fetch themes từ API:", err);
      
      // 🔄 Fallback: nếu API fail, dùng mock data
      const mockItems = flattenSections(MOCK_SECTIONS);
      const grouped = groupThemesByType(mockItems);
      set({
        captionOverlays: grouped,
        error: err,
        isLoading: false,
      });
    }
  },

  // optional: clear cache khi cần
  clearCaptionOverlays: () => {
    sessionStorage.removeItem("captionOverlays");
    set({
      captionOverlays: {
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
   *  USER CAPTIONS KANADE (LOCAL)
   * =============================== */
  userCaptions: JSON.parse(localStorage.getItem(USER_CAPTION_KEY) || "[]"),

  loadUserCaptions: () => {
    const saved = JSON.parse(localStorage.getItem(USER_CAPTION_KEY) || "[]");
    set({ userCaptions: saved });
  },

  addUserCaptionById: async (captionId) => {
    try {
      const result = await getCollabCaption(captionId);

      if (!result) throw new Error("Caption not found");

      const current = get().userCaptions;

      const updated = [
        result,
        ...current.filter((c) => c.id !== result.id),
      ];

      localStorage.setItem(USER_CAPTION_KEY, JSON.stringify(updated));
      set({ userCaptions: updated });

      return { success: true };
    } catch (error) {
      console.error("Lỗi khi thêm caption:", error);
      return { success: false, error };
    }
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

    const updated = current[typeKey].map((item) =>
      item.preset_id === presetId ? { ...item, ...updates } : item
    );

    set({
      captionOverlays: {
        ...current,
        [typeKey]: updated,
      },
    });

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

    const updated = current[typeKey].filter((item) => item.preset_id !== presetId);

    set({
      captionOverlays: {
        ...current,
        [typeKey]: updated,
      },
    });

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

    const updated = [...current[typeKey], newCaption];

    set({
      captionOverlays: {
        ...current,
        [typeKey]: updated,
      },
    });

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
