import {
  clearAuthStorage,
  clearLocalData,
  getToken,
  removeToken,
  removeUser,
  saveToken,
} from "../utils";
import { CONFIG } from "@/config";
import { parseJwt } from "@/utils/auth";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { instanceAuth } from "./instanceAuth";
import { createUploadClient } from "./createBase";
import {
  decideAuth401Action,
  decideRefreshErrorAction,
  isTerminalRefreshError,
} from "./auth401Policy";
import {
  AUTH_SESSION_CHANGED,
  assertCurrentAccount,
  assertSameRefreshSession,
  isCurrentAccount,
  isSameRefreshSession,
  sessionChangedError,
} from "./authSessionPolicy";

const AUTH_REFRESH_TEMPORARY = "AUTH_REFRESH_TEMPORARY";
const AUTH_REFRESH_TERMINAL = "AUTH_REFRESH_TERMINAL";
const TOKEN_REFRESH_SKEW_SECONDS = 5 * 60;

let cachedToken = null;
let cachedExp = null;
let refreshPromise = null;
let refreshSession = null;

function getTokenExpiry(token) {
  if (!token) return null;
  if (cachedToken !== token) {
    cachedToken = token;
    cachedExp = Number(parseJwt(token)?.exp || 0) || null;
  }
  return cachedExp;
}

function tokenExpiresSoon(token) {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return expiry - Math.floor(Date.now() / 1000) < TOKEN_REFRESH_SKEW_SECONDS;
}

function tokenStillUsable(token) {
  const expiry = getTokenExpiry(token);
  return Boolean(expiry && expiry > Math.floor(Date.now() / 1000) + 10);
}

function resetTokenCache() {
  cachedToken = null;
  cachedExp = null;
}

function makeRefreshError(cause, terminal = false) {
  const error = new Error(
    terminal
      ? "Phiên đăng nhập không còn hợp lệ"
      : "Tạm thời chưa thể làm mới phiên đăng nhập",
  );
  error.code = terminal ? AUTH_REFRESH_TERMINAL : AUTH_REFRESH_TEMPORARY;
  error.authRefreshTerminal = terminal;
  error.cause = cause;
  if (cause?.response) error.response = cause.response;
  if (cause?.status) error.status = cause.status;
  return error;
}

async function performTokenRefresh() {
  const { refreshToken, localId: currentLocalId } = getToken() || {};
  if (!refreshToken) {
    throw makeRefreshError(new Error("Missing refresh token"), true);
  }

  try {
    const response = await instanceAuth.post(
      "locket/refresh-token",
      { refreshToken },
      { skipAuthRefresh: true },
    );
    const data = response?.data?.data || {};
    // An old request may finish after logout or after another account signs in.
    assertSameRefreshSession({ refreshToken, localId: currentLocalId }, getToken());
    const newToken = data.id_token || data.idToken;
    const newLocalId = data.user_id || data.localId || currentLocalId;
    const rotatedRefreshToken =
      data.refresh_token || data.refreshToken || refreshToken;

    if (!newToken) {
      throw makeRefreshError(new Error("Refresh response missing id_token"), false);
    }
    if (currentLocalId && newLocalId !== currentLocalId) throw sessionChangedError();

    saveToken({
      idToken: newToken,
      localId: newLocalId,
      refreshToken: rotatedRefreshToken,
    });
    resetTokenCache();
    window.dispatchEvent(new Event("t97-token-refreshed"));
    return newToken;
  } catch (error) {
    if (error?.authRefreshTerminal !== undefined) throw error;
    throw makeRefreshError(error, isTerminalRefreshError(error));
  }
}

