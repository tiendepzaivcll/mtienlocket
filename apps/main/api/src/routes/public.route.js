const Router = require("express");
const router = Router();
const publicController = require("../controllers/public.controller.js");
const notifications = require("../controllers/notification.controller.js");

// 🚀 Public endpoints (no authentication required)
router.get("/themes", publicController.getThemes);
router.get("/notification", notifications.publicList);

module.exports = router;
