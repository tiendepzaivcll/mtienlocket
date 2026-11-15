const { db } = require("../config/firebase-admin-config");

const APPROVED_USER_COLLECTION = "approved_users";

const isApprovedDocEnabled = (data = {}) =>
  data.active !== false &&
  data.approved !== false &&
  data.enabled !== false &&
  data.disabled !== true;

const hasAiFilterAccess = (data = {}) =>
  isApprovedDocEnabled(data) && data.aiFilterEnabled === true;

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
    const access = snapshot.docs[0]?.data() || null;

    if (!access || !hasAiFilterAccess(access)) {
      return res.status(403).json({
        success: false,
        code: "AI_FILTER_PAYMENT_REQUIRED",
        message: "Tính năng trả phí",
        data: {
          title: "Tính năng trả phí",
          description: "Liên hệ admin để sử dụng",
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
