//Chủ yếu dùng cho các yêu cầu của khách truy cập và lấy dữ liệu xem trước
import { CONFIG } from "@/config";
import { getToken } from "@/utils";
import axios from "axios";

const BASE_URL = CONFIG.api.baseUrl;

// meta tĩnh của app
const APP_META = {
  "x-app-author": CONFIG.app.author,
  "x-app-name": CONFIG.app.shortname,
  "x-app-client": CONFIG.app.clientVersion,
  "x-app-api": CONFIG.app.apiVersion,
  "x-app-env": CONFIG.app.env,
};

// Tạo axios instance
export const instanceMain = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": CONFIG.keys.apiKey,
    ...APP_META,
  },
});

// Thêm interceptor để cập nhật Authorization trước mỗi request
instanceMain.interceptors.request.use(
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
instanceMain.interceptors.response.use(
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
