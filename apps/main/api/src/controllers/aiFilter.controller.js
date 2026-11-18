const aiFilterService = require("../services/AiFilter");
const { admin, db } = require("../config/firebase-admin-config");

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

    // Trừ 1 lượt tạo ảnh an toàn trong Firestore bằng Transaction
    if (req.approvedDocRef && db) {
      try {
        await db.runTransaction(async (t) => {
          const doc = await t.get(req.approvedDocRef);
          if (!doc.exists) return;
          const data = doc.data() || {};
          const currentCredits = Math.max(
            0,
            Number(data.aiCredits ?? (data.aiFilterEnabled ? 20 : 0))
          );
          const nextCredits = Math.max(0, currentCredits - 1);
          remainingCredits = nextCredits;
          t.update(req.approvedDocRef, {
            aiCredits: nextCredits,
            aiFilterEnabled: nextCredits > 0,
            updatedAt: new Date().toISOString(),
          });
        });
      } catch (err) {
        console.warn("⚠️ Không thể trừ aiCredits trong Firestore:", err.message);
      }
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
