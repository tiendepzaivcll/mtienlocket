const Router = require("express");
const router = Router();
const handleUpload = require("../middlewares/multipart-upload-support.middleware.js");
const MAX_IMAGE_COUNT = 1;
const MAX_VIDEO_COUNT = 1;

const locketController = require("../controllers/locket.controller.js");
const { verifyIdToken } = require("../middlewares/verifyToken.js");
const { requireVipAccess } = require("../middlewares/requireVipAccess.js");
const saveUploadFile = require("../middlewares/save-upload-files.js");
const { uploadIdempotency } = require("../middlewares/upload-idempotency.js");
const {
  loginRateLimit,
  refreshRateLimit,
  uploadRateLimit,
} = require("../middlewares/rate-limit.js");
const {
  validateUploadPayload,
} = require("../middlewares/validate-upload-payload.js");

// Lazy load checkVipExpiry middleware
const getCheckVipExpiry = () => {
  try {
    return require("../middlewares/checkVipExpiry.js");
  } catch (err) {
    console.warn("⚠️ Cannot load checkVipExpiry middleware:", err.message);
    // Return no-op middleware
    return (req, res, next) => next();
  }
};

router.post("/login", loginRateLimit, locketController.login);
router.get("/logout", locketController.logout);
router.post("/refresh-token", refreshRateLimit, locketController.refreshToken);

router.post("/getAllFriendsV2", verifyIdToken, requireVipAccess, locketController.getAllFriends);
router.post("/friendAction", verifyIdToken, requireVipAccess,
  require("../controllers/relationship.controller").relationshipAction);
router.post("/getFriendProfilesV2", verifyIdToken, requireVipAccess, locketController.getFriendProfiles);
router.post("/getIncomingFriendRequestsV2", verifyIdToken, requireVipAccess, locketController.getIncomingFriendRequests);
router.post("/getOutgoingFriendRequestsV2", verifyIdToken, requireVipAccess, locketController.getOutgoingFriendRequests);
router.post("/deleteFriendRequestsV2", verifyIdToken, requireVipAccess, locketController.deleteFriendRequests);
router.post("/getUserByUsername", verifyIdToken, locketController.getUserByUsername);
router.post("/resolveCelebrityProfile", verifyIdToken, locketController.resolveCelebrityProfile);
router.post("/sendFriendRequestV2", verifyIdToken, requireVipAccess, locketController.sendFriendRequest);
router.post("/sendCelebrityRequestV2", verifyIdToken, requireVipAccess, locketController.sendCelebrityRequest);

router.post("/getInfoUser", verifyIdToken, locketController.getInfoLocket);
router.get("/getLocketsCount", verifyIdToken, requireVipAccess, locketController.getLocketsCount);

//API bản V1 yêu cầu tải trực tiếp file trong request
router.post("/postMomentV1", verifyIdToken, requireVipAccess, saveUploadFile, locketController.uploadMediaV1);

//API bản V2 chính là công nghệ hiện tại Locket.io.vn đang sử dụng
router.post(
  "/postMomentV2",
  verifyIdToken,
  requireVipAccess,
  uploadIdempotency,
  uploadRateLimit,
  validateUploadPayload,
  locketController.uploadMediaV2,
);

router.post("/getMomentV2", verifyIdToken, requireVipAccess, locketController.getMoments);
router.post("/getInfoMomentV2", verifyIdToken, requireVipAccess, locketController.getInfoMoment);
router.post("/getAllMessageV2", verifyIdToken, requireVipAccess, locketController.getMessages);
router.post("/getMessageWithUserV2", verifyIdToken, requireVipAccess, locketController.getMessagesWithUser);

router.post("/getRollcallPosts", verifyIdToken, requireVipAccess, locketController.getRollcallPosts);
router.get("/getRollcallMediaV2", verifyIdToken, requireVipAccess, locketController.getRollcallMedia);

module.exports = router;
