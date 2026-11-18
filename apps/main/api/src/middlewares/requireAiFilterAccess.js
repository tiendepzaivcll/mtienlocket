const { db } = require("../config/firebase-admin-config");
const {
  isApprovedDocEnabled,
  resolveEffectiveAccess,
} = require("../utils/accessPlans");

const APPROVED_USER_COLLECTION = "approved_users";

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

    if (!access) {
      return res.status(403).json({
        success: false,
        code: "AI_FILTER_VIP_REQUIRED",
        message: "Tính năng AI Filter chỉ dành cho thành viên VIP. Vui lòng nâng cấp VIP trước!",
        data: {
          title: "Cần nâng cấp VIP",
          description: "Nâng cấp VIP để mở khóa quyền mua và sử dụng AI Filter",
        },
      });
    }

    const resolved = resolveEffectiveAccess(access);
    if (resolved.needsPersist && approvedDoc?.ref) {
      approvedDoc.ref.set(resolved.downgradePatch, { merge: true }).catch((err) => {
        console.warn("⚠️ Không thể lưu trạng thái hết hạn:", err.message);
      });
    }

    // 1. Phải là thành viên VIP còn hạn
    if (!resolved.isVipActive) {
      return res.status(403).json({
        success: false,
        code: "AI_FILTER_VIP_REQUIRED",
        message: "Tính năng AI Filter chỉ dành cho thành viên VIP. Vui lòng nâng cấp VIP trước!",
        data: {
          title: "Cần nâng cấp VIP",
          description: "Gói VIP của bạn đã hết hạn hoặc chưa kích hoạt. Nâng cấp VIP để sử dụng AI Filter.",
        },
      });
    }

    // 2. Phải còn số lượt tạo ảnh (aiCredits > 0)
    if (resolved.aiCredits <= 0) {
      return res.status(403).json({
        success: false,
        code: "AI_FILTER_OUT_OF_CREDITS",
        message: "Bạn đã hết lượt tạo ảnh AI. Vui lòng nạp thêm gói để tiếp tục!",
        data: {
          title: "Hết lượt tạo ảnh AI",
          description: "Mua thêm gói lượt tạo ảnh AI tại trang Nâng cấp.",
        },
      });
    }

    req.aiFilterAccess = true;
    req.approvedDocRef = approvedDoc.ref;
    req.aiCredits = resolved.aiCredits;
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
};