async function getFreshToken({ force = false } = {}) {
  const { idToken, refreshToken, localId } = getToken() || {};
  if (!force && idToken && !tokenExpiresSoon(idToken)) return idToken;
  if (!refreshToken) {
    throw makeRefreshError(new Error("Missing refresh token"), true);
  }

  const session = { refreshToken, localId };
  if (!refreshPromise || !isSameRefreshSession(refreshSession, session)) {
    const pending = performTokenRefresh().finally(() => {
      // A new account can have its own refresh in flight before this one ends.
      if (refreshPromise === pending) {
        refreshPromise = null;
        refreshSession = null;
      }
    });
    refreshSession = session;
    refreshPromise = pending;
  }
  return refreshPromise;
}

function handleLogout() {
  refreshPromise = null;
  refreshSession = null;
  resetTokenCache();
  clearLocalData();
  removeUser();
  removeToken();
  clearAuthStorage();

  if (window.location.pathname !== "/login") window.location.href = "/login";
}

function logoutForExpiredSession() {
  handleLogout();
  SonnerInfo("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");
}

const api = createUploadClient(CONFIG.api.baseUrl);

api.interceptors.request.use(async (config) => {
  const { idToken, refreshToken, localId } = getToken() || {};
  config._authSessionLocalId = localId;
  if (!idToken && !refreshToken) {
    const error = new Error("Not authenticated");
    error.status = 401;
    error.code = AUTH_REFRESH_TERMINAL;
    return Promise.reject(error);
  }

  let token = idToken;
  if (!token || tokenExpiresSoon(token)) {
    try {
      token = await getFreshToken();
    } catch (error) {
      if (error?.code === AUTH_SESSION_CHANGED || !isCurrentAccount(localId, getToken())) {
        return Promise.reject(sessionChangedError());
      }
      if (error?.authRefreshTerminal) {
        logoutForExpiredSession();
        return Promise.reject(error);
      }

      // A temporary refresh outage must not erase a still-usable local session.
      if (!tokenStillUsable(idToken)) return Promise.reject(error);
      token = idToken;
    }
  }

  assertCurrentAccount(localId, getToken());

  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    assertCurrentAccount(response.config?._authSessionLocalId, getToken());
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (originalRequest && !isCurrentAccount(originalRequest._authSessionLocalId, getToken())) {
      return Promise.reject(sessionChangedError());
    }
    const status = error.response?.status || error.status;
    const responseData = error.response?.data;
    const message =
      responseData?.message ||
      responseData?.error?.message ||
      (typeof responseData?.error === "string" ? responseData.error : "") ||
      error.message;

    const decision = decideAuth401Action({
      status,
      skipAuthRefresh: originalRequest?.skipAuthRefresh,
      isRetry: Boolean(originalRequest?._retry),
    });

    if (decision.action === "refresh-and-retry" && originalRequest) {
      originalRequest._retry = true;
      try {
        const newToken = await getFreshToken({ force: true });
        assertCurrentAccount(originalRequest._authSessionLocalId, getToken());
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        if (refreshError?.code === AUTH_SESSION_CHANGED ||
          !isCurrentAccount(originalRequest._authSessionLocalId, getToken())) {
          return Promise.reject(sessionChangedError());
        }
        if (decideRefreshErrorAction(refreshError).isTerminal) {
          logoutForExpiredSession();
        }
        return Promise.reject(refreshError);
      }
    }

    if (status === 401) return Promise.reject(error);

    if (status === 403) {
      if (responseData?.code === "VIP_REQUIRED") {
        window.dispatchEvent(
          new CustomEvent("t97:access-role-changed", {
            detail: { role: "celebrity" },
          }),
        );
      }
      SonnerInfo(message || "Bạn không có quyền truy cập!");
    } else if (status === 404) {
      SonnerInfo(message || "Không tìm thấy nội dung yêu cầu.");
    } else if (status === 429) {
      SonnerInfo(message || "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.");
    } else if (status >= 500 && status <= 504) {
      SonnerInfo(message || "Lỗi máy chủ. Vui lòng thử lại sau.");
    }

    return Promise.reject(error);
  },
);

export default api;
