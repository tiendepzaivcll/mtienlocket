import { create } from "zustand";

/**
 * Store để quản lý modal hiển thị VIP expiry
 */
export const useVipExpiryModal = create((set) => ({
  isOpen: false,
  reason: "VIP_EXPIRED", // "VIP_EXPIRED" | "NO_VIP_SUBSCRIPTION"

  showModal: (reason = "VIP_EXPIRED") => {
    set({ isOpen: true, reason });
  },

  closeModal: () => {
    set({ isOpen: false });
  },

  resetModal: () => {
    set({ isOpen: false, reason: "VIP_EXPIRED" });
  },
}));
