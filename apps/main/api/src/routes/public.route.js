const Router = require("express");
const router = Router();
const publicController = require("../controllers/public.controller.js");

// 🚀 Public endpoints (no authentication required)
router.get("/themes", publicController.getThemes);

module.exports = router;
