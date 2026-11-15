import { clearAllDB } from "@/cache/configDB";
import {
  GetUserDataV2,
  GetUserLocket,
  logout,
  updateUserInfo,
  checkVipStatus,
} from "@/services";
import { removeToken } from "@/utils";
import { checkAuthVersion } from "@/utils/authVersion";
import { instanceMain } from "@/lib/axios.main";
import { create } from "zustand";

const CACHE_KEY = "userData";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 ngày
const VIP_CHECK_INTERVAL = 5 * 60 * 1000; // Check VIP mỗi 5 phút

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuth: false,
  loading: true,
  vipStatus: null,
  vipCheckIntervalId: null,

  hydrate: () => {
    const token = localStorage.getItem("idToken");
    const cached = localStorage.getItem(CACHE_KEY);

    if (!token) {
      set({ user: null, isAuth: false, loading: false });
      return;
    }

    if (cached) {
      try {
        const { data } = JSON.parse(cached);
        set({
          user: data,
          isAuth: true,
          loading: false,
        });
        return;
      } catch {}
    }

    set({ isAuth: true, loading: false });
  },

  init: async () => {
    const token = localStorage.getItem("idToken");

    if (!token) {
      set({ user: null, isAuth: false, loading: false });
      return;
    }

    // ⏸️ Tạm disable authVersion check để tránh kick user có VIP
    // 🔄 TODO: Enable sau khi confirm Firebase credentials working
    // const versionValid = checkAuthVersion();
    // if (!versionValid) {
    //   console.info("🔄 Auth version expired - forcing re-authentication");
    //   set({ user: null, isAuth: false, loading: false });
    //   return;
    // }

    try {
      const now = Date.now();
      let cached = localStorage.getItem(CACHE_KEY);
      let userInfo = null;

      if (cached) {
        const parsed = JSON.parse(cached);
        userInfo = parsed.data;
        if (now - parsed.timestamp < CACHE_DURATION_MS) {
          set({ user: userInfo, isAuth: true }); 
        } else {
          userInfo = null; 
        }
      }

      if (!userInfo) {
        userInfo = await GetUserLocket();
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data: userInfo, timestamp: now }),
        );
        set({ user: userInfo, isAuth: true }); // Cập nhật có vé
      }

      // Check VIP status sau khi user được load
      await get().checkAndUpdateVipStatus();
      
      // 🔄 Sync Firebase ID to VIP record in Firestore
      // This ensures uid is added even if Firebase was unavailable on first login
      try {
        const syncRes = await instanceMain.post("/api/sync-uid");
        const syncData = syncRes.data?.data;
        console.info("✅ Firebase ID synced to VIP record:", syncData);

        // If sync reveals VIP was deleted by admin, logout immediately
        if (syncData?.code === "VIP_DELETED") {
          console.warn("❌ VIP deleted by admin, logging out...");
          const { useVipExpiryModal } = await import("./useVipExpiryModal.js");
          const modalStore = useVipExpiryModal.getState();
          modalStore.showModal("VIP_DELETED");
          
          setTimeout(async () => {
            await get().clearAndlogout();
          }, 1000);
          return;
        }

        // If sync reveals user is expired, logout immediately
        if (syncData?.isExpired) {
          console.warn("❌ VIP expired after sync check, logging out...");
          const { useVipExpiryModal } = await import("./useVipExpiryModal.js");
          const modalStore = useVipExpiryModal.getState();
          modalStore.showModal("VIP_EXPIRED");
          
          setTimeout(async () => {
            await get().clearAndlogout();
          }, 1000);
          return;
        }
      } catch (err) {
        console.warn("⚠️ Failed to sync uid:", err.message);
        // Non-critical, continue
      }
      
      // Setup VIP check periodic
      get().startVipCheckInterval();

    } catch (err) {
      console.error("Auth initialization failed:", err);
      set({
        user: null,
        isAuth: false,
      });
    }
  },

  /**
   * Check VIP status và auto logout nếu hết hạn
   * ⚠️ IMPORTANT: Chỉ logout nếu thực sự có VIP error từ Firebase (403)
   * Network error → cho qua (user có thể offline)
   */
  checkAndUpdateVipStatus: async () => {
    try {
      console.info("🔍 Checking VIP status...");
      const vipData = await checkVipStatus();
      set({ vipStatus: vipData });

      console.info("✅ VIP status OK:", vipData);

      // Nếu VIP hết hạn thì logout
      if (vipData?.isExpired) {
        console.warn("⚠️ VIP hết hạn, auto logout...");
        const { useVipExpiryModal } = await import("./useVipExpiryModal.js");
        const modalStore = useVipExpiryModal.getState();
        modalStore.showModal("VIP_EXPIRED");
        
        setTimeout(async () => {
          await get().clearAndlogout();
        }, 1000);
        return false;
      }

      return true;
    } catch (error) {
      const errorCode = error?.code;
      const errorMsg = error?.message;
      const isNetworkError = error?.isNetworkError === true;
      
      console.error("❌ VIP Check Error:", { 
        code: errorCode, 
        message: errorMsg,
        isNetworkError 
      });

      // 🚫 LOGOUT CASE: Firebase explicitly says VIP problem
      if (
        errorCode === "NO_VIP_SUBSCRIPTION" || 
        errorCode === "VIP_EXPIRED" ||
        errorCode === "VIP_UID_MISMATCH" ||
        errorCode === "VIP_DELETED"
      ) {
        console.warn(`❌ VIP Error: ${errorCode} - ${errorMsg}`);
        
        try {
          const { useVipExpiryModal } = await import("./useVipExpiryModal.js");
          const modalStore = useVipExpiryModal.getState();
          modalStore.showModal(errorCode);

          setTimeout(async () => {
            await get().clearAndlogout();
          }, 1000);
        } catch (err) {
          console.error("Modal error:", err);
          await get().clearAndlogout();
        }
        return false;
      }

      // ✅ ALLOW CASE: Network/server error (không có .code hoặc isNetworkError=true)
      // Lý do: user có thể offline, server tạm lỗi, Firebase down, etc.
      // Sẽ re-check theo periodic interval (5 phút)
      if (isNetworkError || !errorCode) {
        console.warn(`⚠️ VIP check skipped (network/server error): ${errorMsg}`);
        return true; // ✅ Allow user to continue
      }

      // ⚠️ Unknown error code → also allow through (safer than logout)
      console.warn(`⚠️ Unknown VIP error code "${errorCode}" - allowing through`);
      return true;
    }
  },

  /**
   * Start periodic VIP check
   */
  startVipCheckInterval: () => {
    // Clear old interval nếu có
    const oldIntervalId = get().vipCheckIntervalId;
    if (oldIntervalId) {
      clearInterval(oldIntervalId);
    }

    const intervalId = setInterval(async () => {
      const isValid = await get().checkAndUpdateVipStatus();
      if (!isValid) {
        clearInterval(intervalId);
      }
    }, VIP_CHECK_INTERVAL);

    set({ vipCheckIntervalId: intervalId });
  },

  /**
   * Stop periodic VIP check
   */
  stopVipCheckInterval: () => {
    const intervalId = get().vipCheckIntervalId;
    if (intervalId) {
      clearInterval(intervalId);
      set({ vipCheckIntervalId: null });
    }
  },

  fetchUserData: async () => {
    try {
      set({ loading: true });
      const planRes = await GetUserDataV2();
      set({ loading: false });
    } catch (err) {
      console.error("fetchUserData error:", err);
      set({ loading: false });
    }
  },

  clearAndlogout: async () => {
    get().stopVipCheckInterval();
    await logout();
    removeToken();
    await clearAllDB();
    localStorage.removeItem(CACHE_KEY); 
    set({ user: null, isAuth: false, vipStatus: null });
  },
}));
