const { db } = require("../../config/firebase-admin-config");
const { resolveEffectiveAccess } = require("../../utils/accessPlans");

const APPROVED_USERS_COLLECTION = "approved_users";
const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 phút quét 1 lần

let sweepTimer = null;

async function sweepExpiredSubscriptions() {
  if (!db) return { downgradedCount: 0 };

  try {
    const snapshot = await db.collection(APPROVED_USERS_COLLECTION).get();
    const now = Date.now();
    let downgradedCount = 0;

    const tasks = [];
    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const resolved = resolveEffectiveAccess(data, now);
      if (resolved.needsPersist) {
        downgradedCount += 1;
        tasks.push(
          doc.ref.set(resolved.downgradePatch, { merge: true }).then(() => {
            console.log(
              `⏰ Auto-downgraded expired entitlement for @${doc.id}:`,
              JSON.stringify(resolved.downgradePatch),
            );
          }),
        );
      }
    });

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }

    return { downgradedCount };
  } catch (error) {
    console.warn("⚠️ vipExpiryWorker sweep failed:", error.message);
    return { downgradedCount: 0 };
  }
}

function startVipExpiryWorker() {
  if (sweepTimer) return;
  // Chạy quét lần đầu sau khi server khởi động 10s
  setTimeout(() => {
    void sweepExpiredSubscriptions();
  }, 10_000).unref?.();

  sweepTimer = setInterval(() => {
    void sweepExpiredSubscriptions();
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

module.exports = {
  sweepExpiredSubscriptions,
  startVipExpiryWorker,
};
