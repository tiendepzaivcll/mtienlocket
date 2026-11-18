const { db } = require("../config/firebase-admin-config");
const {
  isApprovedDocEnabled,
  toTimestampMs,
  resolveEffectiveAccess,
} = require("../utils/accessPlans");

const APPROVED_USER_COLLECTION = "approved_users";

const hasAiFilterAccess = (data = {}, now = Date.now()) => {
  if (!isApprovedDocEnabled(data) || data.aiFilterEnabled !== true) return false;
  const expireAt = toTimestampMs(data.aiFilterExpireAt);
  if (expireAt !== null && now > expireAt) return false;
  return true;
};

const requireAiFilterAccess = async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        message: "Firestore chưa sẵn sàng",
      });
    }

    const uid = req.user?.localId || req.user?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const snapshot = await db
      .collection(APPROVED_USER_COLLECTION)
      .where("uid", "==", uid)
      .limit(1)
      .get();
    const approvedDoc = snapshot.docs[0];
    const access = approvedDoc?.data() || null;

    if (access) {
      const resolved = resolveEffectiveAccess(access);
      if (resolved.needsPersist && approvedDoc?.ref) {
        approvedDoc.ref.set(resolved.downgradePatch, { merge: true }).catch((err) => {
          console.warn("⚠️ Không thể lưu trạng thái hết hạn AI Filter:", err.message);
        });
      }
    }

    if (!access || !hasAiFilterAccess(access)) {
      return res.status(403).json({
        success: false,
        code: "AI_FILTER_PAYMENT_REQUIRED",
        message: "AI Filter là gói bán riêng",
        data: {
          title: "AI Filter (Bán riêng)",
          description: "Mua gói AI Filter tại trang Nâng cấp để sử dụng",
        },
      });
    }

    req.aiFilterAccess = true;
    return next();
  } catch (error) {
    console.error("❌ Lỗi kiểm tra quyền AI Filter:", error);
    return res.status(500).json({
      success: false,
      message: "Không kiểm tra được quyền AI Filter",
    });
  }
};

module.exports = {
  requireAiFilterAccess,
  _private: { isApprovedDocEnabled, hasAiFilterAccess },
};
