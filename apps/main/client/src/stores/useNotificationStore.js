import { create } from "zustand";
import { getNotifications } from "@/services";
import {
  markNotificationsRead,
  notificationReadKey,
  readNotificationState,
  unreadNotifications,
} from "@/utils/notificationReadState";
import { useAuthStore } from "./AuthStore";

const storageForNotifications = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const getAccountId = () => {
  const user = useAuthStore.getState().user;
  return user?.uid || user?.localId || user?.username || null;
};

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unread: [],
  isOpen: false,
  isLoading: false,
  loadError: "",
  isShaking: false,

  setIsOpen: (isOpen) => {
    set({ isOpen });
    if (isOpen) {
      get().markAllAsRead();
    }
  },

  openModal: () => {
    get().setIsOpen(true);
    get().fetchNotifications();
  },

  closeModal: () => {
    set({ isOpen: false });
  },

  fetchNotifications: async () => {
    const accountId = getAccountId();
    const readKey = notificationReadKey(accountId ? `user:${accountId}` : "guest");
    const storage = storageForNotifications();
    const stored = readNotificationState(storage, readKey);

    set({ isLoading: true, loadError: "" });
    try {
      const res = await getNotifications();
      const raw = Array.isArray(res?.data?.notifications) ? res.data.notifications : [];
      const formatted = raw.map((item) => ({
        ...item,
        time: item.created_at ? new Date(item.created_at).toLocaleString("vi-VN") : "",
        createdAt: item.created_at ? new Date(item.created_at).getTime() : 0,
      }));

      // Sắp xếp: Ghim lên trước, sau đó đến mới nhất
      formatted.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.createdAt - a.createdAt;
      });

      const unread = unreadNotifications(formatted, stored);
      const prevUnreadCount = get().unread.length;

      if (unread.length > prevUnreadCount && unread.length > 0) {
        set({ isShaking: true });
        setTimeout(() => set({ isShaking: false }), 2000);
      }

      set({
        notifications: formatted,
        unread,
        isLoading: false,
      });
    } catch (err) {
      set({
        loadError: "Không tải được thông báo mới. Bạn có thể thử lại.",
        isLoading: false,
      });
    }
  },

  markAllAsRead: () => {
    const { notifications } = get();
    if (!notifications.length) return;
    const accountId = getAccountId();
    const readKey = notificationReadKey(accountId ? `user:${accountId}` : "guest");
    const storage = storageForNotifications();
    const stored = readNotificationState(storage, readKey);
    const next = markNotificationsRead(notifications, stored);
    try {
      storage?.setItem(readKey, JSON.stringify(next));
    } catch {}
    set({ unread: [] });
    window.dispatchEvent(
      new CustomEvent("mtien-notifications-read", {
        detail: { key: readKey, values: next },
      }),
    );
  },
}));
