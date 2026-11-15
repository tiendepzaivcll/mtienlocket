const crypto = require("node:crypto");

// Only ciphertext is persisted. Reuse the server's existing secret; no new env
// setting is necessary. Never expose the document or plaintext in public APIs.
function createSettingsStore({ getDocument, getSecret, now = Date.now }) {
  let current = null;
  let checkedAt = 0;
  let pending = null;
  let revision = 0;
  let loadError = false;
  const key = () => {
    const secret = getSecret();
    if (!secret) throw new Error("Chưa có khóa bí mật phía server để lưu App Check.");
    return crypto.createHash("sha256").update(`t97-appcheck:${secret}`).digest();
  };
  const encrypt = (data) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64")).join(".");
  };
  const decrypt = (value) => {
    const [iv, tag, body] = value.split(".").map((part) => Buffer.from(part, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"));
  };
  async function load({ force = false } = {}) {
    if (!force && checkedAt && now() - checkedAt < 30_000) return current;
    if (pending) return pending;
    const startedRevision = revision;
    pending = (async () => {
      try {
        const ref = getDocument();
        if (!ref) return current;
        const doc = await ref.get();
        const next = doc.exists ? decrypt(doc.data().encrypted) : null;
        if (revision === startedRevision && JSON.stringify(next) !== JSON.stringify(current)) {
          current = next;
          revision += 1;
        }
        loadError = false;
      } catch {
        // Keep last-known-good settings on a temporary database failure.
        loadError = true;
      } finally {
        checkedAt = now();
      }
      return current;
    })().finally(() => { pending = null; });
    return pending;
  }
  async function save(data) {
    const ref = getDocument();
    if (!ref) throw new Error("Firestore chưa sẵn sàng để lưu App Check.");
    const next = { ...data, updatedAt: new Date(now()).toISOString() };
    await ref.set({ encrypted: encrypt(next), updatedAt: next.updatedAt });
    current = next;
    revision += 1;
    checkedAt = now();
    loadError = false;
    return next;
  }
  return { load, save, peek: () => current, revision: () => revision, loadFailed: () => loadError };
}

const settingsStore = createSettingsStore({
  getDocument: () => {
    if (!process.env.FIREBASE_PROJECT_ID) return null;
    const { db } = require("../../config/firebase-admin-config");
    return db?.collection("server_settings").doc("locket_app_check") || null;
  },
  getSecret: () => process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || process.env.FIREBASE_PRIVATE_KEY,
});

module.exports = { settingsStore, createSettingsStore };
