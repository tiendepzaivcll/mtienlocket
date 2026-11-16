import { clearAllDB } from "@/cache/configDB";
import { CONFIG } from "@/config";
import {
  GetUserLocket,
  checkAccessApproval,
  logout,
} from "@/services";
import {
  removeToken,
  saveUserCache,
  getUserCache,
  clearUserCache,
  getToken,
} from "@/utils";
import { create } from "zustand";

const fullAccessPlan = {
  plan: {
    id: "t97-full",
    name: "MTIEN Full Access",
    badge: null,
  },
  plan_info: {
    id: "t97-full",
    name: "MTIEN Full Access",
  },
  subscription: {
    plan_id: "t97-full",
    is_active: true,
  },
  feature_blocks: {},
  features: {},
  limits: {
    image_storage_limit_mb: 1024,
    video_storage_limit_mb: 1024,
    storage_limit_mb: -1,
    video_record_max_length: CONFIG.app.camera.limits.maxRecordTime,
  },
  upload_stats: {
    total_used_mb: 0,
  },
  user: {
    customer_code: "T97-FULL",
  },
};

const ACCESS_ROLE_KEY = "t97_access_role";
const AI_FILTER_ACCESS_KEY = "t97_ai_filter_access";

const normalizeAccessRole = (role) =>
  String(role || "").trim().toLowerCase() === "celebrity"
    ? "celebrity"
    : "vip";

const getCachedAccessRole = () => {
  const role = localStorage.getItem(ACCESS_ROLE_KEY);
  return role ? normalizeAccessRole(role) : null;
};

const saveAccessRole = (role) => {
  const normalizedRole = normalizeAccessRole(role);
  localStorage.setItem(ACCESS_ROLE_KEY, normalizedRole);
  return normalizedRole;
};

const clearAccessRole = () => localStorage.removeItem(ACCESS_ROLE_KEY);

const getCachedAiFilterAccess = () =>
  localStorage.getItem(AI_FILTER_ACCESS_KEY) === "true";

const saveAiFilterAccess = (enabled) => {
  const value = enabled === true;
  localStorage.setItem(AI_FILTER_ACCESS_KEY, String(value));
  return value;
};

const clearAiFilterAccess = () =>
  localStorage.removeItem(AI_FILTER_ACCESS_KEY);

export const useAuthStore = create((set) => ({
  user: null,
  userPlan: null,
  uploadStats: null,
  isAuth: false,
  loading: true,
  accessDenied: null,
  accessRole: null,
  aiFilterEnabled: false,

  setAccessRole: (role) => {
    const accessRole = saveAccessRole(role);
    set({ accessRole });
    return accessRole;
  },

  setAiFilterEnabled: (enabled) => {
    const aiFilterEnabled = saveAiFilterAccess(enabled);
    set({ aiFilterEnabled });
    return aiFilterEnabled;
  },

  refreshAccessRole: async () => {
    const { idToken } = getToken();
    if (!idToken) return null;

    try {
      const access = await checkAccessApproval();
      const accessRole = saveAccessRole(access?.role);
      const aiFilterEnabled = saveAiFilterAccess(access?.features?.aiFilter);
      set({ accessRole, aiFilterEnabled });
      return access;
    } catch (error) {
      console.warn("Không thể làm mới quyền truy cập:", error);
      return null;
    }
  },

  // =========================
  // 1️⃣ HYDRATE – sync, render ngay
  // =========================
  hydrateAuth: () => {
    const { idToken, localId } = getToken();
    const cachedUser = getUserCache(localId);

    if (!idToken) {
      set({
        user: null,
        isAuth: false,
        loading: false,
        accessRole: null,
        aiFilterEnabled: false,
      });
      return;
    }

    if (cachedUser) {
      const accessRole = getCachedAccessRole();
      set({
        user: cachedUser,
        userPlan: fullAccessPlan,
        uploadStats: fullAccessPlan.upload_stats,
        isAuth: true,
        loading: !accessRole,
        accessRole,
        aiFilterEnabled: getCachedAiFilterAccess(),
      });
      return;
    }

    set({
      isAuth: true,
      loading: true,
      accessRole: getCachedAccessRole(),
      aiFilterEnabled: getCachedAiFilterAccess(),
    });
  },

  initAuth: async ({ force = false } = {}) => {
    const { idToken, localId } = getToken();

    if (!idToken) {
      set({
        user: null,
        userPlan: null,
        uploadStats: null,
        isAuth: false,
        loading: false,
        accessRole: null,
        aiFilterEnabled: false,
      });
      return;
    }

    try {
      set({
        loading: true,
        userPlan: fullAccessPlan,
        uploadStats: fullAccessPlan.upload_stats,
        accessDenied: null,
      });

      // lấy user từ cache
      let userInfo = force ? null : getUserCache(localId);

      if (userInfo) {
        set({ user: userInfo });
      } else {
        userInfo = await GetUserLocket();
        if (localId && userInfo?.localId && userInfo.localId !== localId) {
          throw new Error("USER_TOKEN_MISMATCH");
        }
        saveUserCache(userInfo);
        set({ user: userInfo });
      }

      const access = await checkAccessApproval();
      const accessRole = saveAccessRole(access?.role);
      const aiFilterEnabled = saveAiFilterAccess(access?.features?.aiFilter);

      set({
        accessRole,
        aiFilterEnabled,
        isAuth: true,
        loading: false,
      });

      return userInfo;
    } catch (err) {
      console.error("Auth init error:", err);
      const isAccessDenied =
        err?.status === 403 || err?.code === "ACCESS_NOT_APPROVED";

      if (isAccessDenied) {
        removeToken();
        clearUserCache();
        clearAccessRole();
        clearAiFilterAccess();
        await clearAllDB();
      }

      set({
        user: null,
        userPlan: fullAccessPlan,
        uploadStats: fullAccessPlan.upload_stats,
        isAuth: false,
        loading: false,
        accessRole: null,
        aiFilterEnabled: false,
        accessDenied: isAccessDenied
          ? {
              username: err?.data?.username || null,
              contact: err?.data?.contact || CONFIG.app.contact.supportEmail,
              message:
                err?.message ||
                "Tài khoản chưa được admin phê duyệt.",
            }
          : null,
      });
      return null;
    }
  },

  fetchUserData: async () => {
    try {
      set({ loading: true });

      set({
        userPlan: fullAccessPlan,
        uploadStats: fullAccessPlan.upload_stats,
        loading: false,
      });
    } catch (err) {
      console.error("fetchUserData error:", err);
      set({ loading: false });
    }
  },

  clearAndlogout: async () => {
    try {
      await logout();
    } catch (error) {
      console.warn("Không thể đăng xuất trên server, tiếp tục xóa phiên local:", error);
    } finally {
      removeToken();
      clearUserCache();
      clearAccessRole();
      clearAiFilterAccess();
      await clearAllDB();

      set({
        user: null,
        userPlan: fullAccessPlan,
        uploadStats: fullAccessPlan.upload_stats,
        isAuth: false,
        accessDenied: null,
        accessRole: null,
        aiFilterEnabled: false,
      });
    }
  },

  clearAccessDenied: () => set({ accessDenied: null }),
}));
