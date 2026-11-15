import { getToken } from "@/utils";
import { uploadFileAndGetInfoR2 } from "./StorageServices";
import { useStreakStore } from "@/stores";
import { SonnerWarning } from "@/components/ui/SonnerToast";

// CDN base URL for caption icons
const CDN_BASE_URL = "https://cdn.locket-dio.com/v1/caption/caption-icon";

// Special icon mappings (for non-standard icons)
const SPECIAL_ICON_MAPPINGS = {
  "Aries": "https://storage.googleapis.com/locket-public/overlays/star_signs/Aries.png",
  "Aries.png": "https://storage.googleapis.com/locket-public/overlays/star_signs/Aries.png",
};

// Convert local icon path to CDN URL
const convertIconToCdn = (iconPath) => {
  if (!iconPath || typeof iconPath !== 'string') return iconPath;

  // Already a full URL - return as is
  if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
    return iconPath;
  }

  // Local path like /caption-icon/locket_gold_badge.png
  if (iconPath.includes('/caption-icon/')) {
    const filename = iconPath.split('/caption-icon/').pop();
    const iconName = filename?.replace('.png', '').replace('.gif', '');

    // Check special mappings first
    if (SPECIAL_ICON_MAPPINGS[iconName]) {
      return SPECIAL_ICON_MAPPINGS[iconName];
    }

    // Default CDN URL
    return `${CDN_BASE_URL}/${filename}`;
  }

  // Just icon name without path (e.g., "locket_gold_badge")
  if (!iconPath.includes('/') && !iconPath.includes('.')) {
    if (SPECIAL_ICON_MAPPINGS[iconPath]) {
      return SPECIAL_ICON_MAPPINGS[iconPath];
    }
    return `${CDN_BASE_URL}/${iconPath}.png`;
  }

  return iconPath;
};

// Format icon for API request
const formatIconForApi = (icon) => {
  if (!icon) return null;

  // Already formatted object
  if (icon && typeof icon === 'object' && icon.type && icon.data) {
    // Convert local path in data to CDN
    if (icon.type === 'image') {
      return { type: 'image', data: convertIconToCdn(icon.data), source: 'url' };
    }
    return icon;
  }

  // String - check if URL/path or emoji
  if (typeof icon === 'string' && icon.trim()) {
    const trimmed = icon.trim();

    // URL or local path
    if (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.includes('/')) {
      const cdnUrl = convertIconToCdn(trimmed);
      return { type: 'image', data: cdnUrl, source: 'url' };
    }

    // Icon name (like "locket_gold_badge")
    if (trimmed.match(/^[a-zA-Z0-9_-]+$/)) {
      const cdnUrl = convertIconToCdn(trimmed);
      return { type: 'image', data: cdnUrl, source: 'url' };
    }

    // Emoji
    return { type: 'emoji', data: trimmed };
  }

  return null;
};

// Hàm con xác định recipients
const determineRecipients = (audience, selectedRecipients, localId) => {
  if (audience === "selected") return selectedRecipients || [];
  if (audience === "private") return localId ? [localId] : [];
  // Trường hợp public hoặc khác trả về mảng rỗng
  return [];
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
      url: fileInfo.downloadURL,
      path: fileInfo.metadata.path, // đường dẫn đầy đủ trong Storage
      name: fileInfo.metadata.name, // tên file
      size: fileInfo.metadata.size, // kích thước file (bytes)
      uploadedAt: fileInfo.metadata.uploadedAt, // thời gian tạo
      type: previewType,
    };

    // Chuẩn bị dữ liệu tùy chọn (caption, overlay, v.v.)

    // Ensure background is always { colors: [...] }
    let backgroundData = undefined;
    if (Array.isArray(postOverlay.background) && postOverlay.background.length > 0) {
      backgroundData = { colors: postOverlay.background.filter(c => c && typeof c === 'string') };
    } else if (postOverlay.background && typeof postOverlay.background === 'object' && Array.isArray(postOverlay.background.colors)) {
      backgroundData = { colors: postOverlay.background.colors.filter(c => c && typeof c === 'string') };
    } else if (postOverlay.color_top || postOverlay.color_bottom) {
      backgroundData = { colors: [postOverlay.color_top, postOverlay.color_bottom].filter(c => c && typeof c === 'string' && c.trim()) };
    }

    // Ensure icon is properly formatted for API (emoji or image URL)
    const iconObj = formatIconForApi(postOverlay.icon);

    const caption = {
      icon: iconObj,
      background: backgroundData,
      text: postOverlay.caption || postOverlay.text || "",
      text_color: postOverlay.text_color,
      type: postOverlay.type,
      max_lines: typeof postOverlay.max_lines === 'number' ? postOverlay.max_lines : 1,
      payload: postOverlay.payload || {},
      caption: postOverlay.caption || postOverlay.text || "",
      color_top: postOverlay.color_top || "",
      color_bottom: postOverlay.color_bottom || "",
      active: typeof postOverlay.active === 'boolean' ? postOverlay.active : true,
      effect: postOverlay.effect || null,
    };

    const optionsData = {
      type: postOverlay.type || "default", // caption type: template, default, decorative, etc.
      overlay_id: postOverlay.overlay_id,
      source: postOverlay.source || "remote",
      order_id: typeof postOverlay.order_id === 'number' ? postOverlay.order_id : 0,
      is_editable: typeof postOverlay.is_editable === 'boolean' ? postOverlay.is_editable : false,
      daily_end_hour: postOverlay.daily_end_hour || null,
      daily_start_hour: postOverlay.daily_start_hour || null,
      audience,
      recipients: determineRecipients(audience, selectedRecipients, localId),
      isStreaktoday: isStreakToday,
      // Flatten caption fields to top level (backend expects this format)
      caption: caption.text || caption.caption || "",
      text_color: caption.text_color,
      icon: caption.icon,
      background: caption.background,
      color_top: caption.color_top || "",
      color_bottom: caption.color_bottom || "",
    };

    // Tạo payload cuối cùng
    const payload = {
      model: "Version-UploadmediaV3.1",
      mediaInfo,
      contentType: previewType,
      optionsData,
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
      url: fileInfo.downloadURL,
      path: fileInfo.metadata.path, // đường dẫn đầy đủ trong Storage
      name: fileInfo.metadata.name, // tên file
      size: fileInfo.metadata.size, // kích thước file (bytes)
      uploadedAt: fileInfo.metadata.uploadedAt, // thời gian tạo
      type: previewType,
    };

    // Chuẩn bị dữ liệu tùy chọn (caption, overlay, v.v.)
    // Ensure background is properly formatted
    const backgroundData = Array.isArray(postOverlay.background) && postOverlay.background.length > 0
      ? { colors: postOverlay.background.filter(c => c && typeof c === 'string') }
      : postOverlay.background && typeof postOverlay.background === 'object'
      ? postOverlay.background
      : undefined;

    // Ensure icon is properly formatted for API
    const iconData = formatIconForApi(postOverlay.icon);

    const optionsData = {
      caption: postOverlay.caption,
      overlay_id: postOverlay.overlay_id,
      type: postOverlay.type,
      icon: iconData,
      text_color: postOverlay.text_color,
      color_top: postOverlay.color_top,
      color_bottom: postOverlay.color_bottom,
      background: backgroundData,
      audience, // Gắn audience vào options luôn
      recipients: determineRecipients(audience, selectedRecipients, localId),
      music: postOverlay?.music || "",
    };

    // Chỉ thêm restoreStreakDate nếu mode là "restore"
    if (restoreStreak?.mode === "restore") {
      optionsData.restoreStreakDate = restoreStreak;
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
