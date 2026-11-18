const { db } = require("../config/firebase-admin-config");
const { resolveEffectiveAccess } = require("../utils/accessPlans");

const APPROVED_USER_COLLECTION = "approved_users";

/**
 * Middleware: cho phép tất cả user đã đăng nhập (trừ tài khoản bị khoá/disabled) đi qua.
 * Tự động kiểm tra hạn VIP: nếu hết hạn → hạ xuống "free" tự động trong Firestore.
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

    if (!access) {
      req.accessRole = "free";
      return next();
    }

    const resolved = resolveEffectiveAccess(access);

    if (!resolved.isEnabled) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị vô hiệu hóa.",
        disabled: true,
      });
    }

    if (resolved.needsPersist && approvedDoc?.ref) {
      approvedDoc.ref.set(resolved.downgradePatch, { merge: true }).catch((err) => {
        console.warn("⚠️ Không thể cập nhật trạng thái hết hạn VIP:", err.message);
      });
    }

    req.accessRole = resolved.effectiveRole;
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
