import axios from "axios";
import {
  API_URL,
  clearLocalData,
  getToken,
  removeToken,
  removeUser,
} from "../utils";
import { CONFIG } from "@/config";
import { parseJwt } from "@/utils/auth";
import { SonnerInfo, SonnerWarning } from "@/components/ui/SonnerToast";
import { instanceAuth } from "./axios.auth";

let cachedExp = null;
let hasShownExpiredPopup = false; // Prevent multiple popups

function isTokenExpired(token) {
  if (!token) return true;
  const now = Math.floor(Date.now() / 1000);
  if (!cachedExp) {
    try {
      const payload = parseJwt(token);
      if (!payload) return true;
      cachedExp = payload.exp;
    } catch (e) {
      return true;
    }
  }
  const timeLeft = cachedExp - now;
  return timeLeft < 300;
}

let isRefreshing = false;
let refreshPromise = null;

async function refreshIdToken() {
  try {
    const { refreshToken } = getToken();
    const res = await instanceAuth.post("locket/refresh-token", {
      refreshToken,
    });
    const newToken = res?.data?.data?.id_token;
    const newLocalId = res?.data?.data?.user_id;

    if (newToken) {
      localStorage.setItem("idToken", newToken);
      localStorage.setItem("localId", newLocalId);
      cachedExp = null;
      hasShownExpiredPopup = false; // Reset flag on successful refresh
      return newToken;
    }
    return null;
  } catch (err) {
    console.error("Không thể refresh idToken:", err);
    return null;
  }
}

// Show token expired popup
function showTokenExpiredPopup() {
  if (hasShownExpiredPopup) return;
  hasShownExpiredPopup = true;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "token-expired-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
  `;

  // Create popup
  const popup = document.createElement("div");
  popup.style.cssText = `
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 320px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: popupIn 0.3s ease;
  `;

  popup.innerHTML = `
    <style>
      @keyframes popupIn {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
    </style>
    <div style="font-size: 48px; margin-bottom: 16px;">⏰</div>
    <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">
      Phiên đăng nhập hết hạn
    </h2>
    <p style="margin: 0 0 20px 0; font-size: 14px; color: #666;">
      Vui lòng đăng nhập lại để tiếp tục sử dụng.
    </p>
    <button id="token-expired-login-btn" style="
      background: linear-gradient(135deg, #FF6B6B, #FF8E53);
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 50px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: transform 0.2s, box-shadow 0.2s;
    ">
      Đăng nhập lại
    </button>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Add hover effect
  const btn = document.getElementById("token-expired-login-btn");
  btn.onmouseover = () => {
    btn.style.transform = "scale(1.02)";
    btn.style.boxShadow = "0 4px 20px rgba(255, 107, 107, 0.4)";
  };
  btn.onmouseout = () => {
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "none";
  };

  // Handle login button click
  btn.onclick = () => {
    // Clear all auth data
    isRefreshing = false;
    refreshPromise = null;
    cachedExp = null;
    clearLocalData();
    removeUser();
    removeToken();
    localStorage.removeItem("idToken");
    localStorage.removeItem("localId");

    // Remove popup
    overlay.remove();
    hasShownExpiredPopup = false;

    // Redirect to login
    window.location.href = "/login";
  };
}

function handleLogout() {
  console.error("🚨 Token hết hạn - hiện popup thông báo");
  showTokenExpiredPopup();
}

const api = axios.create({
  baseURL: CONFIG.api.baseUrl,
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  // 🚀 SỬA TẠI ĐÂY: Lấy vé chuẩn như tụi kia
  let { idToken: token } = getToken();

  if (!token) {
    // 🚀 Không có vé cứ cho đi để xem API nào báo đỏ, KHÔNG reject ngay nữa
    return config;
  }

  if (isTokenExpired(token)) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshIdToken();
    }
    token = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (!token) {
      handleLogout();
      // Vẫn cho đi tiếp để hứng log lỗi
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status || error.status;
    const originalRequest = error.config;

    if (!originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (status === 401) {
      originalRequest._retry = true;

      if (
        !originalRequest.url?.includes("refresh-token") &&
        !isRefreshing &&
        !originalRequest.skipAuthRefresh
      ) {
        isRefreshing = true;
        refreshPromise = refreshIdToken();

        try {
          const newToken = await refreshPromise;
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          } else {
            handleLogout();
            return Promise.reject(error);
          }
        } catch (refreshError) {
          handleLogout();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      } else {
        handleLogout();
        console.error("🚨 Phát hiện API bị 401: ", originalRequest.url);
        // SonnerInfo("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;