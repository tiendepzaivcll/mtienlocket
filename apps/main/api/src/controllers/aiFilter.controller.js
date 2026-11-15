const aiFilterService = require("../services/AiFilter");

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

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { listFilters, generate };
