const { db } = require("../config/firebase-admin-config");

const APPROVED_USER_COLLECTION = "approved_users";

const isApprovedDocEnabled = (data = {}) =>
  data.active !== false &&
  data.approved !== false &&
  data.enabled !== false &&
  data.disabled !== true;

/**
 * Middleware: cho phép tất cả user đã đăng nhập đi qua.
 * Gắn req.accessRole = role thực tế ("vip", "free", "celebrity")
 * Các tính năng VIP sẽ được kiểm tra riêng ở frontend hoặc từng endpoint.
 */
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

    // Nếu có doc và đang enabled → cho qua với role thực tế
    if (access && isApprovedDocEnabled(access)) {
      const role = String(access.role || "free").trim().toLowerCase();
      req.accessRole = role;
      return next();
    }

    // Nếu không tìm thấy doc bằng uid → vẫn cho qua với role "free"
    // (trường hợp user mới đăng nhập, chưa kịp sync uid vào approved_users)
    req.accessRole = "free";
    return next();
  } catch (error) {
    console.error("❌ Lỗi kiểm tra quyền:", error);
    return res.status(500).json({
      success: false,
      message: "Không kiểm tra được quyền truy cập",
    });
  }
};

module.exports = { requireVipAccess };
