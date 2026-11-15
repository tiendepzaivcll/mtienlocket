const express = require("express");
const { generatePresignedUrlV3 } = require("../controllers/PresignedController");
const { deleteFileFromR2, deleteFilesByDay } = require("../controllers/DeleteController");
const { verifyIdToken } = require("../middlewares/verifyIdToken");
const { verifyInternalToken } = require("../middlewares/verifyInternalToken");
const { cleanByDay } = require("../controllers/CronCleanController");
const router = express.Router();

router.post("/presignedV3", verifyIdToken, generatePresignedUrlV3);

router.post("/delete", verifyInternalToken, deleteFileFromR2);

router.post("/cleanByDay", verifyInternalToken, deleteFilesByDay);
router.post("/autoCleanByDay", cleanByDay);

module.exports = router;
