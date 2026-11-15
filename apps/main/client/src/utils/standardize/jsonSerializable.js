const isBrowserRuntimeObject = (value) => {
  if (!value || typeof value !== "object") return false;

  if (typeof Window !== "undefined" && value instanceof Window) return true;
  if (typeof Document !== "undefined" && value instanceof Document) return true;
  if (typeof Node !== "undefined" && value instanceof Node) return true;
  if (typeof Event !== "undefined" && value instanceof Event) return true;
  if (typeof File !== "undefined" && value instanceof File) return true;
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;

  return false;
};

// Clone only JSON-compatible data. A path-scoped WeakSet removes real cycles
// while still allowing the same plain object to appear in separate branches.
export const toJsonSerializable = (value, ancestors = new WeakSet()) => {
  if (value === null) return null;

  const valueType = typeof value;
  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean"
  ) {
    return Number.isNaN(value) ? null : value;
  }
  if (valueType === "bigint") return value.toString();
  if (
    valueType === "undefined" ||
    valueType === "function" ||
    valueType === "symbol"
  ) {
    return undefined;
  }
  if (value instanceof Date) return value.toISOString();
  if (isBrowserRuntimeObject(value)) return undefined;
  if (ancestors.has(value)) return undefined;

  ancestors.add(value);

  let cloned;
  if (Array.isArray(value)) {
    cloned = value
      .map((item) => toJsonSerializable(item, ancestors))
      .filter((item) => item !== undefined);
  } else {
    cloned = {};
    for (const [key, item] of Object.entries(value)) {
      const safeItem = toJsonSerializable(item, ancestors);
      if (safeItem !== undefined) cloned[key] = safeItem;
    }
  }

  ancestors.delete(value);
  return cloned;
};

export const assertJsonSerializable = (value) => {
  const safeValue = toJsonSerializable(value);
  JSON.stringify(safeValue);
  return safeValue;
};
