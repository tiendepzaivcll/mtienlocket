const dns = require("dns").promises;
const net = require("net");
const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");
const heicConvert = require("heic-convert");
const catalog = require("../../data/ai-filters.json");
const { getActiveModel } = require("./settingsStore");

const CLOUDFLARE_API_ORIGIN = "https://api.cloudflare.com";
const DEFAULT_KIRA_BASE_URL = "https://kiraai.vn/api/v1";
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const CLOUDFLARE_TIMEOUT_MS = 180_000;
const KIRA_TIMEOUT_MS = 180_000;
// Keep a detailed square reference for FLUX.2; the live REST API accepts 1024px.
const CLOUDFLARE_INPUT_MAX_SIDE = 1024;

const privateIpv4 = (address) => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    parts[0] >= 224
  );
};

const privateIpv6 = (address) => {
  const value = String(address || "").toLowerCase();
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("::ffff:127.") ||
    value.startsWith("::ffff:10.") ||
    value.startsWith("::ffff:192.168.")
  );
};

const isPrivateAddress = (address) =>
  net.isIP(address) === 4
    ? privateIpv4(address)
    : net.isIP(address) === 6
      ? privateIpv6(address)
      : true;

const configuredAllowedHosts = () =>
  String(process.env.AI_FILTER_ALLOWED_IMAGE_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

const assertSafeImageUrl = async (rawUrl) => {
  let url;
  try {
    url = new URL(String(rawUrl || ""));
  } catch {
    const error = new Error("Link ảnh R2 không hợp lệ.");
    error.status = 400;
    error.code = "AI_FILTER_IMAGE_URL_INVALID";
    throw error;
  }

  if (url.protocol !== "https:") {
    const error = new Error("AI Filter chỉ nhận link ảnh HTTPS.");
    error.status = 400;
    error.code = "AI_FILTER_IMAGE_URL_INVALID";
    throw error;
  }

  const allowedHosts = configuredAllowedHosts();
  if (allowedHosts.length && !allowedHosts.includes(url.hostname.toLowerCase())) {
    const error = new Error("Host ảnh chưa được cho phép cho AI Filter.");
    error.status = 400;
    error.code = "AI_FILTER_IMAGE_HOST_NOT_ALLOWED";
    throw error;
  }

  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    const error = new Error("Link ảnh không được trỏ tới mạng nội bộ.");
    error.status = 400;
    error.code = "AI_FILTER_IMAGE_URL_UNSAFE";
    throw error;
  }

  return url.toString();
};

const normalizeInputImage = async (buffer, sourceMimeType = "") => {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("Ảnh đầu vào rỗng.");
    error.status = 400;
    error.code = "AI_FILTER_IMAGE_DECODE_FAILED";
    throw error;
  }

  const mimeType = String(sourceMimeType).toLowerCase();
  let source = buffer;

  try {
    let metadata = await sharp(source, { failOn: "truncated" }).metadata();
    if (
      ["heic", "heif"].includes(String(metadata.format || "").toLowerCase()) ||
      /image\/(?:hei[cf]|heic-sequence|heif-sequence)/.test(mimeType)
    ) {
      source = Buffer.from(
        await heicConvert({
          buffer,
          format: "JPEG",
          quality: 0.92,
        }),
      );
      metadata = await sharp(source, { failOn: "truncated" }).metadata();
    }

    if (!metadata.width || !metadata.height) {
      throw new Error("missing image dimensions");
    }

    const normalized = await sharp(source, { failOn: "truncated" })
      .rotate()
      .resize({
        width: CLOUDFLARE_INPUT_MAX_SIDE,
        height: CLOUDFLARE_INPUT_MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    return {
      data: normalized.toString("base64"),
      mimeType: "image/jpeg",
      byteLength: normalized.length,
    };
  } catch (cause) {
    const error = new Error("Không thể chuẩn hóa ảnh cho AI Filter.");
    error.status = 400;
    error.code = "AI_FILTER_IMAGE_DECODE_FAILED";
    error.cause = cause;
    throw error;
  }
};

const resolveCloudflareModel = (rawValue) => {
  const defaultModel = "@cf/black-forest-labs/flux-2-klein-9b";
  const value = String(rawValue || defaultModel).trim();
  return /^@cf\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(value)
    ? value
    : defaultModel;
};

const resolveKiraBaseUrl = (rawValue) => {
  let value = String(rawValue || "").trim();
  value = value.replace(/^KIRA_API_BASE_URL\s*=\s*/i, "").trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    value = value.slice(1, -1).trim();
  }

  if (!value || /^kira_[a-z\d]+$/i.test(value)) {
    return DEFAULT_KIRA_BASE_URL;
  }
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
      return DEFAULT_KIRA_BASE_URL;
    }
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname
      .replace(/\/+$/, "")
      .replace(/\/images\/generations$/i, "");
    return url.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_KIRA_BASE_URL;
  }
};

