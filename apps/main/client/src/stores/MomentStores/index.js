import { create } from "zustand";
import { GetAllMoments } from "@/services";
import { MOMENTS_CONFIG } from "@/config/configAlias";
import {
  bulkAddMoments,
  deleteMomentById,
  getAllMoments,
  getMomentsByUser,
} from "@/cache/momentDB";
import { normalizeMoment } from "@/utils/standardize/normalizeMoments";
import {
  createMomentCaptionSnapshot,
  restoreMomentCaption,
} from "@/utils/moment/preserveMomentCaption";
import { mergeStableMomentOrder } from "@/utils/moment/stableMomentOrder";

const { initialVisible, loadMoreLimit } = MOMENTS_CONFIG;

/* --------------------------------------------------
 * Default bucket
 * -------------------------------------------------- */
const defaultBucket = () => ({
  items: [],
  loading: false,
  hasMore: true,
  isLoadingMore: false,
  visibleCount: initialVisible,
  nextPageToken: null,
});

const getMomentTime = (moment) => {
  const value = moment?.createTime || moment?.date || moment?.updateTime;
  if (!value) return 0;
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortMomentsDesc = (moments) =>
  [...moments].sort((a, b) => getMomentTime(b) - getMomentTime(a));

const normalizeMomentList = (moments) =>
  (Array.isArray(moments) ? moments : [])
    .map(normalizeMoment)
    .filter(Boolean);

const mergeMoment = (current, fresh) => {
  if (!current) return fresh;
  const captionSnapshot = createMomentCaptionSnapshot(current);
  return restoreMomentCaption({ ...current, ...fresh }, captionSnapshot);
};

/* --------------------------------------------------
 * Store
 * -------------------------------------------------- */
export const useMomentsStoreV2 = create((set, get) => ({
  momentsByUser: {},

  /* --------------------------------------------------
   * 🔧 Ensure bucket (SAFE – no race condition)
   * -------------------------------------------------- */
  ensureBucket: (key) => {
    set((state) => {
      if (state.momentsByUser[key]) return state;
      return {
        momentsByUser: {
          ...state.momentsByUser,
          [key]: defaultBucket(),
        },
      };
    });
  },

  /* --------------------------------------------------
   * 1️⃣ Fetch initial (Local → API)
   * -------------------------------------------------- */
  fetchMoments: async (user, selectedFriendUid = null) => {
    if (!user) return;

    const key = selectedFriendUid ?? "all";
    get().ensureBucket(key);

    // loading = true
    set((state) => {
      const bucket = state.momentsByUser[key] ?? defaultBucket();
      return {
        momentsByUser: {
          ...state.momentsByUser,
          [key]: {
            ...bucket,
            loading: true,
            hasMore: true,
          },
        },
      };
    });

    try {
      /* ---------- Local DB ---------- */
      const localData = selectedFriendUid
        ? await getMomentsByUser(selectedFriendUid)
        : await getAllMoments();

      const normalizedLocal = normalizeMomentList(localData);
      if (normalizedLocal.length) {
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                items: bucket.items.length
                  ? bucket.items
                  : sortMomentsDesc(normalizedLocal),
              },
            },
          };
        });
      }

      /* ---------- API sync ---------- */
      const apiData = await GetAllMoments({
        pageToken: null,
        friendId: selectedFriendUid,
        limit: initialVisible,
      });

      const normalizedApiMoments = normalizeMomentList(apiData.moments);
      if (normalizedApiMoments.length) {
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                items: mergeStableMomentOrder(
                  bucket.items,
                  normalizedApiMoments,
                  mergeMoment,
                ),
                nextPageToken: apiData.nextPageToken,
                hasMore: Boolean(apiData.nextPageToken),
              },
            },
          };
        });

        // cache lại local
        await bulkAddMoments(normalizedApiMoments);
      } else {
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                nextPageToken: apiData.nextPageToken,
                hasMore: Boolean(apiData.nextPageToken),
              },
            },
          };
        });
      }
    } catch (err) {
      console.error("❌ fetchMoments error:", err);
    } finally {
      set((state) => {
        const bucket = state.momentsByUser[key];
        if (!bucket) return state;
        return {
          momentsByUser: {
            ...state.momentsByUser,
            [key]: {
              ...bucket,
              loading: false,
            },
          },
        };
      });
    }
  },

  reloadMoments: async (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    get().ensureBucket(key);

    // loading = true
    set((state) => {
      const bucket = state.momentsByUser[key] ?? defaultBucket();
      return {
        momentsByUser: {
          ...state.momentsByUser,
          [key]: {
            ...bucket,
            loading: true,
            hasMore: true,
          },
        },
      };
    });

    try {
      /* ---------- Local DB ---------- */
      const localData = selectedFriendUid
        ? await getMomentsByUser(selectedFriendUid)
        : await getAllMoments();

      const normalizedLocal = normalizeMomentList(localData);
      if (normalizedLocal.length) {
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                items: bucket.items.length
                  ? bucket.items
                  : sortMomentsDesc(normalizedLocal),
              },
            },
          };
        });
      }

      /* ---------- API sync ---------- */
      const apiData = await GetAllMoments({
        pageToken: null,
        friendId: selectedFriendUid,
        limit: initialVisible,
      });

      const normalizedApiMoments = normalizeMomentList(apiData.moments);
      if (normalizedApiMoments.length) {
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                items: mergeStableMomentOrder(
                  bucket.items,
                  normalizedApiMoments,
                  mergeMoment,
                ),
                nextPageToken: apiData.nextPageToken,
                hasMore: Boolean(apiData.nextPageToken),
              },
            },
          };
        });

        // cache lại local
        await bulkAddMoments(normalizedApiMoments);
      } else {
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                nextPageToken: apiData.nextPageToken,
                hasMore: Boolean(apiData.nextPageToken),
              },
            },
          };
        });
      }
    } catch (err) {
      console.error("❌ fetchMoments error:", err);
    } finally {
      set((state) => {
        const bucket = state.momentsByUser[key];
        if (!bucket) return state;
        return {
          momentsByUser: {
            ...state.momentsByUser,
            [key]: {
              ...bucket,
              loading: false,
            },
          },
        };
      });
    }
  },

  /* --------------------------------------------------
   * 2️⃣ Load more older
   * -------------------------------------------------- */
  loadMoreOlder: async (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket) return;

    if (bucket.isLoadingMore || !bucket.hasMore) {
      return;
    }

    // set loading more
    set((state) => {
      const b = state.momentsByUser[key];
      if (!b) return state;
      return {
        momentsByUser: {
          ...state.momentsByUser,
          [key]: {
            ...b,
            isLoadingMore: true,
          },
        },
      };
    });

    try {
      const pageToken = bucket.nextPageToken;

      if (!pageToken) {
        set((state) => {
          const b = state.momentsByUser[key];
          if (!b) return state;
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...b,
                hasMore: false,
              },
            },
          };
        });
        return;
      }

      const older = await GetAllMoments({
        pageToken,
        friendId: selectedFriendUid,
        limit: loadMoreLimit,
      });

      const normalizedOlder = normalizeMomentList(older.moments);
      if (!normalizedOlder.length) {
        set((state) => {
          const b = state.momentsByUser[key];
          if (!b) return state;
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...b,
                nextPageToken: older.nextPageToken,
                hasMore: Boolean(older.nextPageToken),
              },
            },
          };
        });
        return;
      }

      set((state) => {
        const b = state.momentsByUser[key];
        if (!b) return state;

        return {
          momentsByUser: {
            ...state.momentsByUser,
            [key]: {
              ...b,
              items: mergeStableMomentOrder(
                b.items,
                normalizedOlder,
                mergeMoment,
                { newItemsAt: "end" },
              ),
              nextPageToken: older.nextPageToken,
              hasMore: Boolean(older.nextPageToken),
            },
          },
        };
      });

      await bulkAddMoments(normalizedOlder);
    } catch (err) {
      console.error("❌ loadMoreOlder error:", err);
    } finally {
      set((state) => {
        const b = state.momentsByUser[key];
        if (!b) return state;
        return {
          momentsByUser: {
            ...state.momentsByUser,
            [key]: {
              ...b,
              isLoadingMore: false,
            },
          },
        };
      });
    }
  },

  /* --------------------------------------------------
   * 3️⃣ Realtime add moment (Socket)
   * -------------------------------------------------- */
  addNewMoment: async (payload) => {
    const items = normalizeMomentList(
      Array.isArray(payload) ? payload : [payload],
    );
    if (!items.length) return;

    const dbQueue = [];

    set((state) => {
      const next = { ...state.momentsByUser };

      for (const m of items) {
        if (!m?.id) continue;

        const ownerUid = m.userUid || m.user || m.owner;
        const keys = [ownerUid ?? "all", "all"]; // 👈 add vào feed + all

        for (const key of keys) {
          if (!key) continue;

          const bucket = next[key] ?? defaultBucket();

          next[key] = {
            ...bucket,
            items: mergeStableMomentOrder(bucket.items, [m], mergeMoment),
          };
        }

        dbQueue.push(m);
      }

      return { momentsByUser: next };
    });

    if (dbQueue.length) {
      await bulkAddMoments(dbQueue);
    }
  },

  syncMomentsSnapshot: async (snapshot) => {
    if (!Array.isArray(snapshot)) return;

    const normalizedSnapshot = normalizeMomentList(snapshot);
    const snapshotIds = new Set(normalizedSnapshot.map((m) => m.id));

    /* ---------- Update STORE ---------- */
    set((state) => {
      const next = { ...state.momentsByUser };

      const bucket = next["all"] ?? defaultBucket();

      next["all"] = {
        ...bucket,
        items: mergeStableMomentOrder(
          bucket.items,
          normalizedSnapshot,
          mergeMoment,
        ).filter((moment) => snapshotIds.has(moment.id)),
      };

      return { momentsByUser: next };
    });

    /* ---------- Update IndexedDB ---------- */
    const local = await getAllMoments();
    const localIds = new Set(local.map((m) => m.id));

    const deletedIds = [...localIds].filter((id) => !snapshotIds.has(id));

    if (deletedIds.length) {
      await Promise.all(deletedIds.map(deleteMomentById));
    }

    await bulkAddMoments(normalizedSnapshot);
  },

  refreshLoadedMoments: async () => {
    const keys = Object.keys(get().momentsByUser);
    const activeKeys = keys.length ? keys : ["all"];

    await Promise.allSettled(
      activeKeys.map((key) => get().reloadMoments(key === "all" ? null : key)),
    );
  },

  /* --------------------------------------------------
   * 4️⃣ Remove moment
   * -------------------------------------------------- */
  removeMoment: async (momentId, ownerUid = null) => {
    const key = ownerUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket) return;

    set((state) => ({
      momentsByUser: {
        ...state.momentsByUser,
        [key]: {
          ...bucket,
          items: bucket.items.filter((m) => m.id !== momentId),
        },
      },
    }));

    await deleteMomentById(momentId);
  },

  /* --------------------------------------------------
   * 5️⃣ Visible count
   * -------------------------------------------------- */
  increaseVisibleCount: (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket) return;

    if (bucket.visibleCount < bucket.items.length) {
      set((state) => ({
        momentsByUser: {
          ...state.momentsByUser,
          [key]: {
            ...bucket,
            visibleCount: Math.min(
              bucket.visibleCount + initialVisible,
              bucket.items.length
            ),
          },
        },
      }));
    }
  },

  resetVisible: (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket) return;

    set((state) => ({
      momentsByUser: {
        ...state.momentsByUser,
        [key]: {
          ...bucket,
          visibleCount: initialVisible,
        },
      },
    }));
  },

  ensureMomentVisible: (momentId, selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket || !bucket.items) return -1;
    const index = bucket.items.findIndex(
      (m) => m?.id === momentId || m?.canonical_uid === momentId || m?.postId === momentId,
    );
    if (index === -1) return -1;

    if (index >= bucket.visibleCount) {
      set((state) => ({
        momentsByUser: {
          ...state.momentsByUser,
          [key]: {
            ...bucket,
            visibleCount: Math.min(index + 6, bucket.items.length),
          },
        },
      }));
    }
    return index;
  },

  /* --------------------------------------------------
   * 6️⃣ Cập nhật mảng seenBy cho moments trong store
   * -------------------------------------------------- */
  markMomentsAsSeen: (momentIds, currentUserId) => {
    if (!momentIds || !currentUserId) return;
    const rawIds = Array.isArray(momentIds) ? momentIds : [momentIds];
    const idSet = new Set(
      rawIds
        .map((id) => (typeof id === "object" ? id?.id : id))
        .filter(Boolean),
    );
    if (idSet.size === 0) return;

    set((state) => {
      let anyChanged = false;
      const nextMomentsByUser = { ...state.momentsByUser };

      for (const [key, bucket] of Object.entries(nextMomentsByUser)) {
        if (!bucket || !Array.isArray(bucket.items)) continue;

        let bucketChanged = false;
        const updatedItems = bucket.items.map((m) => {
          if (!m?.id || !idSet.has(m.id)) return m;

          const currentSeenBy = Array.isArray(m.seenBy)
            ? [...m.seenBy]
            : Array.isArray(m.seen_by)
            ? [...m.seen_by]
            : [];

          const targetUid = String(currentUserId).trim();
          const alreadySeen = currentSeenBy.some((item) => {
            if (typeof item === "string") return item === targetUid;
            if (item && typeof item === "object") {
              return (
                item.uid === targetUid ||
                item.userId === targetUid ||
                item.user_uid === targetUid ||
                item.id === targetUid ||
                item.user === targetUid
              );
            }
            return false;
          });

          if (!alreadySeen) {
            currentSeenBy.push(targetUid);
            bucketChanged = true;
            anyChanged = true;
            return {
              ...m,
              seenBy: currentSeenBy,
              seen_by: currentSeenBy,
            };
          }

          return m;
        });

        if (bucketChanged) {
          nextMomentsByUser[key] = {
            ...bucket,
            items: updatedItems,
          };
        }
      }

      return anyChanged ? { momentsByUser: nextMomentsByUser } : state;
    });
  },
}));

export * from "./useViewedMomentsStore";
