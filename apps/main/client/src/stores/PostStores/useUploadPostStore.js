import { create } from "zustand";
import {
  SonnerError,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import { PostMoments } from "@/services";
import { normalizeMoment, toDisplayMessage } from "@/utils";
import { stripLeadingIcon } from "@/utils/captionIcon";
import { useStreakStore } from "@/stores";
import { formatRestoreDate } from "@/utils/streakRestoreFlow";
import { assertJsonSerializable } from "@/utils/standardize/jsonSerializable";
import { usePostStore } from "./usePostStore";
import { v4 as uuidv4 } from "uuid";
import {
  UPLOAD_QUEUE_ERROR,
  UPLOAD_RETRY_MODE,
  classifyUploadFailure,
  shouldAutoRetryUpload,
  shouldResumeAfterReconnect,
  uploadRetryRemainingMs,
  uploadRetryDelayMs,
} from "./uploadQueuePolicy";

const queueSessionId = uuidv4();
const wait = (delayMs) =>
  new Promise((resolve) => window.setTimeout(resolve, delayMs));

const getCalendarCreatedAt = (item = {}) => {
  const value = String(Number(item?.restoreFlow?.selectedDate) || "");
  if (!/^\d{8}$/.test(value)) return new Date().toISOString();

  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T12:00:00.000Z`;
};

const normalizeQueuedR2MediaInfo = (mediaInfo = {}) => {
  const metadata = mediaInfo.metadata || {};

  return {
    ...mediaInfo,
    publicUrl:
      mediaInfo.publicUrl || mediaInfo.url || mediaInfo.downloadURL,
    path: mediaInfo.path || metadata.path,
    name: mediaInfo.name || metadata.name,
    size: mediaInfo.size || metadata.size,
    uploadedAt: mediaInfo.uploadedAt || metadata.uploadedAt,
  };
};

import {
  saveUploadItemToDB,
  updateUploadItemInDB,
  deleteUploadItemFromDB,
  getUploadItemFromDB,
  loadUploadItemsByStatus,
  loadAllUploadItems,
  getPostedMoments,
  savePostedMomentToDB,
} from "../../cache/uploadMomentDB";

export const STATUS_UPLOAD_MOMENT = {
  QUEUED: "queued",
  UPLOADING: "uploading",
  DONE: "done",
  FAILED: "failed",
};

export const useUploadQueueStore = create((set, get) => ({
  uploadItems: [],
  postedMoments: [],
  isQueueRunning: false,

  /* ================= INIT / LOAD ================= */

  hydrateUploadQueue: async () => {
    const items = await loadAllUploadItems();

    // sort mới → cũ cho UI
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    set({ uploadItems: items });

    const posted = await getPostedMoments();
    set({ postedMoments: posted });

    get().autoCleanupItem();
    // nếu còn queued thì chạy tiếp
    // if (items.some((i) => i.status === STATUS_UPLOAD_MOMENT.QUEUED)) {
    //   get().runQueue();
    // }
  },

  enqueueUploadItem: async (data) => {
    // IndexedDB can preserve cyclic structured-clone values. Keep the queue
    // JSON-only so a restored item never crashes Axios serialization later.
    const serializableData = assertJsonSerializable(data || {});
    const item = {
      ...serializableData,
      clientUploadId: serializableData?.clientUploadId || uuidv4(),
      queueSessionId,
      queueRetryMode: UPLOAD_RETRY_MODE.AUTO,
      retryCount: 0,
      status: STATUS_UPLOAD_MOMENT.QUEUED,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({ uploadItems: [item, ...s.uploadItems] }));
    await saveUploadItemToDB(item);
    get().runQueue();
  },

  retryUploadItem: async (itemId) => {
    const item = await getUploadItemFromDB(itemId);
    const remainingMs = uploadRetryRemainingMs(item);
    if (remainingMs > 0) {
      SonnerWarning(
        "Chưa thể thử lại",
        `Vui lòng chờ ${Math.ceil(remainingMs / 1000)} giây.`,
      );
      return false;
    }
    if (item?.restoreFlow?.selectedDate) {
      usePostStore
        .getState()
        .markRestoreFlowPending(item.restoreFlow.selectedDate);
    }
    await get().updateUploadItem(itemId, {
      status: STATUS_UPLOAD_MOMENT.QUEUED,
      queueSessionId,
      queueRetryMode: UPLOAD_RETRY_MODE.MANUAL,
      retryCount: 0,
      errorCode: null,
      errorMessage: null,
      nextRetryAt: null,
      retryAfterMs: null,
      lastTried: new Date().toISOString(),
    });
    get().runQueue();
    return true;
  },

  resumeRecoverableUploads: async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const items = await loadAllUploadItems();
    const recoverable = items.filter(
      (item) =>
        item.status === STATUS_UPLOAD_MOMENT.FAILED &&
        shouldResumeAfterReconnect(item, queueSessionId),
    );

    await Promise.all(
      recoverable.map((item) =>
        get().updateUploadItem(item.id, {
          status: STATUS_UPLOAD_MOMENT.QUEUED,
          queueRetryMode: UPLOAD_RETRY_MODE.AUTO,
          errorMessage: null,
        }),
      ),
    );

    if (recoverable.length) get().runQueue();
  },

  /* ================= WORKER ================= */

  runQueue: async () => {
    if (get().isQueueRunning) return;
    set({ isQueueRunning: true });

    try {
      let item;
      while (
        (item = (await loadUploadItemsByStatus(STATUS_UPLOAD_MOMENT.QUEUED))[0])
      ) {
        await get().uploadSingleItem(item);
      }
    } finally {
      set({ isQueueRunning: false });
    }
  },

  uploadSingleItem: async (item) => {
    const restoreDate = Number(item?.restoreFlow?.selectedDate) || null;
    if (restoreDate) {
      usePostStore.getState().markRestoreFlowPending(restoreDate);
    }

    await get().updateUploadItem(item.id, {
      status: STATUS_UPLOAD_MOMENT.UPLOADING,
      lastTried: new Date().toISOString(),
    });

    try {
      // Payload cũ trong hàng đợi (IndexedDB) có thể mang caption đã nhiễm icon
      // từ trước khi fix — khử tại đây để không gửi icon đôi lên Locket.
      // Chỉ làm sạch giá trị chuỗi, cấu trúc payload giữ nguyên.
      // Sanitize again to repair legacy queue rows already stored by an older
      // build. This is deliberately done before Axios receives the payload.
      const serializableItem = assertJsonSerializable(item || {});
      const normalizedItem = {
        ...serializableItem,
        mediaInfo: normalizeQueuedR2MediaInfo(serializableItem.mediaInfo),
      };

      const cleanItem =
        typeof serializableItem?.options?.caption === "string" &&
        serializableItem?.options?.icon
          ? {
              ...normalizedItem,
              options: {
                ...serializableItem.options,
                caption: stripLeadingIcon(
                  serializableItem.options.caption,
                  serializableItem.options.icon,
                ),
              },
            }
          : normalizedItem;

      const res = await PostMoments(cleanItem);
      const normalized = normalizeMoment(res?.data);
      // ❗ Validate response
      if (!normalized || !normalized.id) {
        throw new Error("INVALID_UPLOAD_RESPONSE");
      }
      await get().savePostedMoment(item, normalized);

      await get().updateUploadItem(item.id, {
        status: STATUS_UPLOAD_MOMENT.DONE,
      });

      if (restoreDate) {
        usePostStore.getState().markRestoreFlowConfirmed(restoreDate);
        SonnerSuccess(
          item.restoreFlow.mode === "restore"
            ? "Khôi phục thành công!"
            : "Đăng moment thành công!",
          `${formatRestoreDate(restoreDate)} đã được Locket xác nhận.`,
        );
        await useStreakStore.getState().fetchStreak();
      } else {
        SonnerSuccess(
          "Đăng tải thành công!",
          `${
            item.contentType === "video" ? "Video" : "Hình ảnh"
          } đã được tải lên!`,
        );
        useStreakStore.getState().fetchStreakIfNeeded();
      }
      useStreakStore.getState().fetchLocketCount();

      get().autoCleanupItem(item.id);
    } catch (err) {
      // ⚠️ Bài đăng đã tồn tại
      const conflictCode = String(
        err?.response?.data?.code || err?.response?.data?.error?.code || "",
      );
      if (
        err?.response?.status === 409 &&
        !conflictCode.startsWith("R2_")
      ) {
        await get().updateUploadItem(item.id, {
          status: STATUS_UPLOAD_MOMENT.DONE,
        });

        await deleteUploadItemFromDB(item.id);
        SonnerWarning("Bài đăng đã tồn tại!");
        if (restoreDate) {
          usePostStore
            .getState()
            .markRestoreFlowFailed(
              restoreDate,
              "Bài đăng đã tồn tại nhưng chưa xác nhận khôi phục chuỗi.",
            );
        }
        return;
      }

      const online =
        typeof navigator === "undefined" ? true : navigator.onLine;
      const policy = classifyUploadFailure(err, { online });
      const retryCount = Number(item.retryCount || 0);

      if (shouldAutoRetryUpload(item, policy, retryCount)) {
        const delayMs = uploadRetryDelayMs(retryCount, policy);
        await get().updateUploadItem(item.id, {
          status: STATUS_UPLOAD_MOMENT.QUEUED,
          retryCount: retryCount + 1,
          errorCode: policy.code,
          retryAfterMs: delayMs,
          nextRetryAt: Date.now() + delayMs,
          lastTried: new Date().toISOString(),
        });
        await wait(delayMs);
        await get().updateUploadItem(item.id, {
          status: STATUS_UPLOAD_MOMENT.QUEUED,
          nextRetryAt: null,
        });
        return;
      }

      const uploadErrorMessage = toDisplayMessage(
        err?.response?.data?.message || err?.response?.data || err?.message || err,
        "Đăng tải thất bại, vui lòng thử lại",
      );

      const finalMessage =
        policy.code === UPLOAD_QUEUE_ERROR.OFFLINE
          ? "Mất kết nối mạng. Hàng đợi sẽ tự tiếp tục khi có mạng."
          : policy.code === UPLOAD_QUEUE_ERROR.MEDIA_EXPIRED
            ? "File R2 không tồn tại hoặc đã hết hạn."
            : policy.code === UPLOAD_QUEUE_ERROR.INVALID_RESPONSE
              ? "Locket chưa xác nhận moment, hệ thống đã dừng để tránh đăng trùng."
              : uploadErrorMessage;

      SonnerError("Đăng tải thất bại!", finalMessage);

      await get().updateUploadItem(item.id, {
        status: STATUS_UPLOAD_MOMENT.FAILED,
        errorCode: policy.code,
        errorMessage: finalMessage,
        retryAfterMs: policy.retryAfterMs || null,
        nextRetryAt: policy.retryAfterMs
          ? Date.now() + policy.retryAfterMs
          : null,
      });

      if (restoreDate) {
        usePostStore
          .getState()
          .markRestoreFlowFailed(restoreDate, finalMessage);
      }
    }
  },

  removeUploadItemById: async (id) => {
    if (!id) return;

    // xoá DB trước
    await deleteUploadItemFromDB(id);

    // xoá store
    set((state) => ({
      uploadItems: state.uploadItems.filter((item) => item.id !== id),
    }));
    return true;
  },
  /* ================= CLEANUP ================= */

  autoCleanupItem: (itemId, delay = 3000) => {
    setTimeout(async () => {
      if (!itemId) return;
      const item = await getUploadItemFromDB(itemId);
      if (item?.status === STATUS_UPLOAD_MOMENT.DONE) {
        get().removeUploadItemById(itemId);
      }
    }, delay);
  },

  updateUploadItemInState: (id, patch) => {
    if (!id) return;

    set((state) => ({
      uploadItems: state.uploadItems.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  },

  updateUploadItem: async (id, patch) => {
    await updateUploadItemInDB(id, patch);
    get().updateUploadItemInState(id, patch);
  },

  savePostedMoment: async (payload, posted) => {
    try {
      const postedWithCalendarDate = {
        ...posted,
        createdAt: getCalendarCreatedAt(payload),
        ...(payload?.restoreFlow?.selectedDate
          ? { restoreDate: Number(payload.restoreFlow.selectedDate) }
          : {}),
      };
      await savePostedMomentToDB(payload, postedWithCalendarDate);

      set((state) => ({
        postedMoments: [
          {
            postId: postedWithCalendarDate.id,
            contentType: payload.contentType,
            ...postedWithCalendarDate,
          },
          ...state.postedMoments,
        ],
      }));
    } catch (err) {
      console.error("❌ Failed to save posted moment:", err);
    }
  },
}));
