const crypto = require("crypto");

function getEncryptionKey(env = process.env) {
  // Firebase Admin credential is already a required, stable server secret.
  // Derive a purpose-bound key so Slot Monitor needs no extra environment key.
  const secret = String(env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (secret.length < 32) return null;
  return crypto
    .createHmac("sha256", secret)
    .update("t97-slot-monitor-refresh-token-v1")
    .digest();
}

function encryptionUnavailable() {
  const error = new Error("Firebase Admin private key chưa sẵn sàng để mã hóa phiên nền.");
  error.code = "SLOT_ENCRYPTION_UNAVAILABLE";
  error.status = 503;
  return error;
}

function encryptSecret(value, env = process.env) {
  const key = getEncryptionKey(env);
  if (!key) throw encryptionUnavailable();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value || ""), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptSecret(payload, env = process.env) {
  const key = getEncryptionKey(env);
  if (!key) throw encryptionUnavailable();
  const [iv, tag, encrypted] = String(payload || "").split(".");
  if (!iv || !tag || !encrypted) {
    const error = new Error("Phiên Slot Monitor đã mã hóa không hợp lệ.");
    error.code = "SLOT_SESSION_INVALID";
    throw error;
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { decryptSecret, encryptSecret, getEncryptionKey };
