const { settingsStore } = require("../services/AppCheck/settingsStore");
const { getOrCreateAppCheckToken, normalizeDeviceCheckToken, _private } = require("../services/AppCheck/appCheckService");

function status() {
  const saved = settingsStore.peek();
  const direct = _private.getConfiguredAppCheckToken();
  const device = _private.getConfiguredDeviceCheckToken();
  const rawDirect = saved?.appCheckToken || (!saved && (process.env.LOCKET_APP_CHECK_TOKEN || process.env.FIREBASE_APPCHECK_TOKEN));
  const expiry = _private.decodeJwtExpiry(rawDirect);
  return {
    source: saved ? "admin" : "env",
    mode: saved?.mode || (direct ? "static" : device ? "device-check" : rawDirect ? "static" : "none"),
    configured: Boolean(direct || device),
    expiresAt: expiry ? new Date(expiry * 1000).toISOString() : null,
    updatedAt: saved?.updatedAt || null,
    storageAvailable: !settingsStore.loadFailed(),
  };
}

function validateInput(body) {
  const mode = body?.mode;
  let token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 16000) throw new Error("Nhập token hợp lệ (tối đa 16000 ký tự).");
  if (mode === "static") {
    token = token.replace(/^(?:x-)?firebase-appcheck\s*:\s*/i, "").replace(/\\_/g, "_");
    const exp = _private.decodeJwtExpiry(token);
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || !exp) {
      throw new Error("App Check token phải là JWT có thời gian hết hạn.");
    }
    if (!_private.tokenIsUsable(token)) throw new Error("App Check token đã hết hạn hoặc còn dưới 1 phút. Hãy nhập token mới.");
    return { mode, appCheckToken: token, deviceCheckToken: null };
  }
  if (mode === "device-check") {
    const normalized = normalizeDeviceCheckToken(token);
    if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized.deviceToken) || normalized.deviceToken.length < 64) {
      throw new Error("DeviceCheck token không hợp lệ. Có thể dán token hoặc JSON chứa device_token.");
    }
    return { mode, appCheckToken: null, deviceCheckToken: normalized };
  }
  throw new Error("Chọn App Check JWT hoặc DeviceCheck.");
}

exports.get = async (_req, res) => {
  await settingsStore.load({ force: true });
  res.json({ success: true, data: status() });
};
exports.save = async (req, res) => {
  let value;
  try { value = validateInput(req.body); }
  catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    await settingsStore.save(value);
    res.json({ success: true, data: status() });
  } catch {
    res.status(503).json({ success: false, message: "Không lưu được cấu hình App Check. Kiểm tra Firestore và khóa bí mật của server." });
  }
};
exports.check = async (_req, res) => {
  try {
    const token = await getOrCreateAppCheckToken();
    if (!token) return res.status(409).json({ success: false, message: "Chưa có App Check token còn hạn. Nhập token trong Admin." });
    const expiry = _private.decodeJwtExpiry(token);
    res.json({ success: true, data: { ...status(), expiresAt: expiry ? new Date(expiry * 1000).toISOString() : null },
      message: "Đã lấy được token còn hạn. Việc chấp nhận token phụ thuộc API Locket khi sử dụng." });
  } catch {
    res.status(502).json({ success: false, message: "Firebase không đổi được DeviceCheck token. Hãy nhập token mới." });
  }
};
exports._private = { validateInput, status };
