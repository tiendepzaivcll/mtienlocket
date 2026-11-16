const Router = require("express");
const adminController = require("../controllers/admin.controller.js");
const appCheckAdmin = require("../controllers/appCheckAdmin.controller.js");
const captionPresetAdmin = require("../controllers/captionPresetAdmin.controller.js");
const aiFilterAdmin = require("../controllers/aiFilterAdmin.controller.js");
const notifications = require("../controllers/notification.controller.js");

const router = Router();

router.post("/login", adminController.login);
router.get("/notifications", adminController.verifyAdmin.bind(adminController), notifications.list);
router.post("/notifications", adminController.verifyAdmin.bind(adminController), notifications.create);
router.patch("/notifications/:id", adminController.verifyAdmin.bind(adminController), notifications.update);
router.delete("/notifications/:id", adminController.verifyAdmin.bind(adminController), notifications.remove);
router.get("/app-check", adminController.verifyAdmin.bind(adminController), appCheckAdmin.get);
router.put("/app-check", adminController.verifyAdmin.bind(adminController), appCheckAdmin.save);
router.post("/app-check/check", adminController.verifyAdmin.bind(adminController), appCheckAdmin.check);
router.get("/ai-filter", adminController.verifyAdmin.bind(adminController), aiFilterAdmin.get);
router.put("/ai-filter", adminController.verifyAdmin.bind(adminController), aiFilterAdmin.save);
router.get("/caption-presets", adminController.verifyAdmin.bind(adminController), captionPresetAdmin.list);
router.put("/caption-presets", adminController.verifyAdmin.bind(adminController), captionPresetAdmin.save);
router.delete(
  "/caption-presets/:presetId",
  adminController.verifyAdmin.bind(adminController),
  captionPresetAdmin.remove,
);
router.get(
  "/approved-users",
  adminController.verifyAdmin.bind(adminController),
  adminController.listApprovedUsers.bind(adminController),
);
router.post(
  "/approved-users",
  adminController.verifyAdmin.bind(adminController),
  adminController.addApprovedUser.bind(adminController),
);
router.patch(
  "/approved-users/:username",
  adminController.verifyAdmin.bind(adminController),
  adminController.updateApprovedUser.bind(adminController),
);
router.delete(
  "/approved-users/:username",
  adminController.verifyAdmin.bind(adminController),
  adminController.deleteApprovedUser.bind(adminController),
);

module.exports = router;
