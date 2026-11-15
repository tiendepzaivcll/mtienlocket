const { logInfo, logError } = require("../../utils/logEventUtils.js");
const { createGoogleInstance } = require("../../libs/instanceGoogleBase.js");

const login = async (email, password) => {
  logInfo("login Locket", "Start");

  const body = {
    email: email,
    password: password,
    returnSecureToken: true,
    clientType: "CLIENT_TYPE_IOS",
  };

  try {
    const firebaseAuthApi = createGoogleInstance("auth");

    const response = await firebaseAuthApi.post("verifyPassword", body);

    if (!response.data) {
      throw new Error(`Login failed: ${response.statusText}`);
    }

    const data = await response.data;

    logInfo("login Locket", "End");
    return data;
  } catch (error) {
    logError("login Locket", error.message);
    throw error;
  }
};

const logout = async () => {
  logInfo("logout Locket", "Start");

  try {
    logInfo("logout Locket", "End");
    return null;
  } catch (error) {
    logError("logout Locket", error.message);
    throw error;
  }
};

const buildRefreshTokenRequestBody = (refreshToken) =>
  new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }).toString();

const classifyFirebaseRefreshError = (err) => {
  const upstreamStatus = err.response?.status;
  const upstreamMessage = String(
    err.response?.data?.error?.message || err.message || "",
  ).toUpperCase();
  const authError = new Error("Tạm thời chưa thể làm mới phiên đăng nhập.");

  if (
    upstreamStatus === 429 ||
    upstreamMessage.includes("TOO_MANY_ATTEMPTS") ||
    upstreamMessage.includes("RESOURCE_EXHAUSTED")
  ) {
    authError.status = 429;
    authError.code = "TOO_MANY_ATTEMPTS_TRY_LATER";
    authError.terminal = false;
  } else if (
    upstreamMessage.includes("API_KEY_INVALID") ||
    upstreamMessage.includes("API_KEY_EXPIRED") ||
    upstreamMessage.includes("PROJECT_NOT_FOUND") ||
    upstreamMessage.includes("CONFIGURATION_NOT_FOUND")
  ) {
    authError.status = 503;
    authError.code = "AUTH_CONFIG_ERROR";
    authError.terminal = false;
  } else if (
    upstreamMessage.includes("TOKEN_EXPIRED") ||
    upstreamMessage.includes("REFRESH_TOKEN_EXPIRED")
  ) {
    authError.message = "Refresh token đã hết hạn.";
    authError.status = 401;
    authError.code = "REFRESH_TOKEN_EXPIRED";
    authError.terminal = true;
  } else if (upstreamMessage.includes("USER_DISABLED")) {
    authError.message = "Tài khoản đã bị vô hiệu hóa.";
    authError.status = 401;
    authError.code = "USER_DISABLED";
    authError.terminal = true;
  } else if (upstreamMessage.includes("USER_NOT_FOUND")) {
    authError.message = "Không tìm thấy tài khoản.";
    authError.status = 401;
    authError.code = "USER_NOT_FOUND";
    authError.terminal = true;
  } else if (
    upstreamMessage.includes("INVALID_REFRESH_TOKEN") ||
    upstreamMessage.includes("REFRESH_TOKEN_INVALID")
  ) {
    authError.message = "Refresh token không hợp lệ.";
    authError.status = 401;
    authError.code = "REFRESH_TOKEN_INVALID";
    authError.terminal = true;
  } else if (!err.response) {
    authError.status = 503;
    authError.code = "UPSTREAM_UNAVAILABLE";
    authError.terminal = false;
  } else {
    // Unknown 400/401/403 may be a protocol or upstream configuration issue.
    // Do not destroy a valid local session without an explicit terminal code.
    authError.status = 502;
    authError.code = "AUTH_REFRESH_FAILED";
    authError.terminal = false;
  }

  return authError;
};

const refreshIdToken = async (refreshToken) => {
  if (!refreshToken) {
    const authError = new Error(
      "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
    );
    authError.status = 401;
    authError.code = "REFRESH_TOKEN_MISSING";
    authError.terminal = true;
    throw authError;
  }

  const body = buildRefreshTokenRequestBody(refreshToken);

  try {
    const firebaseAuthApi = createGoogleInstance("secureToken");

    const res = await firebaseAuthApi.post("v1/token", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // Firebase trả về object gồm: id_token, refresh_token, expires_in, user_id,...
    return res.data;
  } catch (err) {
    console.error("Refresh token failed:", err.response?.data || err.message);
    throw classifyFirebaseRefreshError(err);
  }
};

// Decode JWT token to get user info (without verification)
const verifyToken = async (idToken) => {
  try {
    if (!idToken) return null;

    // Decode JWT payload (base64)
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

    return {
      user_id: payload.user_id || payload.sub,
      email: payload.email,
      exp: payload.exp,
    };
  } catch (error) {
    console.error("Token decode error:", error.message);
    return null;
  }
};

module.exports = {
  login,
  logout,
  refreshIdToken,
  verifyToken,
  classifyFirebaseRefreshError,
  buildRefreshTokenRequestBody,
};
