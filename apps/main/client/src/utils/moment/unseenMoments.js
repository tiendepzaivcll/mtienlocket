/**
 * Logic tính toán và xác định ảnh chưa xem (unseen count badge)
 * Chuẩn hành vi Locket gốc:
 * 1. Chỉ tính ảnh do NGƯỜI KHÁC gửi (photo.senderId !== currentUser.uid).
 *    Tuyệt đối không đếm ảnh do chính user hiện tại chụp/đăng.
 * 2. Chỉ tính ảnh mà user hiện tại CHƯA XEM:
 *    - Không nằm trong viewedIds (bộ nhớ tạm / local cache đã xem)
 *    - Không nằm trong mảng photo.seenBy (chưa chứa currentUser.uid)
 *    - Nếu có user.lastSeenHistoryAt: photo.createdAt > user.lastSeenHistoryAt
 */

const finiteNumber = (value) => {
  const resolved = value && typeof value === "object" ? value.value : value;
  const number = Number(resolved);
  return Number.isFinite(number) ? number : null;
};

/**
 * Trích xuất UID người gửi từ photo/moment
 */
export function getPhotoSenderId(photo) {
  if (!photo || typeof photo !== "object") return null;

  const sender =
    photo.senderId ||
    photo.sender_id ||
    photo.userUid ||
    photo.user_uid ||
    photo.userId ||
    photo.user_id ||
    photo.user ||
    photo.owner ||
    photo.sender ||
    null;

  if (sender && typeof sender === "object") {
    const rawUid = sender.uid || sender.localId || sender.id || null;
    return typeof rawUid === "string" ? rawUid.trim() : null;
  }

  return typeof sender === "string" && sender.trim() ? sender.trim() : null;
}

/**
 * Chuẩn hóa timestamp bất kỳ về số nguyên milliseconds
 */
