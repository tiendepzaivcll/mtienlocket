export const TERMINAL_REFRESH_CODES = Object.freeze([
  "REFRESH_TOKEN_INVALID",
  "REFRESH_TOKEN_EXPIRED",
  "REFRESH_TOKEN_MISSING",
  "AUTH_REFRESH_TOKEN_MISSING",
  "INVALID_REFRESH_TOKEN",
  "TOKEN_EXPIRED",
  "USER_DISABLED",
  "USER_NOT_FOUND",
  "AUTH_REFRESH_TERMINAL",
]);

export function getAuthErrorCode(responseData) {
  const rawCode =
    responseData?.code ??
    responseData?.error?.code ??
    (typeof responseData?.error === "string" ? responseData.error : "") ??
    responseData?.message;
  return String(rawCode || "").trim().toUpperCase();
}

export function isTerminalRefreshErrorCode(code) {
  return TERMINAL_REFRESH_CODES.includes(String(code || "").trim().toUpperCase());
}

export function isTerminalRefreshError(error) {
  if (error?.authRefreshTerminal !== undefined) {
    return Boolean(error.authRefreshTerminal);
  }

  const responseData = error?.response?.data;
  if (responseData?.terminal !== undefined) return Boolean(responseData.terminal);
  if (responseData?.authRefreshTerminal !== undefined) {
    return Boolean(responseData.authRefreshTerminal);
  }

  return isTerminalRefreshErrorCode(
    responseData?.code || responseData?.error?.code || error?.code,
  );
}

export function decideAuth401Action({
  status,
  skipAuthRefresh = false,
  isRetry = false,
} = {}) {
  if (skipAuthRefresh) return { action: "bypass" };
  if (Number(status || 0) !== 401) return { action: "pass-through" };
  if (isRetry) return { action: "reject-no-logout" };
  return { action: "refresh-and-retry" };
}

export function decideRefreshErrorAction(error) {
  const isTerminal = isTerminalRefreshError(error);
  return {
    isTerminal,
    action: isTerminal ? "logout-and-reject" : "reject-only",
  };
}
