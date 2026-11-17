export const AUTH_SESSION_CHANGED = "AUTH_SESSION_CHANGED";

export function sessionChangedError() {
  const error = new Error("Tài khoản đã thay đổi. Vui lòng thử lại trong phiên hiện tại.");
  error.code = AUTH_SESSION_CHANGED;
  error.authRefreshTerminal = false;
  return error;
}

export function isCurrentAccount(expectedLocalId, currentSession = {}) {
  return Boolean(expectedLocalId && expectedLocalId === currentSession.localId &&
    (currentSession.idToken || currentSession.refreshToken));
}

export function assertCurrentAccount(expectedLocalId, currentSession) {
  if (!isCurrentAccount(expectedLocalId, currentSession)) throw sessionChangedError();
}

export function isSameRefreshSession(expected = {}, current = {}) {
  return Boolean(expected.refreshToken && expected.refreshToken === current.refreshToken &&
    expected.localId === current.localId);
}

export function assertSameRefreshSession(expected, current) {
  if (!isSameRefreshSession(expected, current)) throw sessionChangedError();
}