export function getPhotoTimestamp(photo) {
  if (!photo) return 0;

  const value =
    photo.createdAt ||
    photo.created_at ||
    photo.createTime ||
    photo.create_time ||
    photo.date ||
    photo.timestamp;

  if (!value) return 0;

  if (typeof value === "number") {
    return value > 0 && value < 1e12 ? value * 1000 : Math.floor(value);
  }

  if (typeof value?.toMillis === "function") {
    try {
      return finiteNumber(value.toMillis()) || 0;
    } catch {
      return 0;
    }
  }

  const seconds = finiteNumber(value._seconds ?? value.seconds);
  if (seconds !== null) {
    const nanoseconds =
      finiteNumber(value._nanoseconds ?? value.nanoseconds) || 0;
    return seconds * 1000 + Math.floor(nanoseconds / 1e6);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      return num > 0 && num < 1e12 ? num * 1000 : Math.floor(num);
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

/**
 * Trích xuất timestamp (ms) của user.lastSeenHistoryAt
 */
export function getUserLastSeenHistoryTime(userOrTimestamp) {
  if (!userOrTimestamp) return 0;

  if (typeof userOrTimestamp === "number") {
    return userOrTimestamp > 0 && userOrTimestamp < 1e12
      ? userOrTimestamp * 1000
      : Math.floor(userOrTimestamp);
  }

  if (typeof userOrTimestamp === "string") {
    const trimmed = userOrTimestamp.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      return num > 0 && num < 1e12 ? num * 1000 : Math.floor(num);
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (typeof userOrTimestamp === "object") {
    const val =
      userOrTimestamp.lastSeenHistoryAt ||
      userOrTimestamp.last_seen_history_at ||
      userOrTimestamp.lastSeenAt ||
      userOrTimestamp.lastSeen ||
      userOrTimestamp;

    if (val !== userOrTimestamp) {
      return getUserLastSeenHistoryTime(val);
    }

    if (typeof val?.toMillis === "function") {
      try {
        return finiteNumber(val.toMillis()) || 0;
      } catch {
        return 0;
      }
    }

    const seconds = finiteNumber(val._seconds ?? val.seconds);
    if (seconds !== null) {
      const nanoseconds =
        finiteNumber(val._nanoseconds ?? val.nanoseconds) || 0;
      return seconds * 1000 + Math.floor(nanoseconds / 1e6);
    }
  }

  return 0;
}

/**
 * Kiểm tra xem currentUser.uid đã nằm trong mảng seenBy / views của photo chưa
 */
export function hasUserSeenPhotoInArray(photo, currentUserId) {
  if (!photo || !currentUserId) return false;

  const seenList =
    photo.seenBy ||
    photo.seen_by ||
    photo.views ||
    photo.viewedBy ||
    photo.viewed_by;

  if (!Array.isArray(seenList) || seenList.length === 0) return false;

  const targetUid = String(currentUserId).trim();

  return seenList.some((item) => {
    if (typeof item === "string") {
      return item.trim() === targetUid;
    }
    if (item && typeof item === "object") {
      const uid =
        item.uid ||
        item.userId ||
        item.user_uid ||
        item.id ||
        item.user ||
        item.owner_uid;
      return typeof uid === "string" && uid.trim() === targetUid;
    }
    return false;
  });
}

/**
 * Kiểm tra 1 photo có phải là ảnh CHƯA XEM đối với user hiện tại
 *
 * @param {Object} photo - Đối tượng ảnh / moment
 * @param {string|null} currentUserId - UID của user hiện tại
 * @param {Set<string>|null} viewedIds - Set các ID đã xem cục bộ (store / IndexedDB)
 * @param {Object|number|null} userOrLastSeenAt - User object hoặc timestamp lastSeenHistoryAt
 * @returns {boolean} true nếu là ảnh chưa xem của người khác gửi, false nếu đã xem hoặc là ảnh của chính mình
 */
export function isPhotoUnseen(
  photo,
  currentUserId,
  viewedIds = null,
  userOrLastSeenAt = null,
) {
  if (!photo || typeof photo !== "object") return false;
  const photoId = photo.id || photo.canonical_uid || photo.canonicalUid;
  if (!photoId) return false;

  const currentUid = currentUserId ? String(currentUserId).trim() : null;

  // 1. Chỉ tính ảnh do NGƯỜI KHÁC gửi (senderId !== currentUser.uid).
  // Tuyệt đối không đếm ảnh do chính user hiện tại chụp/đăng.
  const senderId = getPhotoSenderId(photo);
  if (!senderId) return false;
  if (currentUid && senderId === currentUid) {
    return false;
  }

  // 2. Không tính ảnh đã được đánh dấu xem cục bộ (trong viewedIds)
  if (viewedIds && typeof viewedIds.has === "function" && viewedIds.has(photoId)) {
    return false;
  }

  // 3. Không tính ảnh mà mảng photo.seenBy đã chứa currentUser.uid
  if (currentUid && hasUserSeenPhotoInArray(photo, currentUid)) {
    return false;
  }

  // 4. Nếu user có mốc lastSeenHistoryAt: chỉ tính ảnh chụp sau mốc này (photo.createdAt > user.lastSeenHistoryAt)
  const lastSeenTime = getUserLastSeenHistoryTime(userOrLastSeenAt);
  if (lastSeenTime > 0) {
    const photoTime = getPhotoTimestamp(photo);
    if (photoTime > 0 && photoTime <= lastSeenTime) {
      return false; // Đã xem trước mốc này
    }
  }

  return true;
}

/**
 * Đếm tổng số ảnh chưa xem (unseenCount) chuẩn logic Locket gốc
 */
export function countUnseenPhotos(
  photos,
  currentUserId,
  viewedIds = null,
  userOrLastSeenAt = null,
) {
  if (!Array.isArray(photos) || photos.length === 0) return 0;

  return photos.reduce((acc, photo) => {
    return isPhotoUnseen(photo, currentUserId, viewedIds, userOrLastSeenAt)
      ? acc + 1
      : acc;
  }, 0);
}
