const stringifySafely = (value) => {
  const seen = new WeakSet();

  try {
    return JSON.stringify(value, (key, currentValue) => {
      if (typeof currentValue === "object" && currentValue !== null) {
        if (seen.has(currentValue)) return "[Circular]";
        seen.add(currentValue);
      }
      return currentValue;
    });
  } catch {
    return "";
  }
};

export const toDisplayMessage = (value, fallback = "") => {
  if (value === null || value === undefined || value === "") return fallback;

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Error) {
    return value.message || fallback;
  }

  if (typeof value === "object") {
    const nestedMessage =
      value.message ||
      value.error ||
      value.details ||
      value.statusText ||
      value.reason;

    if (nestedMessage && nestedMessage !== value) {
      return toDisplayMessage(nestedMessage, fallback);
    }

    const statusLabel = value.status ? `Lỗi ${value.status}` : "";
    const errorIdLabel = value.errorId ? `Mã lỗi: ${value.errorId}` : "";
    const compactMessage = [statusLabel, errorIdLabel].filter(Boolean).join(" - ");

    if (compactMessage) return compactMessage;

    return stringifySafely(value) || fallback;
  }

  return String(value);
};
