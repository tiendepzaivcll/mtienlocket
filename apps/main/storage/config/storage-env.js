class StorageConfigurationError extends Error {
  constructor(fields) {
    super(`Configure valid storage settings: ${fields.join(", ")}`);
    this.name = "StorageConfigurationError";
    this.code = "STORAGE_NOT_CONFIGURED";
    this.fields = fields;
  }
}

function readHttpsUrl(value, { r2 = false } = {}) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    if (r2 && (!/^[a-z0-9.-]+\.r2\.cloudflarestorage\.com$/i.test(url.hostname) || url.pathname !== "/")) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function getStorageConfig(env = process.env, { requireMedia = true } = {}) {
  const fields = [];
  const endpoint = readHttpsUrl(env.R2_ENDPOINT, { r2: true });
  const mediaUrl = readHttpsUrl(env.MEDIA_API_URL);
  const accessKeyId = String(env.R2_ACCESS_KEY || "").trim();
  const secretAccessKey = String(env.R2_SECRET_KEY || "").trim();
  const bucket = String(env.R2_BUCKET || "").trim();
  if (!endpoint) fields.push("R2_ENDPOINT");
  if (!accessKeyId) fields.push("R2_ACCESS_KEY");
  if (!secretAccessKey) fields.push("R2_SECRET_KEY");
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) fields.push("R2_BUCKET");
  if (requireMedia && !mediaUrl) fields.push("MEDIA_API_URL");
  if (fields.length) throw new StorageConfigurationError(fields);
  return { endpoint, mediaUrl, accessKeyId, secretAccessKey, bucket };
}

module.exports = { getStorageConfig, StorageConfigurationError };
