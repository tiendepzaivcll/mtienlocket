import { getToken } from "@/utils";
import { stripLeadingIcon } from "@/utils/captionIcon";
import { uploadFileAndGetInfoR2 } from "./StorageServices";
import { useStreakStore } from "@/stores";
import { SonnerWarning } from "@/components/ui/SonnerToast";

// Hàm con xác định recipients
const determineRecipients = (audience, selectedRecipients, localId) => {
  if (audience === "selected") return selectedRecipients || [];
  if (audience === "private") return localId ? [localId] : [];
  // Trường hợp public hoặc khác trả về mảng rỗng
  return [];
};

const isBrowserObject = (value) => {
  if (!value || typeof value !== "object") return false;

  if (typeof Window !== "undefined" && value instanceof Window) return true;
  if (typeof Document !== "undefined" && value instanceof Document) return true;
  if (typeof Element !== "undefined" && value instanceof Element) return true;
  if (typeof Event !== "undefined" && value instanceof Event) return true;

  return false;
};

const toJsonSafeValue = (value, seen = new WeakSet()) => {
  if (value === null) return null;

  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return value;
  }
  if (valueType === "undefined" || valueType === "function" || valueType === "symbol") {
    return undefined;
  }
  if (value instanceof Date) return value.toISOString();
  if (isBrowserObject(value)) return undefined;
  if (seen.has(value)) return undefined;

  seen.add(value);

  if (Array.isArray(value)) {
    const safeArray = value
      .map((item) => toJsonSafeValue(item, seen))
      .filter((item) => item !== undefined);
    seen.delete(value);
    return safeArray;
  }

  const safeObject = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      key === "window" ||
      key === "self" ||
      key === "top" ||
      key === "parent" ||
      key === "opener" ||
      key === "document" ||
      key === "location" ||
      key === "navigator" ||
      key === "nativeEvent" ||
      key === "target" ||
      key === "currentTarget" ||
      key === "view"
    ) {
      continue;
    }

    const safeItem = toJsonSafeValue(item, seen);
    if (safeItem !== undefined) {
      safeObject[key] = safeItem;
    }
  }

  seen.delete(value);
  return safeObject;
};

const toCleanString = (value) => {
  if (typeof value === "string") return value.replace(/^\[object.*\]$/i, "");
  if (value === null || value === undefined || isBrowserObject(value)) return "";

  const safeValue = toJsonSafeValue(value);
  if (typeof safeValue === "string") return safeValue.replace(/^\[object.*\]$/i, "");
  if (safeValue && typeof safeValue === "object") {
    return "";
  }

  return String(safeValue ?? "").replace(/^\[object.*\]$/i, "");
};

const buildOptionsData = (
  postOverlay,
  audience,
  selectedRecipients,
  localId,
  extraOptions = {},
) => {
  const safeOverlay = toJsonSafeValue(postOverlay || {}) || {};

  return {
    // Locket nhận icon và caption ở 2 trường riêng rồi tự ghép khi hiển thị —
    // caption tuyệt đối không được chứa sẵn icon ở đầu, nếu không icon sẽ bị nhân đôi
    caption:
      safeOverlay.type === "weather" && safeOverlay.caption && typeof safeOverlay.caption === "object"
        ? safeOverlay.caption
        : stripLeadingIcon(toCleanString(safeOverlay.caption), safeOverlay.icon),
    overlay_id: toCleanString(safeOverlay.overlay_id),
    type: toCleanString(safeOverlay.type),
    icon: toJsonSafeValue(safeOverlay.icon) ?? "",
    text_color: toCleanString(safeOverlay.text_color),
    color_top: toCleanString(safeOverlay.color_top),
    color_bottom: toCleanString(safeOverlay.color_bottom),
    background: toJsonSafeValue(safeOverlay.background) ?? [],
    max_lines: toJsonSafeValue(safeOverlay.max_lines),
    is_editable: toJsonSafeValue(safeOverlay.is_editable),
    audience,
    recipients: toJsonSafeValue(determineRecipients(audience, selectedRecipients, localId)) ?? [],
    music: toJsonSafeValue(safeOverlay.music) ?? "",
    payload: toJsonSafeValue(safeOverlay.payload) ?? {},
    ...toJsonSafeValue(extraOptions),
  };
};

//Bản chính mới nhất
export const createRequestPayloadV5 = async (
  selectedFile,
  previewType,
  postOverlay,
  audience,
  selectedRecipients
) => {
  try {
    const { localId } = getToken() || {};
    const isStreakToday = useStreakStore.getState().isStreakUpdatedToday();

    if (!localId) {
      SonnerWarning("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      return null;
    }
    // Upload file & chuẩn bị thông tin media
    const fileInfo = await uploadFileAndGetInfoR2(
      selectedFile,
      previewType,
      localId
    );
    // console.log(fileInfo);

    const mediaInfo = {
      ...fileInfo,
      type: previewType,
    };

    const optionsData = buildOptionsData(
      postOverlay,
      audience,
      selectedRecipients,
      localId,
      { isStreaktoday: isStreakToday },
    );

    // Tạo payload cuối cùng
    const payload = {
      // userData: { idToken: idToken, localId },
      options: optionsData,
      model: "Version-UploadmediaV3.1",
      mediaInfo,
      contentType: previewType,
    };

    return payload;
  } catch (error) {
    console.error("Lỗi khi tạo payload:", error);
    throw error;
  }
};

export const createRequestPayloadV4 = async (
  selectedFile,
  previewType,
  postOverlay,
  restoreStreak,
  audience,
  selectedRecipients
) => {
  try {
    const { localId } = getToken() || {};

    if (!localId) {
      SonnerWarning("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      return null;
    }
    // Upload file & chuẩn bị thông tin media
    const fileInfo = await uploadFileAndGetInfoR2(
      selectedFile,
      previewType,
      localId
    );
    // console.log(fileInfo);

    const mediaInfo = {
      ...fileInfo,
      type: previewType,
    };

    const resolvedAudience = audience || "all";
    const optionsData = buildOptionsData(
      postOverlay,
      resolvedAudience,
      selectedRecipients,
      localId,
    );

    if (
      restoreStreak?.data &&
      (restoreStreak.mode === "restore" || restoreStreak.mode === "continue")
    ) {
      optionsData.restoreStreakDate = restoreStreak;
      optionsData.restoreStreakData = restoreStreak;
    }

    // Tạo payload cuối cùng
    const payload = {
      // userData: { idToken: idToken, localId },
      options: optionsData,
      model: "Version-UploadmediaV3.1",
      mediaInfo,
      contentType: previewType,
    };

    return payload;
  } catch (error) {
    console.error("Lỗi khi tạo payload:", error);
    throw error;
  }
};
