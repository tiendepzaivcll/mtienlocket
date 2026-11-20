const {
  postServices,
  authServices,
  friendServices,
  processServices,
  chatServices,
} = require("../services");
const { formatFileSize } = require("../utils/formatFileSize");
const {
  logWarning,
  logTable,
  logLoading,
  logInfo,
} = require("../utils/logEventUtils");

const MAX_SIZE_MB_UPLOAD = 20; //MB
const MAX_VIDEO_SIZE_MB_AFTER_COMPRESS = 5;

const getLocketUploadData = (result) =>
  result?.data ||
  result?.result?.data ||
  result?.moment ||
  result ||
  null;

// Keep upstream Locket authentication failures distinct from an invalid
// session on our own API. This prevents the client from showing only Axios'
// generic “Request failed with status code 401” message.
const mapLocketAuthFailure = (error) => {
  const upstreamStatus = Number(error?.response?.status || error?.status);
  if (upstreamStatus !== 401) return error;
  const upstreamData = error?.data || error?.response?.data || {};
  const upstreamCode =
    upstreamData?.code || upstreamData?.error?.code || error?.code || null;
  const upstreamMessage =
    upstreamData?.message ||
    upstreamData?.error?.message ||
    (Array.isArray(upstreamData?.errors)
      ? upstreamData.errors.filter(Boolean).join(", ")
      : null);
  console.warn("[friends] Locket rejected write authentication", {
    upstreamStatus,
    upstreamCode,
    upstreamMessage,
  });
  const mapped = new Error(
    "Locket từ chối phiên hoặc thiết bị (401). App Check đã được thử làm mới; kiểm tra lại phiên đăng nhập và Device/Instance token.",
  );
  mapped.status = 502;
  mapped.code = "LOCKET_UPSTREAM_UNAUTHORIZED";
  mapped.data = { upstreamStatus, upstreamCode, upstreamMessage };
  return mapped;
};

