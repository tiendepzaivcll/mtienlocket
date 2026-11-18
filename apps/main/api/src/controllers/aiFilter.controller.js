const aiFilterService = require("../services/AiFilter");
const { admin } = require("../config/firebase-admin-config");

const listFilters = (req, res) => {
  res.status(200).json({
    success: true,
    data: aiFilterService.publicCatalog(),
  });
};

const generate = async (req, res, next) => {
  try {
    const imageUrl = String(req.body?.imageUrl || "").trim();
    const filterId = String(req.body?.filterId || "").trim();

    if (!imageUrl || !filterId) {
      const error = new Error("Thiếu imageUrl hoặc filterId.");
      error.status = 400;
      error.code = "AI_FILTER_PAYLOAD_INVALID";
      throw error;
    }

    const result = await aiFilterService.generateFilteredImage({
      imageUrl,
      filterId,
    });

    let remainingCredits = typeof req.aiCredits === "number" ? Math.max(0, req.aiCredits - 1) : 0;

    // Trừ 1 lượt tạo ảnh trong Firestore
    if (req.approvedDocRef && admin?.firestore?.FieldValue) {
      req.approvedDocRef
        .update({
          aiCredits: admin.firestore.FieldValue.increment(-1),
          updatedAt: new Date().toISOString(),
        })
        .catch((err) => {
          console.warn("⚠️ Không thể trừ aiCredits trong Firestore:", err.message);
        });
    }

    res.status(200).json({
      success: true,
      data: {
        ...result,
        remainingCredits,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listFilters, generate };
