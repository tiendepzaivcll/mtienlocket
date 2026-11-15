const { db } = require("../config/firebase-admin-config");

const APPROVED_USER_COLLECTION = "approved_users";

const isApprovedDocEnabled = (data = {}) =>
  data.active !== false &&
  data.approved !== false &&
  data.enabled !== false &&
  data.disabled !== true;

const requireVipAccess = async (req, res, next) => {
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

    if (!access || !isApprovedDocEnabled(access)) {
      return res.status(403).json({
        success: false,
        code: "ACCESS_NOT_APPROVED",
        message: "Tài khoản chưa được admin phê duyệt.",
      });
    }

    const role = String(access.role || "vip").trim().toLowerCase();
    if (role !== "vip") {
      return res.status(403).json({
        success: false,
        code: "VIP_REQUIRED",
        message: "Cần Mua Gói Vip Để Sử Dụng",
      });
    }

    req.accessRole = "vip";
    return next();
  } catch (error) {
    console.error("❌ Lỗi kiểm tra quyền VIP:", error);
    return res.status(500).json({
      success: false,
      message: "Không kiểm tra được quyền VIP",
    });
  }
};

module.exports = { requireVipAccess };
