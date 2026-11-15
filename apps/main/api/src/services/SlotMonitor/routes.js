const express = require("express");
const { verifyIdToken } = require("../../middlewares/verifyToken");
const { requireVipAccess } = require("../../middlewares/requireVipAccess");
const { sanitizeWatchInput } = require("./core");
const store = require("./store");
const {
  checkNowForUser,
  enableSession,
  getPublicConfig,
} = require("./service");

const router = express.Router();
const MAX_WATCHES = 20;

function publicWatch(watch) {
  if (!watch) return null;
  return {
    uid: watch.celebUid,
    username: watch.username,
    displayName: watch.displayName,
    avatar: watch.avatar,
    friendCount: Number(watch.friendCount) || 0,
    maxFriends: Number(watch.maxFriends) || 0,
    availableSlots: Number(watch.availableSlots) || 0,
    relationship: watch.relationship || "none",
    snapshotSource: watch.snapshotSource || null,
    status: watch.status || "WATCHING",
    enabled: watch.enabled !== false,
    autoRequestEnabled: watch.autoRequestEnabled === true,
    lastCheckedAt: Number(watch.lastCheckedAt) || null,
    lastError: watch.lastError || null,
    lastAutoRequestAt: Number(watch.lastAutoRequestAt) || null,
    lastAutoRequestStatus: watch.lastAutoRequestStatus || null,
    lastAutoRequestError: watch.lastAutoRequestError || null,
  };
}

router.use(verifyIdToken, requireVipAccess);

router.get("/config", async (req, res, next) => {
  try {
    const session = store.isConfigured()
      ? await store.getSession(req.user.uid)
      : null;
    res.json({
      success: true,
      data: {
        ...getPublicConfig(),
        sessionConfigured: Boolean(
          session?.enabled && session?.refreshTokenEncrypted,
        ),
        sessionError: session?.lastError || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/watches", async (req, res, next) => {
  try {
    // Older workers treated Locket's notification waitlist as a completed
    // request. Repair those records before the UI reads them so a page reload
    // never appears to turn background monitoring off.
    await store.resumeLegacyWaitlistWatches(req.user.uid);
    const watches = await store.listUserWatches(req.user.uid);
    res.json({ success: true, data: watches.map(publicWatch) });
  } catch (error) {
    next(error);
  }
});

router.post("/enable", async (req, res, next) => {
  try {
    const config = await enableSession(
      req.user.uid,
      String(req.body?.refreshToken || "").trim(),
    );
    res.json({ success: true, message: "Đã nạp phiên Slot Monitor.", data: config });
  } catch (error) {
    next(error);
  }
});

router.post("/watch", async (req, res, next) => {
  try {
    const watch = sanitizeWatchInput(req.body?.watch || req.body);
    if (!watch) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SLOT_WATCH",
        message: "Celebrity phải có UID và username hợp lệ.",
      });
    }
    const watches = await store.listUserWatches(req.user.uid);
    const exists = watches.some((item) => item.celebUid === watch.uid);
    if (!exists && watches.length >= MAX_WATCHES) {
      return res.status(400).json({
        success: false,
        code: "SLOT_WATCH_LIMIT",
        message: `Chỉ được canh tối đa ${MAX_WATCHES} Celebrity.`,
      });
    }
    const saved = await store.upsertWatch(req.user.uid, watch);
    return res.json({ success: true, data: publicWatch(saved) });
  } catch (error) {
    return next(error);
  }
});

router.patch("/watch/:uid", async (req, res, next) => {
  try {
    const patch = {};
    if (typeof req.body?.enabled === "boolean") {
      patch.enabled = req.body.enabled;
      patch.status = req.body.enabled ? "WATCHING" : "PAUSED";
      if (req.body.enabled) patch.nextCheckAt = 0;
    }
    if (typeof req.body?.autoRequestEnabled === "boolean") {
      patch.autoRequestEnabled = req.body.autoRequestEnabled;
      if (req.body.autoRequestEnabled) patch.nextCheckAt = 0;
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SLOT_WATCH_UPDATE",
        message: "Không có cấu hình hợp lệ để cập nhật.",
      });
    }
    const updated = await store.updateWatch(req.user.uid, req.params.uid, patch);
    if (!updated) {
      return res.status(404).json({
        success: false,
        code: "SLOT_WATCH_NOT_FOUND",
        message: "Không tìm thấy Celebrity đang canh.",
      });
    }
    return res.json({ success: true, data: publicWatch(updated) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/watch/:uid", async (req, res, next) => {
  try {
    const removed = await store.removeWatch(req.user.uid, req.params.uid);
    return res.status(removed ? 200 : 404).json({
      success: removed,
      code: removed ? undefined : "SLOT_WATCH_NOT_FOUND",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/check/:uid", async (req, res, next) => {
  try {
    const result = await checkNowForUser(req.user.uid, req.params.uid, req.user.idToken);
    return res.json({
      success: true,
      data: publicWatch(result.watch),
      autoRequest: result.autoRequest,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
