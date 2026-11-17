import Dexie from "dexie";
import { uploadMomentsDB } from "./uploadMomentDB";
import { clearRemovedFriends } from "./diaryDB";
import { clearAccountStores } from "./accountDataPolicy.js";

// 👉 Khởi tạo lại DB
export function createLocketdioDB() {
  const db = new Dexie("LocketdioDB");

  db.version(1).stores({
    meta: "&key",
    friendIds: "uid, createdAt", // uid là primary key
    friendDetails: "uid, username, badge, isCelebrity",
    moments: "id, user, date",
    conversations: "uid, with_user, update_time",
    messages: "id, uid, update_time, [uid+update_time]",
    rollcalls: "uid, user, week_of_year, create_time",
    viewedMoments: "id, user, viewedAt"
  });

  db.version(2).stores({
    meta: "&key",
    friendIds: "uid, createdAt",
    friendDetails: "uid, username, badge, isCelebrity",
    moments: "id, user, date",
    conversations: "uid, with_user, update_time",
    messages: "id, uid, update_time, [uid+update_time]",
    rollcalls: "uid, user, week_of_year, create_time",
    viewedMoments: "id, user, viewedAt",
    groups: "id, last_updated_at",
    groupsMeta: "&key",
  });

  return db;
}
// 👉 Tạo instance ban đầu
let db = createLocketdioDB();

export default db;

// Xoá toàn bộ database (mọi bảng)
export async function clearAllDB({ strict = false } = {}) {
  try {
    await clearAccountStores(db.tables.map((table) => () => table.clear()));
    console.log("🧹 Cleared all tables (DB still exists)");
  } catch (err) {
    if (strict) throw err;
    console.error("❌ Failed to delete DB:", err);
  }
}

// These three databases contain personal data and are shared by the browser's
// active session. Theme, camera settings and other preferences stay untouched.
export async function clearAccountDBs() {
  await clearAccountStores([
    () => clearAllDB({ strict: true }),
    () => clearAccountStores(uploadMomentsDB.tables.map((table) => () => table.clear())),
    () => clearRemovedFriends(),
  ]);
}

export async function setDBOwner(uid) {
  await db.meta.put({
    key: "owner",
    uid,
    author: "T97",
    createdAt: Date.now(),
  });
}

export async function ensureDBOwner(currentUid) {
  const owner = await db.meta.get("owner");

  if (!owner || owner.uid !== currentUid) {
    console.warn("⚠️ DB owner mismatch → clearing DB");
    await clearAccountDBs();
    await setDBOwner(currentUid);    // set owner mới
  }
}
