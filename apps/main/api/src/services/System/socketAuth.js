const { checkTokenValid } = require("../../utils/checkTokenValid");

function createSocketAuthError(message, code = "SOCKET_AUTH_INVALID") {
  const error = new Error(message);
  error.data = { code };
  return error;
}

async function authenticateSocketToken(token, authServices) {
  const validation = checkTokenValid(token);
  if (!validation.valid) {
    throw createSocketAuthError(validation.message, "SOCKET_AUTH_EXPIRED");
  }

  const decoded = await authServices.verifyToken(token);
  const localId = decoded?.user_id;
  if (!localId) {
    throw createSocketAuthError("Token không có user id");
  }

  return { idToken: token, localId };
}

async function resolveSocketSession(socket, token, authServices) {
  const candidate = token || socket.data?.session?.idToken;
  if (candidate && candidate === socket.data?.session?.idToken) {
    return socket.data.session;
  }
  const session = await authenticateSocketToken(candidate, authServices);
  socket.data.session = session;
  return session;
}

function socketErrorPayload(error, requestId) {
  return {
    ok: false,
    requestId: requestId || null,
    code: error?.data?.code || error?.code || "SOCKET_REQUEST_FAILED",
    message: error?.message || "Socket request failed",
  };
}

function normalizeSocketLimit(value, fallback = 50) {
  return Math.min(Math.max(Number(value) || fallback, 1), 100);
}

module.exports = {
  authenticateSocketToken,
  createSocketAuthError,
  normalizeSocketLimit,
  resolveSocketSession,
  socketErrorPayload,
};
