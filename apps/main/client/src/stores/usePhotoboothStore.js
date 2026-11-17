import { create } from "zustand";

export const usePhotoboothStore = create((set, get) => ({
  photos: [], // [{ blob: Blob, url: string }]
  isComposing: false,

  addPhoto: (photo) => {
    const next = [...get().photos, photo];
    set({ photos: next });
    return next;
  },

  clearPhotos: () => {
    const current = get().photos;
    current.forEach((p) => {
      if (p.url) URL.revokeObjectURL(p.url);
    });
    set({ photos: [], isComposing: false });
  },

  setComposing: (isComposing) => set({ isComposing }),
}));
