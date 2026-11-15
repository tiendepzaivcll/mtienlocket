const express = require("express");
const adminController = require("../controllers/admin.controller"); 
const router = express.Router();

// Route không cần khoá
router.post("/admin/login", adminController.login);

// Mấy route này phải qua trạm kiểm soát (middleware verifyAdmin)
router.use("/admin/vip", adminController.verifyAdmin);

router.get("/admin/vip", adminController.getVipEmails);
router.post("/admin/vip", adminController.addVipEmail);
router.put("/admin/vip/:id", adminController.updateVipEmail);
router.delete("/admin/vip/:id", adminController.deleteVipEmail);
router.post("/admin/vip/remove-duplicates", adminController.removeDuplicates);

module.exports = router;