class LocketController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const user = await authServices.login(email, password);
      return res.status(200).json({ data: user, success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async getInfoLocket(req, res, next) {
    try {
      const { idToken, localId } = req.user;
      const user = await authServices.getUserInfoV2(idToken, localId);
      return res.status(200).json({ data: user, success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async getLocketsCount(req, res, next) {
    try {
      const { idToken, localId } = req.user;
      const data = await postServices.getLocketsCount(idToken, localId);
      return res.status(200).json({ data, success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const user = await authServices.refreshIdToken(refreshToken);
      return res.status(200).json({ data: user, success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await authServices.logout();
      return res.status(200).json({ success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async getAllFriends(req, res, next) {
    try {
      const { idToken, localId } = req.user;

      const data = await friendServices.getAllFriends(idToken, localId);
      return res.status(200).json({ data: data, success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async getFriendProfiles(req, res, next) {
    try {
      const { idToken } = req.user;
      const uids = Array.isArray(req.body?.uids) ? req.body.uids : [];
      const normalizedUids = [...new Set(
        uids
          .map((uid) => String(uid || "").trim())
          .filter((uid) => uid && uid.length <= 160),
      )];

      if (!normalizedUids.length || normalizedUids.length > 100) {
        return res.status(400).json({
          success: false,
          code: "INVALID_FRIEND_UID_BATCH",
          message: "Danh sách UID bạn bè phải có từ 1 đến 100 phần tử.",
        });
      }

      const data = await friendServices.getFriendProfiles(idToken, normalizedUids);
      if (!data.users.length && data.failedUids.length) {
        const authFailed = data.failures?.some((failure) => failure.code === "FRIEND_PROFILE_AUTH_FAILED");
        const error = new Error(authFailed
          ? "Locket từ chối xác thực hồ sơ bạn bè. Kiểm tra phiên đăng nhập và App Check token tại /admin."
          : "Locket chưa trả về được hồ sơ bạn bè. Dữ liệu đã lưu vẫn được giữ; hãy thử tải lại.");
        error.code = authFailed ? "FRIEND_PROFILE_AUTH_FAILED" : "FRIEND_PROFILES_UNAVAILABLE";
        error.status = 502;
        throw error;
      }
      return res.status(200).json({ data, success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async getIncomingFriendRequests(req, res, next) {
    try {
      const { idToken, localId } = req.user;

      const data = await friendServices.getIncomingFriendRequests(idToken, localId);
      return res.status(200).json({ data: data, success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async getOutgoingFriendRequests(req, res, next) {
    try {
      const { idToken, localId } = req.user;

      const data = await friendServices.getOutgoingFriendRequests(idToken, localId);
      return res.status(200).json({ data: data, success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async deleteFriendRequests(req, res, next) {
    try {
      const { idToken, localId } = req.user;
      const data = await friendServices.deleteFriendRequests({
        idToken,
        userUid: localId,
        uids: req.body?.uids,
        direction: req.body?.direction || "incoming",
      });

      if (data.total > 0 && data.successCount === 0) {
        const upstreamStatus = data.failures[0]?.status;
        const error = new Error(
          upstreamStatus === 401 || upstreamStatus === 403
            ? "Locket từ chối phiên hoặc App Check khi xóa yêu cầu kết bạn."
            : "Locket chưa xóa được yêu cầu kết bạn.",
        );
        error.status = 502;
        error.code = "FRIEND_REQUEST_DELETE_FAILED";
        error.data = { upstreamStatus };
        throw error;
      }

      return res.status(200).json({ data, success: true, message: "ok" });
    } catch (error) {
      next(error);
    }
  }

  async getUserByUsername(req, res, next) {
    try {
      const { idToken } = req.user;
      const username = String(req.body?.username || req.body?.data?.username || "")
        .replace(/^@/, "")
        .trim();

      if (!username) {
        return res.status(400).json({
          data: null,
          success: false,
          message: "Thiếu username",
        });
      }

      const data = await friendServices.getUserByUsername(idToken, username);
      return res.status(200).json({
        data,
        success: Boolean(data),
        message: data ? "ok" : "Không tìm thấy người dùng",
      });
    } catch (error) {
      next(error);
    }
  }

  async sendFriendRequest(req, res, next) {
    try {
      const { idToken } = req.user;
      const friendUid = String(
        req.body?.friendUid || req.body?.data?.friendUid || "",
      ).trim();

      if (!friendUid) {
        return res.status(400).json({
          data: null,
          success: false,
          message: "Thiếu UID",
        });
      }

      const data = await friendServices.sendFriendRequest(idToken, friendUid);
      return res.status(200).json({
        data,
        success: true,
        message: "Đã gửi yêu cầu kết bạn",
      });
    } catch (error) {
      next(mapLocketAuthFailure(error));
    }
  }

  async resolveCelebrityProfile(req, res, next) {
    try {
      const { idToken } = req.user;
      const profile = String(
        req.body?.profile || req.body?.data?.profile || "",
      ).trim();

      if (!profile) {
        return res.status(400).json({
          data: null,
          success: false,
          message: "Thiếu link Celebrity",
        });
      }

      const data = await friendServices.getUserForInviteProfile(idToken, profile);
      return res.status(data ? 200 : 404).json({
        data,
        success: Boolean(data),
        message: data ? "ok" : "Không lấy được profile từ link Locket",
      });
    } catch (error) {
      next(error);
    }
  }

  async sendCelebrityRequest(req, res, next) {
    try {
      const { idToken } = req.user;
      const friendUid = String(
        req.body?.friendUid || req.body?.data?.friendUid || "",
      ).trim();
      const waitForSlot = Boolean(
        req.body?.waitForSlot || req.body?.data?.waitForSlot,
      );

      if (!friendUid) {
        return res.status(400).json({
          data: null,
          success: false,
          message: "Thiếu UID",
        });
      }

      // Celebrity accounts use Locket's follow flow for both available slots
      // and the waitlist. Locket decides the resulting relationship status.
      const data = await friendServices.sendFollowRequest(idToken, friendUid);
      const responseData = {
        ...(data && typeof data === "object" ? data : {}),
        friendship_status: waitForSlot
          ? "follower-waitlist"
          : "outgoing-follow-request",
      };

      return res.status(200).json({
        data: responseData,
        success: true,
        message: waitForSlot
          ? "Đã đăng ký chờ slot"
          : "Đã gửi yêu cầu kết bạn",
      });
    } catch (error) {
      next(mapLocketAuthFailure(error));
    }
  }

  async getMoments(req, res, next) {
    try {
      const { idToken, localId } = req.user;
      const { pageToken, timestamp, friendId, limit } = req.body;

      const data = await postServices.getLocketMoments(
        idToken,
        localId,
        pageToken || timestamp || null,  // pageToken
        friendId || null,   // filter by user
        limit || 20         // limit
      );
      return res
        .status(200)
        .json({
          data: data.moments,
          nextPageToken: data.nextPageToken,
          success: true,
          message: "ok",
        });
    } catch (error) {
      next(error);
    }
  }

  async getInfoMoment(req, res, next) {
    try {
      const { idToken, localId } = req.user;
      const { idMoment, momentId } = req.body;
      const targetMomentId = idMoment || momentId;

      if (!targetMomentId) {
        return res.status(400).json({
          data: null,
          success: false,
          message: "Missing moment id",
        });
      }

      const data = await postServices.getLocketMomentById(
        idToken,
        localId,
        targetMomentId,
      );

      return res.status(200).json({
        data: data || { id: targetMomentId, reactions: [] },
        success: true,
        message: "ok",
      });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req, res, next) {
    try {
      const { idToken, localId } = req.user;
      const { pageToken, timestamp, limit } = req.body || {};

      const data = await chatServices.getAllMessages(
        idToken,
        localId,
        pageToken || timestamp || null,
        Math.min(Math.max(Number(limit) || 20, 1), 100),
      );
      return res
        .status(200)
        .json({
          data: data?.messages,
          nextPageToken: data?.nextPageToken,
          success: true,
          message: "ok",
        });
    } catch (error) {
      next(error);
    }
  }

  async getMessagesWithUser(req, res, next) {
    try {
      const { idToken, localId } = req.user;
      const { otherUserId, messageId, pageToken, timestamp, limit } = req.body;

      const targetUserId = otherUserId || messageId;
      if (!targetUserId) {
        return res.status(400).json({ success: false, message: "otherUserId or messageId is required" });
      }

      const data = await chatServices.getMessagesWithUser(
        idToken,
        localId,
        messageId,
        pageToken || timestamp,
        Math.min(Math.max(Number(limit) || 50, 1), 100),
        otherUserId,
      );

      return res
        .status(200)
        .json({
          data: data?.messages,
          nextPageToken: data?.nextPageToken,
          success: true,
          message: "ok",
        });
    } catch (error) {
      next(error);
    }
  }

  async getRollcallPosts(req, res, next) {
    try {
      const { idToken } = req.user;
      const { week_of_year, year, source } = req.body;

      const data = await chatServices.getRollcallPosts(idToken, week_of_year, year, source);

      return res.status(200).json({
        data: data,
        success: true,
        message: "ok",
      });
    } catch (error) {
      next(error);
    }
  }

  async getRollcallMedia(req, res, next) {
    try {
      const media = await chatServices.getRollcallMedia(req.query?.url);
      res.setHeader("Content-Type", media.contentType);
      res.setHeader("Content-Length", String(media.buffer.length));
      res.setHeader("Cache-Control", "private, max-age=300");
      return res.status(200).send(media.buffer);
    } catch (error) {
      next(error);
    }
  }

  async uploadMedia(req, res, next) {
    try {
      const { userId, idToken, caption } = req.body;
      const { images, videos } = req.files;

      if (!images && !videos) {
        return res.status(400).json({
          message: "No media found",
        });
      }

      if (images && videos) {
        return res.status(400).json({
          message: "Only one type of media is allowed",
        });
      }

      if (images) {
        await postServices.postImageToLocket(
          userId,
          idToken,
          images[0],
          caption,
        );
      } else {
        if (videos[0].size > 10 * 1024 * 1024) {
          return res.status(400).json({
            message: "Video size exceeds 10MB",
          });
        }

        await postServices.postVideoToLocket(
          userId,
          idToken,
          videos[0],
          caption,
        );
      }

      return res.status(200).json({
        message: "Upload image successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  //Fuction post trực tiếp file lên
  async uploadMediaV1(req, res, next) {
    try {
      const { optionsData } = req.body;
      const { idToken, localId: userId } = req.user;

      const files = req.uploadedFiles;

      if (!files || files.length === 0) {
        return res.status(400).json({
          message: "No file uploaded",
        });
      }

      // phân loại media
      const images = files.filter((f) => f.mimetype.startsWith("image"));
      const videos = files.filter((f) => f.mimetype.startsWith("video"));

      // không cho upload cả 2 loại
      if (images.length && videos.length) {
        return res.status(400).json({
          message: "Only one type of media is allowed",
        });
      }
      let result;
      if (images.length) {
        const normalizedImage = await processServices.processImageBuffer({
          imageBuffer: images[0].buffer,
          maxSizeMB: 1,
          resolution: 2048,
        });
        result = await postServices.postImageToLocket({
          userId: userId,
          idToken: idToken,
          image: normalizedImage,
          optionsData: optionsData,
        });
      }

      if (videos.length) {
        if (videos[0].buffer.length > 10 * 1024 * 1024) {
          return res.status(400).json({
            message: "Video size exceeds 10MB",
          });
        }

        result = await postServices.postVideoToLocket({
          userId: userId,
          idToken: idToken,
          video: videos[0].buffer || { path: videos[0].path },
          optionsData: optionsData,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Upload media successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  //Function upload với thông tin media là url
  async uploadMediaV2(req, res, next) {
    let mediaPath;

    try {
      const { options, optionsData: optionsDataRaw, mediaInfo } = req.body;

      const optionsData = options ?? optionsDataRaw;
      const { idToken, localId } = req.user;

      const r2Metadata = mediaInfo?.metadata || {};
      const type = mediaInfo?.type || r2Metadata.type;
      const publicUrl =
        mediaInfo?.publicUrl ||
        mediaInfo?.publicURL ||
        mediaInfo?.url ||
        mediaInfo?.downloadURL;
      const path = mediaInfo?.path || r2Metadata.path;
      const name = mediaInfo?.name || r2Metadata.name;
      const size = mediaInfo?.size || r2Metadata.size;

      if (!publicUrl || !path) {
        return res.status(400).json({
          success: false,
          message: "Thiếu thông tin file R2 (publicUrl hoặc path)",
        });
      }

      const sizeInMB = size / (1024 * 1024);
      if (sizeInMB > MAX_SIZE_MB_UPLOAD) {
        logWarning("uploadMediaV2", "🚫 Upload bị từ chối do vượt giới hạn");
        return res.status(400).json({
          success: false,
          message: "File quá lớn",
        });
      }

      logTable("uploadMediaV2", {
        type,
        name,
        size: formatFileSize(size),
      });

      logLoading("uploadMediaV2", "Downloading media from R2");

      const media = await processServices.downloadMediaOnStorage(
        publicUrl,
        type,
        name,
        { expectedSize: size },
      );

      if (!media) {
        logWarning("uploadMediaV2", "Failed to download media buffer");
        return res.status(404).json({
          message: "Không thể tải media từ URL!",
        });
      }

      const mediaBuffer = media.buffer;
      mediaPath = media.path;

      let processedBuffer;
      let thumbBuffer;
      let debugVideoAudio = null;
      let result;

      if (type === "image") {
        console.log("🖼️ Processing image...");
        processedBuffer = await processServices.processImageBuffer({
          imageBuffer: mediaBuffer,
          maxSizeMB: 1,
          resolution: 2048,
        });

        let postOptionsData = optionsData;
        if (processServices.CUSTOM_CAPTION_TYPES.has(optionsData?.type)) {
          processedBuffer = await processServices.renderCaptionOverlayOnImage({
            imageBuffer: processedBuffer,
            optionsData,
          });
          postOptionsData = {
            ...optionsData,
            type: "default",
            caption: "",
            icon: null,
            background: { colors: [] },
          };
        }

        console.log("🚀 Calling postImageToLocketV2...");
        result = await postServices.postImageToLocketV2({
          userId: localId,
          idToken,
          imageBuffer: processedBuffer,
          optionsData: postOptionsData,
        });
        console.log("✅ postImageToLocketV2 completed successfully");
      } else if (type === "video") {
        console.log("🎬 Processing video...");
        processedBuffer = await processServices.processVideoBuffer({
          videoBuffer: mediaBuffer,
          filename: name,
          maxSizeMB: MAX_VIDEO_SIZE_MB_AFTER_COMPRESS,
        });

        const processedSizeMB = processedBuffer.length / (1024 * 1024);
        if (processedSizeMB > MAX_VIDEO_SIZE_MB_AFTER_COMPRESS) {
          const limitError = new Error(
            `Video vượt quá dung lượng. Tối đa ${MAX_VIDEO_SIZE_MB_AFTER_COMPRESS}MB sau khi nén.`,
          );
          limitError.status = 413;
          limitError.code = "VIDEO_SIZE_LIMIT_EXCEEDED";
          limitError.data = {
            maxSizeMB: MAX_VIDEO_SIZE_MB_AFTER_COMPRESS,
            finalSizeMB: Number(processedSizeMB.toFixed(2)),
          };
          throw limitError;
        }

        debugVideoAudio = await processServices
          .probeVideoBuffer(processedBuffer, name)
          .catch((error) => ({
            hasAudio: false,
            error: error.message,
          }));

        try {
          thumbBuffer = await processServices.generateThumbnail(
            processedBuffer,
            localId,
          );
        } catch (thumbError) {
          console.warn("⚠️ generateThumbnail failed, creating fallback thumbnail with sharp:", thumbError.message);
          const sharp = require("sharp");
          thumbBuffer = await sharp({
            create: {
              width: 500,
              height: 500,
              channels: 3,
              background: { r: 18, g: 18, b: 18 },
            },
          }).webp({ quality: 80 }).toBuffer();
        }

        console.log("🚀 Calling postVideoToLocketV2...");
        result = await postServices.postVideoToLocketV2({
          userId: localId,
          idToken,
          videoBuffer: processedBuffer,
          thumbBuffer,
          optionsData,
        });
        console.log("✅ postVideoToLocketV2 completed successfully");
      }

      // mediaPath is the API's temp file. R2 deletion must use the object key.
      await processServices.deleteFileFromStorageR2(path).catch(() => {});

      logInfo("uploadMediaV2", "End - Success");

      const uploadData = getLocketUploadData(result);

      return res.status(200).json({
        success: true,
        message: "Upload media successfully",
        data: uploadData,
        debug_overlay:
          uploadData?.overlays?.[0] ||
          result?.result?.data?.overlays?.[0] ||
          result?.data?.overlays?.[0] ||
          null,
        debug_video_audio: debugVideoAudio,
      });
    } catch (error) {
      console.error("❌ uploadMediaV2 Error:", {
        message: error.message,
        code: error.code,
        status: error.status || error.response?.status,
        ...(process.env.NODE_ENV !== "production" ? { stack: error.stack } : {}),
      });
      next(error);
    } finally {
      // cleanup an toàn
      if (mediaPath) {
        try {
          deleteTempFile(mediaPath);
        } catch {}
      }
    }
  }
}

module.exports = new LocketController();
