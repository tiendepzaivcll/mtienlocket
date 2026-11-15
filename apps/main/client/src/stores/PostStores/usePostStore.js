import { create } from "zustand";

const initialRestoreFlow = {
  selectedDate: null,
  pendingDate: null,
  confirmedDate: null,
  mode: null,
  status: "idle",
  error: null,
};

export const usePostStore = create((set) => ({
  caption: "",
  setCaption: (c) => set({ caption: c }),

  selectedColors: { top: "", bottom: "", text: "#FFFFFF" },
  setSelectedColors: (colors) => set({ selectedColors: colors }),

  selectedFile: null,
  setSelectedFile: (file) => set({ selectedFile: file }),

  imageToCrop: null,
  setImageToCrop: (img) => set({ imageToCrop: img }),

  preview: null,
  setPreview: (p) => set({ preview: p }),

  isTextColor: null,
  setTextColor: (val) => set({ isTextColor: val }),

  isSizeMedia: null,
  setSizeMedia: (val) => set({ isSizeMedia: val }),

  audience: "all",
  setAudience: (val) => set({ audience: val }),

  selectedRecipients: [],
  setSelectedRecipients: (recipients) =>
    set({ selectedRecipients: recipients }),

  selectedMoment: null,
  setSelectedMoment: (moment) => set({ selectedMoment: moment }),

  selectedMomentId: null,
  setSelectedMomentId: (id) => set({ selectedMomentId: id }),

  selectedQueue: null,
  setSelectedQueue: (queue) => set({ selectedQueue: queue }),

  selectedQueueId: null,
  setSelectedQueueId: (id) => set({ selectedQueueId: id }),

  selectedFriendUid: null,
  setSelectedFriendUid: (uid) => set({ selectedFriendUid: uid }),

  showEmojiPicker: false,
  setShowEmojiPicker: (val) => set({ showEmojiPicker: val }),

  reactionInfo: { emoji: "💛", moment_id: null, intensity: 1000 },
  setReactionInfo: (info) => set({ reactionInfo: info }),

  restoreStreak: null,
  setRestoreStreak: (val) => set({ restoreStreak: val }),

  restoreFlow: initialRestoreFlow,
  selectRestoreFlowDate: ({ date, mode }) =>
    set((state) => ({
      restoreFlow: {
        ...state.restoreFlow,
        selectedDate: Number(date),
        pendingDate: null,
        mode,
        status: "selected",
        error: null,
      },
    })),
  markRestoreFlowPending: (date) =>
    set((state) => ({
      restoreFlow: {
        ...state.restoreFlow,
        selectedDate: Number(date),
        pendingDate: Number(date),
        status: "pending",
        error: null,
      },
    })),
  markRestoreFlowConfirmed: (date) =>
    set((state) => ({
      restoreStreak: null,
      restoreFlow: {
        ...state.restoreFlow,
        selectedDate: null,
        pendingDate: null,
        confirmedDate: Number(date),
        mode: null,
        status: "confirmed",
        error: null,
      },
    })),
  markRestoreFlowFailed: (date, error) =>
    set((state) => ({
      restoreFlow: {
        ...state.restoreFlow,
        selectedDate: Number(date),
        pendingDate: null,
        status: "failed",
        error: error || "Không thể xác nhận ngày đã chọn.",
      },
    })),
  clearRestoreFlowSelection: () =>
    set((state) => ({
      restoreStreak: null,
      restoreFlow: {
        ...state.restoreFlow,
        selectedDate: null,
        pendingDate: null,
        mode: null,
        status: "idle",
        error: null,
      },
    })),
}));
