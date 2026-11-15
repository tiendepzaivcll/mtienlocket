import { create } from "zustand";

const USER_CAPTION_KEY = "Yourcaptions";

export const useOverlayUserStore = create((set, get) => ({
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
}));