const cloudflareEndpoint = ({ accountId, model }) =>
  `${CLOUDFLARE_API_ORIGIN}/client/v4/accounts/${accountId}/ai/run/${model}`;

const publicCatalog = () => ({
  groups: catalog.groups
    .filter((group) => group.active !== false)
    .sort((a, b) => Number(a.order_id || 0) - Number(b.order_id || 0))
    .map((group) => ({
      ...group,
      filters: catalog.filters
        .filter(
          (filter) => filter.active !== false && filter.group_id === group.id,
        )
        .sort((a, b) => Number(a.order_id || 0) - Number(b.order_id || 0))
        .map(({ prompt, ...filter }) => filter),
    })),
});

const findFilter = (filterId) =>
  catalog.filters.find(
    (filter) => filter.active !== false && filter.filter_id === filterId,
  );

const downloadInputImage = async (imageUrl) => {
  const safeUrl = await assertSafeImageUrl(imageUrl);
  const response = await axios.get(safeUrl, {
    responseType: "arraybuffer",
    timeout: 30_000,
    maxRedirects: 0,
    maxContentLength: MAX_INPUT_BYTES,
    maxBodyLength: MAX_INPUT_BYTES,
    validateStatus: (status) => status >= 200 && status < 300,
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg",
      "User-Agent": "T97-AiFilter/1.0",
    },
  });

  const buffer = Buffer.from(response.data);
  if (!buffer.length || buffer.length > MAX_INPUT_BYTES) {
    const error = new Error("Ảnh đầu vào rỗng hoặc vượt quá 12 MB.");
    error.status = 413;
    error.code = "AI_FILTER_IMAGE_TOO_LARGE";
    throw error;
  }

  const mimeType = String(response.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!mimeType.startsWith("image/")) {
    const error = new Error("Link R2 không trả về dữ liệu ảnh.");
    error.status = 400;
    error.code = "AI_FILTER_IMAGE_TYPE_INVALID";
    throw error;
  }

  const normalized = await normalizeInputImage(buffer, mimeType);
  console.info("[ai-filter] input normalized", {
    sourceMimeType: mimeType,
    sourceBytes: buffer.length,
    outputMimeType: normalized.mimeType,
    outputBytes: normalized.byteLength,
  });
  return normalized;
};

const detectGeneratedMimeType = (base64) => {
  const bytes = Buffer.from(String(base64 || "").slice(0, 48), "base64");
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "image/png";
};

const extractCloudflareGeneratedImage = (payload) => {
  let imageBase64 = payload?.result?.image || payload?.image || "";
  let mimeType = "";
  const dataUri = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(imageBase64);

  if (dataUri) {
    mimeType = dataUri[1].toLowerCase();
    imageBase64 = dataUri[2];
  }

  imageBase64 = String(imageBase64 || "").replace(/\s+/g, "");
  if (!imageBase64 || !/^[a-z0-9+/]+={0,2}$/i.test(imageBase64)) {
    const error = new Error("Cloudflare Workers AI không trả về ảnh kết quả.");
    error.status = 502;
    error.code = "CLOUDFLARE_AI_IMAGE_MISSING";
    throw error;
  }

  return {
    imageBase64,
    mimeType: mimeType || detectGeneratedMimeType(imageBase64),
    text: "",
  };
};

