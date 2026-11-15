import { CONFIG } from "@/config";
import { loginHeader } from "@/constants/constrain";
import { getToken } from "@/utils";
import axios from "axios";

export const BASE_URL_LOCKET = CONFIG.api.locketApi;

export const instanceLocket = axios.create({
  baseURL: BASE_URL_LOCKET,
  httpAgent: "http",
  httpsAgent: "https",
  timeout: 30000,
});

export const instanceLocketV2 = axios.create({
  baseURL: BASE_URL_LOCKET,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...loginHeader,
  },
});

// Interceptor: thêm token động trước mỗi request
instanceLocketV2.interceptors.request.use(
  (config) => {
    const { idToken } = getToken();
    if (idToken) {
      config.headers["Authorization"] = `Bearer ${idToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Thêm response interceptor để handle VIP expiry
instanceLocketV2.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response } = error;

    // Check nếu lỗi là VIP expired hoặc no VIP subscription
    if (response?.status === 403) {
      const errorCode = response.data?.code;
      const errorMessage = response.data?.message;

      if (
        errorCode === "VIP_EXPIRED" ||
        errorCode === "NO_VIP_SUBSCRIPTION" ||
        errorCode === "VIP_UID_MISMATCH" ||
        errorCode === "VIP_DELETED"
      ) {
        console.warn(
          `🚨 VIP Error: ${errorMessage}. Auto logging out user...`
        );

        // Import stores động để tránh circular dependency
        try {
          const { useAuthStore } = await import("@/stores");
          const { useVipExpiryModal } = await import("@/stores/useVipExpiryModal");
          
          const authStore = useAuthStore.getState();
          const modalStore = useVipExpiryModal.getState();

          // Show modal with appropriate reason
          modalStore.showModal(errorCode);

          // Logout sau 2 giây để user có thể đọc message
          setTimeout(async () => {
            await authStore.clearAndlogout();
            window.location.href = "/login";
          }, 2000);
        } catch (err) {
          console.error("❌ Lỗi khi logout:", err);
          // Fallback: logout ngay nếu có lỗi
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);
