import { create } from "zustand";
import { GetAllMoments } from "@/services";
import { MOMENTS_CONFIG } from "@/config/configAlias";
import { bulkAddMoments, getAllMoments, getMomentsByUser, deleteMomentById } from "@/cache/momentDB";

const { initialVisible, loadMoreLimit } = MOMENTS_CONFIG;

const getMs = (m) => {
  if (!m) return 0;
  const d = m.createTime || m.date;
  if (typeof d === 'string') return new Date(d).getTime();
  if (d?.seconds) return d.seconds * 1000;
  return new Date(d || 0).getTime();
};

const defaultBucket = () => ({
  items: [],
  loading: false,
  hasMore: true,
  isLoadingMore: false,
  visibleCount: initialVisible,
  nextPageToken: null,
});

export const useMomentsStoreV2 = create((set, get) => ({
  momentsByUser: {},

  ensureBucket: (key) => {
    set((s) => (s.momentsByUser[key] ? s : { momentsByUser: { ...s.momentsByUser, [key]: defaultBucket() } }));
  },

  fetchMoments: async (user, friendUid = null, silent = false) => {
    if (!user) return;
    const key = friendUid ?? "all";
    get().ensureBucket(key);

    // Chỉ show loading khi không phải silent (polling)
    if (!silent) {
      set((s) => ({ momentsByUser: { ...s.momentsByUser, [key]: { ...s.momentsByUser[key], loading: true } } }));
    }

    try {
      // Chỉ load từ cache khi không phải silent
      if (!silent) {
        const local = friendUid ? await getMomentsByUser(friendUid) : await getAllMoments();
        if (local?.length) {
          set((s) => ({ momentsByUser: { ...s.momentsByUser, [key]: { ...s.momentsByUser[key], items: [...local].sort((a,b) => getMs(b) - getMs(a)) } } }));
        }
      }

      const res = await GetAllMoments({ friendId: friendUid, limit: initialVisible });
      const apiData = res?.data || (Array.isArray(res) ? res : []);
      const token = res?.nextPageToken || null;

      // Merge new moments với existing (để không mất moments cũ khi polling)
      set((s) => {
        const currentItems = s.momentsByUser[key]?.items || [];
        const existIds = new Set(currentItems.map(i => i.id));
        const newItems = apiData.filter(m => !existIds.has(m.id));

        // Nếu có items mới, thêm vào đầu
        const mergedItems = newItems.length > 0
          ? [...newItems, ...currentItems].sort((a,b) => getMs(b) - getMs(a))
          : currentItems;

        return {
          momentsByUser: {
            ...s.momentsByUser,
            [key]: {
              ...s.momentsByUser[key],
              items: apiData.length > 0 ? mergedItems : s.momentsByUser[key].items,
              nextPageToken: token,
              hasMore: !!token
            }
          }
        };
      });

      if (apiData.length > 0) await bulkAddMoments(apiData);
    } catch (err) { console.error(err); }
    finally {
      if (!silent) {
        set((s) => ({ momentsByUser: { ...s.momentsByUser, [key]: { ...s.momentsByUser[key], loading: false } } }));
      }
    }
  },

  loadMoreOlder: async (friendUid = null) => {
    const key = friendUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket || bucket.isLoadingMore || !bucket.hasMore || !bucket.nextPageToken) return;

    set((s) => ({ momentsByUser: { ...s.momentsByUser, [key]: { ...bucket, isLoadingMore: true } } }));

    try {
      const res = await GetAllMoments({ timestamp: bucket.nextPageToken, friendId: friendUid, limit: loadMoreLimit });
      const older = res?.data || (Array.isArray(res) ? res : []);
      const token = res?.nextPageToken || null;

      // 🚀 CHỐT HẠ: Xoá bỏ block kiểm tra older.length === 0! Vẫn lưu Token lại.
      set((s) => {
        const b = s.momentsByUser[key];
        const exist = new Set(b.items.map(i => i.id));
        const filtered = older.filter(m => !exist.has(m.id));

        return {
          momentsByUser: {
            ...s.momentsByUser,
            [key]: {
              ...b,
              items: [...b.items, ...filtered].sort((a,b) => getMs(b) - getMs(a)),
              nextPageToken: token,
              hasMore: !!token // 🎯 CÒN TOKEN LÀ CÒN SỐNG
            }
          }
        };
      });

      if (older.length > 0) await bulkAddMoments(older);

    } catch (err) { console.error(err); }
    finally { set((s) => ({ momentsByUser: { ...s.momentsByUser, [key]: { ...s.momentsByUser[key], isLoadingMore: false } } })); }
  },

  reloadMoments: async (friendUid = null) => { get().fetchMoments({ uid: 'refresh' }, friendUid); },

  addNewMoment: async (payload) => {
    const items = Array.isArray(payload) ? payload : [payload];
    if (!items.length) return;
    const dbQueue = [];
    set((state) => {
      const next = { ...state.momentsByUser };
      for (const m of items) {
        if (!m?.id) continue;
        const ownerUid = m.userUid || m.user || m.owner;
        for (const k of [ownerUid ?? "all", "all"]) {
          if (!k) continue;
          const b = next[k] ?? defaultBucket();
          if (b.items.some((i) => i.id === m.id)) continue;
          next[k] = { ...b, items: [m, ...b.items].sort((a,b) => getMs(b) - getMs(a)) };
        }
        dbQueue.push(m);
      }
      return { momentsByUser: next };
    });
    if (dbQueue.length) await bulkAddMoments(dbQueue);
  },

  syncMomentsSnapshot: async (snapshot) => {
    if (!Array.isArray(snapshot)) return;
    const snapshotIds = new Set(snapshot.map((m) => m.id));
    set((state) => {
      const next = { ...state.momentsByUser };
      const b = next["all"] ?? defaultBucket();
      next["all"] = { ...b, items: b.items.filter((m) => snapshotIds.has(m.id)) };
      return { momentsByUser: next };
    });
    const local = await getAllMoments();
    const deletedIds = local.filter(m => !snapshotIds.has(m.id)).map(m => m.id);
    if (deletedIds.length) await Promise.all(deletedIds.map(deleteMomentById));
    await bulkAddMoments(snapshot);
  },

  removeMoment: async (momentId, ownerUid = null) => {
    const key = ownerUid ?? "all";
    const b = get().momentsByUser[key];
    if (!b) return;
    set((state) => ({
      momentsByUser: {
        ...state.momentsByUser,
        [key]: { ...b, items: b.items.filter((m) => m.id !== momentId) },
      },
    }));
    await deleteMomentById(momentId);
  },

  increaseVisibleCount: (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    const b = get().momentsByUser[key];
    if (!b) return;
    set((state) => ({
      momentsByUser: {
        ...state.momentsByUser,
        [key]: {
          ...b,
          visibleCount: Math.min(b.visibleCount + initialVisible, b.items.length),
        },
      },
    }));
  },

  resetVisible: (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    const b = get().momentsByUser[key];
    if (!b) return;
    set((state) => ({
      momentsByUser: {
        ...state.momentsByUser,
        [key]: { ...b, visibleCount: initialVisible },
      },
    }));
  },
}));