const extractKiraGeneratedImage = async (payload) => {
  const imagePart = payload?.data?.find((item) => item?.b64_json);
  const imageBase64 = String(imagePart?.b64_json || "").replace(/\s+/g, "");

  if (imageBase64 && /^[a-z0-9+/]+={0,2}$/i.test(imageBase64)) {
    return {
      imageBase64,
      mimeType: imagePart.mime_type || detectGeneratedMimeType(imageBase64),
      text: String(payload?.description || payload?.message || "").trim(),
    };
  }

  const resultUrl = String(payload?.data?.find((item) => item?.url)?.url || "");
  let parsedUrl;
  try {
    parsedUrl = new URL(resultUrl);
  } catch {
    parsedUrl = null;
  }

  if (parsedUrl?.protocol === "https:") {
    try {
      const addresses = await dns.lookup(parsedUrl.hostname, {
        all: true,
        verbatim: true,
      });
      if (addresses.length && addresses.every(({ address }) => !isPrivateAddress(address))) {
        const response = await axios.get(parsedUrl.toString(), {
          responseType: "arraybuffer",
          timeout: 30_000,
          maxRedirects: 0,
          maxContentLength: 32 * 1024 * 1024,
          maxBodyLength: 32 * 1024 * 1024,
          validateStatus: (status) => status >= 200 && status < 300,
        });
        const buffer = Buffer.from(response.data);
        const mimeType = String(response.headers["content-type"] || "")
          .split(";")[0]
          .trim()
          .toLowerCase();
        if (buffer.length && mimeType.startsWith("image/")) {
          return {
            imageBase64: buffer.toString("base64"),
            mimeType,
            text: String(payload?.description || payload?.message || "").trim(),
          };
        }
      }
    } catch {
      // Fall through to a provider-shaped error below instead of leaking an
      // Axios or DNS error to the public API.
    }
  }

  const error = new Error("Kira không trả về ảnh kết quả hợp lệ.");
  error.status = 502;
  error.code = "KIRA_IMAGE_MISSING";
  throw error;
};

const cloudflareErrorMessage = (cause) => {
  const data = cause.response?.data;
  return (
    data?.errors?.find((item) => item?.message)?.message ||
    data?.result?.errors?.find((item) => item?.message)?.message ||
    data?.error?.message ||
    (typeof data?.error === "string" ? data.error : "") ||
    data?.message ||
    cause.message ||
    "Cloudflare Workers AI request failed"
  );
};

const kiraErrorMessage = (cause) =>
  cause.response?.data?.error?.message ||
  (typeof cause.response?.data?.error === "string"
    ? cause.response.data.error
    : "") ||
  cause.response?.data?.message ||
  cause.message ||
  "Kira request failed";

