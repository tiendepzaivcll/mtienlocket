// src/store/useStreakStore.js
import { create } from "zustand";
import { GetLastestMoment, GetLocketsCount } from "@/services";
import { formatYYYYMMDD } from "@/utils";

const STREAK_KEY = "streak";
const LOCKET_COUNT_KEY = "locket_count";

export const useStreakStore = create((set, get) => ({
  streak: null,
  locketCount: null,
  loading: false,
  locketCountLoading: false,

  // ---------- init from localStorage ----------
  initStreak: () => {
    const cached = localStorage.getItem(STREAK_KEY);
    if (cached) {
      set({ streak: JSON.parse(cached) });
    }
    const cachedCountValue = localStorage.getItem(LOCKET_COUNT_KEY);
    const cachedCount = Number(cachedCountValue);
    if (cachedCountValue !== null && Number.isFinite(cachedCount)) {
      set({ locketCount: cachedCount });
    }
  },

  fetchLocketCount: async () => {
    if (get().locketCountLoading) return;
    set({ locketCountLoading: true });

    try {
      const data = await GetLocketsCount();
      const count = Number(data?.count);
      if (!Number.isFinite(count)) return;
      set({ locketCount: count });
      localStorage.setItem(LOCKET_COUNT_KEY, String(count));
    } catch (error) {
      console.error("❌ Error fetching Locket count:", error);
    } finally {
      set({ locketCountLoading: false });
    }
  },

  // ---------- fetch ----------
  fetchStreak: async () => {
    set({ loading: true });

    try {
      const data = await GetLastestMoment();

      if (data?.streak) {
        set({ streak: data.streak });
        localStorage.setItem(STREAK_KEY, JSON.stringify(data.streak));
      }
    } catch (error) {
      console.error("❌ Error fetching streak:", error);
    } finally {
      set({ loading: false });
    }
  },

  syncStreak: async () => {
    // 1️⃣ Load local trước (sync)
    try {
      const cached = localStorage.getItem(STREAK_KEY);
      if (cached) {
        set({ streak: JSON.parse(cached) });
      }
    } catch (err) {
      console.error("❌ Load local streak error:", err);
    }

    get().fetchLocketCount();

    // 2️⃣ Fetch server (async)
    if (get().loading) return;

    set({ loading: true });

    try {
      const data = await GetLastestMoment();
      if (!data?.streak) return;

      set({ streak: data.streak });
      localStorage.setItem(STREAK_KEY, JSON.stringify(data.streak));
    } catch (error) {
      console.error("❌ Fetch streak error:", error);
    } finally {
      set({ loading: false });
    }
  },

  /* ---------- fetch if NOT updated today ---------- */
  fetchStreakIfNeeded: async () => {
    const { streak, loading } = get();
    const today = formatYYYYMMDD();

    // 🚫 đang fetch
    if (loading) return;

    // 🚫 đã có streak và cập nhật hôm nay
    if (streak?.last_updated_yyyymmdd === today) return;

    set({ loading: true });

    try {
      const data = await GetLastestMoment();

      if (data?.streak) {
        set({ streak: data.streak });
        localStorage.setItem(STREAK_KEY, JSON.stringify(data.streak));
      }
    } catch (error) {
      console.error("❌ Error fetching streak:", error);
    } finally {
      set({ loading: false });
    }
  },

  // ---------- clear ----------
  clearStreak: () => {
    localStorage.removeItem(STREAK_KEY);
    localStorage.removeItem(LOCKET_COUNT_KEY);
    set({ streak: null, locketCount: null });
  },

  /* ---------- helpers ---------- */
  isStreakUpdatedToday: () => {
    const { streak } = get();
    if (!streak?.last_updated_yyyymmdd) return false;
    return streak.last_updated_yyyymmdd === formatYYYYMMDD();
  },
}));
