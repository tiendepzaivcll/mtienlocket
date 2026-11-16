const { randomUUID } = require("node:crypto");

const MAX_ITEMS = 100;
const MAX_DOCUMENT_BYTES = 900_000;
const CACHE_TTL_MS = 30_000;
const AUTHOR = "MTIEN";

function notificationError(message, status = 400, code = "NOTIFICATION_INVALID") {
  return Object.assign(new Error(message), { status, code });
}

function text(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw notificationError(`${label} là bắt buộc và không được vượt quá ${maxLength} ký tự.`);
  }
  return value.trim();
}

function validateInput(input, { partial = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw notificationError("Nội dung thông báo không hợp lệ.");
  }
  const result = {};
  for (const [field, label, maxLength] of [["title", "Tiêu đề", 160], ["message", "Nội dung", 5000]]) {
    if (!partial || Object.hasOwn(input, field)) result[field] = text(input[field], label, maxLength);
  }
  if (Object.hasOwn(input, "pinned")) {
    if (typeof input.pinned !== "boolean") throw notificationError("Trạng thái ghim phải là true hoặc false.");
    result.pinned = input.pinned;
  } else if (!partial) result.pinned = false;
  if (!Object.keys(result).length) throw notificationError("Chưa có nội dung cần cập nhật.");
  return result;
}

function validateId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
    throw notificationError("ID thông báo không hợp lệ.");
  }
  return id;
}

function projectNotification(item) {
  if (!item || typeof item !== "object") throw notificationError("Dữ liệu thông báo không hợp lệ.");
  const input = validateInput(item);
  if (typeof item.pinned !== "boolean" ||
    typeof item.created_at !== "string" || !Number.isFinite(Date.parse(item.created_at)) ||
    typeof item.updated_at !== "string" || !Number.isFinite(Date.parse(item.updated_at))) {
    throw notificationError("Dữ liệu thông báo không hợp lệ.");
  }
  return {
    id: validateId(item.id),
    title: input.title,
    message: input.message,
    pinned: input.pinned,
    created_at: new Date(item.created_at).toISOString(),
    updated_at: new Date(item.updated_at).toISOString(),
    author: AUTHOR,
  };
}

function sortNotifications(items) {
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) ||
    Date.parse(b.created_at) - Date.parse(a.created_at));
}

function readItems(snapshot) {
  if (!snapshot.exists) return [];
  try {
    const items = snapshot.data()?.items;
    if (!Array.isArray(items) || items.length > MAX_ITEMS) throw new Error("Invalid collection");
    const projected = items.map(projectNotification);
    if (new Set(projected.map((item) => item.id)).size !== projected.length) throw new Error("Duplicate IDs");
    return sortNotifications(projected);
  } catch {
    throw notificationError("Dữ liệu thông báo trên Firestore chưa hợp lệ.", 503, "NOTIFICATION_DATA_INVALID");
  }
}

function createNotificationStore({
  getDatabase,
  now = Date.now,
  idFactory = randomUUID,
  cacheTtlMs = CACHE_TTL_MS,
} = {}) {
  let cached = null;
  let cacheUntil = 0;
  let revision = 0;
  let pendingRead = null;

  function database() {
    const db = getDatabase?.();
    if (!db?.collection || typeof db.runTransaction !== "function") {
      throw notificationError("Firestore chưa sẵn sàng để quản lý thông báo.", 503, "NOTIFICATIONS_UNAVAILABLE");
    }
    return db;
  }

  const document = (db) => db.collection("app_settings").doc("notifications");
  const copy = (items) => items.map((item) => ({ ...item }));

  function invalidate() {
    revision += 1;
    cached = null;
    cacheUntil = 0;
    pendingRead = null;
  }

  async function list({ force = false } = {}) {
    if (!force && cached !== null && now() < cacheUntil) return copy(cached);
    if (!force && pendingRead?.revision === revision) return copy(await pendingRead.promise);
    const read = { revision, promise: null };
    read.promise = (async () => {
      try {
        const items = readItems(await document(database()).get());
        if (read.revision === revision) {
          cached = items;
          cacheUntil = now() + cacheTtlMs;
        }
        return items;
      } catch (error) {
        if (error.status) throw error;
        throw notificationError("Không tải được thông báo từ Firestore. Vui lòng thử lại.", 503, "NOTIFICATIONS_UNAVAILABLE");
      }
    })();
    pendingRead = read;
    try { return copy(await read.promise); }
    finally { if (pendingRead === read) pendingRead = null; }
  }

  async function mutate(change) {
    try {
      const db = database();
      const ref = document(db);
      const result = await db.runTransaction(async (transaction) => {
        const items = readItems(await transaction.get(ref));
        const outcome = change(items);
        const stored = { items: sortNotifications(outcome.items), updated_at: new Date(now()).toISOString() };
        if (stored.items.length > MAX_ITEMS) {
          throw notificationError("Chỉ lưu tối đa 100 thông báo. Hãy xoá thông báo cũ trước.", 409, "NOTIFICATION_LIMIT_REACHED");
        }
        if (Buffer.byteLength(JSON.stringify(stored), "utf8") > MAX_DOCUMENT_BYTES) {
          throw notificationError("Tổng nội dung thông báo đã đầy. Hãy rút gọn hoặc xoá thông báo cũ.", 409, "NOTIFICATION_STORAGE_LIMIT");
        }
        transaction.set(ref, stored);
        return outcome.result;
      });
      invalidate();
      return result && { ...result };
    } catch (error) {
      if (error.status) throw error;
      throw notificationError("Không lưu được thông báo vào Firestore. Vui lòng thử lại.", 503, "NOTIFICATIONS_UNAVAILABLE");
    }
  }

  async function create(input) {
    const fields = validateInput(input);
    const timestamp = new Date(now()).toISOString();
    const item = { id: validateId(idFactory()), ...fields,
      created_at: timestamp, updated_at: timestamp, author: AUTHOR };
    return mutate((items) => {
      if (items.some((current) => current.id === item.id)) {
        throw notificationError("ID thông báo bị trùng. Vui lòng thử lại.", 409, "NOTIFICATION_ID_CONFLICT");
      }
      return { items: [item, ...items], result: item };
    });
  }

  async function update(id, input) {
    validateId(id);
    const fields = validateInput(input, { partial: true });
    const timestamp = new Date(now()).toISOString();
    return mutate((items) => {
      const existing = items.find((item) => item.id === id);
      if (!existing) throw notificationError("Không tìm thấy thông báo.", 404, "NOTIFICATION_NOT_FOUND");
      const updated = { ...existing, ...fields, updated_at: timestamp, author: AUTHOR };
      return { items: items.map((item) => item.id === id ? updated : item), result: updated };
    });
  }

  async function remove(id) {
    validateId(id);
    return mutate((items) => {
      if (!items.some((item) => item.id === id)) {
        throw notificationError("Không tìm thấy thông báo.", 404, "NOTIFICATION_NOT_FOUND");
      }
      return { items: items.filter((item) => item.id !== id), result: { id } };
    });
  }

  return { list, create, update, remove, invalidate };
}

const store = createNotificationStore({
  getDatabase: () => require("../../config/firebase-admin-config").db,
});

module.exports = {
  ...store,
  createNotificationStore,
  projectNotification,
  sortNotifications,
  validateInput,
  MAX_ITEMS,
  MAX_DOCUMENT_BYTES,
};
