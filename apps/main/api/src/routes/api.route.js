const Router = require("express");
const router = Router();
const apiController = require("../controllers/api.controller.js");
const { verifyIdToken } = require("../middlewares/verifyToken");
const { requireVipAccess } = require("../middlewares/requireVipAccess");
const { requireAiFilterAccess } = require("../middlewares/requireAiFilterAccess");
const aiFilterController = require("../controllers/aiFilter.controller.js");
const { aiFilterRateLimit } = require("../middlewares/rate-limit.js");

// Public weather endpoint.
router.post("/weatherV2", apiController.getWeatherV2);

// 🎵 Lấy thông tin nhạc từ Spotify/Apple Music
router.post("/getInfoMusic", apiController.getInfoMusic);

// ✨ AI Filter: ảnh đầu vào đã được client upload lên R2 riêng.
router.get(
  "/ai-filters",
  verifyIdToken,
  requireAiFilterAccess,
  aiFilterController.listFilters,
);
router.post(
  "/ai-filters/generate",
  verifyIdToken,
  requireAiFilterAccess,
  aiFilterRateLimit,
  aiFilterController.generate,
);

// 🎁 Check VIP Status
router.get("/check-vip", verifyIdToken, requireVipAccess, apiController.checkVipStatus);
router.get("/check-access", verifyIdToken, apiController.checkAccess);

// 🔄 Sync user Firebase ID to VIP record
router.post("/sync-uid", verifyIdToken, requireVipAccess, apiController.syncUserUid);

module.exports = router;
