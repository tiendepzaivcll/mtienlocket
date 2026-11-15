const finiteNumber = (value) => {
  const raw = value && typeof value === "object" && "value" in value
    ? value.value
    : value;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
};

export const normalizeTimestampMillis = (timestamp) => {
  if (timestamp === null || timestamp === undefined || timestamp === "") {
    return null;
  }

  if (timestamp instanceof Date) {
    const millis = timestamp.getTime();
    return Number.isFinite(millis) ? millis : null;
  }

  if (typeof timestamp === "object") {
    if (typeof timestamp.toMillis === "function") {
      try {
        const millis = finiteNumber(timestamp.toMillis());
        if (millis !== null) return millis;
      } catch {
        // Continue with REST/protobuf timestamp shapes.
      }
    }

    const seconds = finiteNumber(timestamp._seconds ?? timestamp.seconds);
    if (seconds !== null) {
      const nanoseconds = finiteNumber(
        timestamp._nanoseconds ?? timestamp.nanoseconds,
      ) || 0;
      const millis = seconds * 1000 + Math.floor(nanoseconds / 1e6);
      return Number.isFinite(millis) ? millis : null;
    }

    const timestampValue =
      timestamp.timestampValue ?? timestamp.timestamp_value;
    if (timestampValue !== undefined) {
      return normalizeTimestampMillis(timestampValue);
    }

    if ("value" in timestamp) {
      return normalizeTimestampMillis(timestamp.value);
    }
    return null;
  }

  if (typeof timestamp === "string") {
    const trimmed = timestamp.trim();
    if (!trimmed) return null;
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      return normalizeTimestampMillis(Number(trimmed));
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    const millis = Math.abs(timestamp) < 1e12 ? timestamp * 1000 : timestamp;
    return Number.isFinite(new Date(millis).getTime()) ? millis : null;
  }

  return null;
};

export const formatTimeAgo = (timestamp) => {
  const millis = normalizeTimestampMillis(timestamp);
  if (millis === null) return "";

  const now = new Date();
  const target = new Date(millis);
  if (!Number.isFinite(target.getTime())) return "";
  const diffMs = now.getTime() - target.getTime();

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 3) return `${diffDays} ngày trước`;

  const day = target.getDate();
  const month = target.getMonth() + 1;
  const year = target.getFullYear();

  // ✅ Nếu cùng năm thì chỉ hiển thị "6 thg 8"
  if (year === now.getFullYear()) {
    return `${day} thg ${month}`;
  }

  // ✅ Nếu khác năm thì hiện "ngày 6 thg 8, 2024"
  return `ngày ${day} thg ${month}, ${year}`;
};

export const formatTimeAgoV2 = (timestamp) => {
  return formatTimeAgo(timestamp);
};