const generateWithCloudflare = async ({ inputImage, filter, selection }) => {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const apiToken = String(process.env.CLOUDFLARE_AI_API_TOKEN || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !apiToken) {
    const error = new Error(
      "Backend chưa cấu hình CLOUDFLARE_ACCOUNT_ID hoặc CLOUDFLARE_AI_API_TOKEN.",
    );
    error.status = 503;
    error.code = "CLOUDFLARE_AI_NOT_CONFIGURED";
    throw error;
  }

  const model = resolveCloudflareModel(selection.model);
  const endpoint = cloudflareEndpoint({ accountId, model });
  const inputBuffer = Buffer.from(inputImage.data, "base64");
  const form = new FormData();
  form.append("prompt", filter.prompt);
  form.append("input_image_0", inputBuffer, {
    filename: "input.jpg",
    contentType: inputImage.mimeType,
    knownLength: inputBuffer.length,
  });
  form.append("width", "1024");
  form.append("height", "1024");

  let response;
  try {
    response = await axios.post(endpoint, form, {
      timeout: CLOUDFLARE_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: 32 * 1024 * 1024,
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiToken}`,
      },
    });
  } catch (cause) {
    const providerMessage = cloudflareErrorMessage(cause);
    console.error("[ai-filter] Cloudflare Workers AI rejected request", {
      model,
      status: cause.response?.status || null,
      providerMessage,
      networkCode: cause.code || null,
      inputMimeType: inputImage.mimeType,
      inputBytes: inputImage.byteLength,
    });
    const error = new Error(
      `Cloudflare Workers AI từ chối yêu cầu: ${providerMessage}`,
    );
    error.status = cause.response?.status === 429 ? 429 : 502;
    error.code = cause.response?.status === 429
      ? "CLOUDFLARE_AI_RATE_LIMITED"
      : "CLOUDFLARE_AI_REQUEST_FAILED";
    throw error;
  }

  return {
    ...extractCloudflareGeneratedImage(response.data),
    filterId: filter.filter_id,
    filterLabel: filter.filter_label,
    model,
    provider: "cloudflare-workers-ai",
    usageMetadata: response.data?.result?.usage || response.data?.usage || null,
  };
};

const generateWithKira = async ({ inputImage, filter, selection }) => {
  const apiKey = String(process.env.KIRA_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("Backend chưa cấu hình KIRA_API_KEY.");
    error.status = 503;
    error.code = "KIRA_NOT_CONFIGURED";
    throw error;
  }

  const baseUrl = resolveKiraBaseUrl(process.env.KIRA_API_BASE_URL);
  const endpoint = new URL("images/generations", `${baseUrl}/`).toString();
  let response;

  try {
    response = await axios.post(
      endpoint,
      {
        model: selection.model,
        prompt: filter.prompt,
        aspect_ratio: "1:1",
        size: "1024x1024",
        reference_images: [{ mime_type: inputImage.mimeType, data: inputImage.data }],
      },
      {
        timeout: KIRA_TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: 32 * 1024 * 1024,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
  } catch (cause) {
    const providerMessage = kiraErrorMessage(cause);
    console.error("[ai-filter] Kira rejected request", {
      model: selection.model,
      status: cause.response?.status || null,
      providerMessage,
      networkCode: cause.code || null,
      inputMimeType: inputImage.mimeType,
      inputBytes: inputImage.byteLength,
    });
    const error = new Error(`Kira từ chối yêu cầu: ${providerMessage}`);
    error.status = cause.response?.status === 429 ? 429 : 502;
    error.code = cause.response?.status === 429
      ? "KIRA_RATE_LIMITED"
      : "KIRA_REQUEST_FAILED";
    throw error;
  }

  return {
    ...(await extractKiraGeneratedImage(response.data)),
    filterId: filter.filter_id,
    filterLabel: filter.filter_label,
    model: selection.model,
    provider: "kira",
    usageMetadata:
      response.data?.usage || response.data?.usage_metadata || null,
  };
};

const generateFilteredImage = async ({ imageUrl, filterId }) => {
  const filter = findFilter(String(filterId || "").trim());
  if (!filter) {
    const error = new Error("Filter không tồn tại hoặc đã bị tắt.");
    error.status = 400;
    error.code = "AI_FILTER_NOT_FOUND";
    throw error;
  }

  const selection = await getActiveModel();
  if (selection.supportsImageGeneration === false) {
    const error = new Error(
      `${selection.label || selection.model} chỉ hỗ trợ trò chuyện và phân tích ảnh, không tạo được ảnh. Hãy chọn mô hình tạo ảnh trong trang quản trị.`,
    );
    error.status = 409;
    error.code = "AI_FILTER_MODEL_NOT_IMAGE";
    throw error;
  }
  const inputImage = await downloadInputImage(imageUrl);

  if (selection.provider === "kira") {
    return generateWithKira({ inputImage, filter, selection });
  }
  return generateWithCloudflare({ inputImage, filter, selection });
};

module.exports = {
  publicCatalog,
  generateFilteredImage,
  _private: {
    assertSafeImageUrl,
    cloudflareEndpoint,
    cloudflareErrorMessage,
    detectGeneratedMimeType,
    extractCloudflareGeneratedImage,
    extractKiraGeneratedImage,
    findFilter,
    isPrivateAddress,
    kiraErrorMessage,
    normalizeInputImage,
    resolveCloudflareModel,
    resolveKiraBaseUrl,
  },
};
