import { create } from "zustand";
import db from "@/cache/configDB";
import { markAsViewedMoment } from "@/services";

const STORAGE_KEY_PREFIX = "locket_viewed_moments_";

function getStoredViewedIds(userId) {
  if (typeof window === "undefined") return new Set();
  try {
    const key = `${STORAGE_KEY_PREFIX}${userId || "guest"}`;
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistStoredViewedIds(userId, set) {
  if (typeof window === "undefined") return;
  try {
    const key = `${STORAGE_KEY_PREFIX}${userId || "guest"}`;
    const arr = Array.from(set).slice(-1000); // Lưu tối đa 1000 ID gần nhất
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

export const useViewedMomentsStore = create((set, get) => ({
  viewedIds: new Set(getStoredViewedIds("guest")),
  userId: null,
  isInitialized: false,

  init: async (userId) => {
    const targetUserId = userId || "guest";
    const currentUserId = get().userId;
    if (currentUserId === targetUserId && get().isInitialized) return;

    const initialSet = getStoredViewedIds(targetUserId);

    // Đồng bộ thêm từ IndexedDB nếu có
    try {
      if (db?.viewedMoments) {
        const records = await db.viewedMoments.toArray();
        records.forEach((r) => {
          if (r?.id) initialSet.add(r.id);
        });
      }
    } catch {}

    persistStoredViewedIds(targetUserId, initialSet);
    set({ userId: targetUserId, viewedIds: new Set(initialSet), isInitialized: true });
  },

  isViewed: (momentId) => {
    if (!momentId) return false;
    return get().viewedIds.has(momentId);
  },

  markViewed: async (moment) => {
    if (!moment) return;
    const momentId = typeof moment === "string" ? moment : moment?.id;
    if (!momentId) return;

    const { viewedIds, userId } = get();
    if (viewedIds.has(momentId)) return;

    const newSet = new Set(viewedIds);
    newSet.add(momentId);
    persistStoredViewedIds(userId, newSet);
    set({ viewedIds: newSet });

    // Lưu vào IndexedDB
    try {
      if (db?.viewedMoments) {
        await db.viewedMoments.put({
          id: momentId,
          user: typeof moment === "object" ? (moment.user || moment.userUid || null) : null,
          viewedAt: Date.now(),
        });
      }
    } catch {}

    // Gọi API thông báo đã xem
    try {
      await markAsViewedMoment(momentId);
    } catch {}
  },

  markAllViewed: async (moments) => {
    if (!Array.isArray(moments) || moments.length === 0) return;
    const { viewedIds, userId } = get();
    let hasNew = false;
    const newSet = new Set(viewedIds);
    const toPersist = [];

    moments.forEach((m) => {
      const id = typeof m === "string" ? m : m?.id;
      if (id && !newSet.has(id)) {
        newSet.add(id);
        hasNew = true;
        toPersist.push(m);
      }
    });

    if (!hasNew) return;

    persistStoredViewedIds(userId, newSet);
    set({ viewedIds: newSet });

    // Lưu vào IndexedDB
    try {
      if (db?.viewedMoments) {
        const items = toPersist.map((m) => ({
          id: typeof m === "string" ? m : m.id,
          user: typeof m === "object" ? (m.user || m.userUid || null) : null,
          viewedAt: Date.now(),
        }));
        await db.viewedMoments.bulkPut(items);
      }
    } catch {}

    // Gọi API
    toPersist.forEach((m) => {
      const id = typeof m === "string" ? m : m.id;
      markAsViewedMoment(id).catch(() => {});
    });
  },
}));
