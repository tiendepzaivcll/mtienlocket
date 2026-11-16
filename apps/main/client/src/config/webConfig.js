//config/webConfig.js

const LOCAL_API_URL = "http://localhost:5001";
const PRODUCTION_API_URL = "https://vip-15s-production.up.railway.app";
const LEGACY_API_URLS = new Set([
  "https://api-t97.up.railway.app",
  "https://t97-api.up.railway.app",
]);

const runtimeHostname =
  typeof window !== "undefined" ? window.location.hostname : "";

const isLocalRuntime = ["localhost", "127.0.0.1", "::1"].includes(
  runtimeHostname,
);

const isLoopbackApiUrl = (url = "") =>
  /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(?::|\/|$)/i.test(
    url,
  );

const normalizeUrl = (url) => {
  const value = (url || "").trim().replace(/\/+$/, "");
  if (!value || /^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value;

  return /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(?::|$)/i.test(value)
    ? `http://${value}`
    : `https://${value}`;
};

const resolveRuntimeHostnameForLoopback = (url) => {
  if (!url || isLocalRuntime || !isLoopbackApiUrl(url)) {
    return url;
  }

  const parsedUrl = new URL(url);
  parsedUrl.hostname = runtimeHostname;
  return normalizeUrl(parsedUrl.toString());
};

const getApiUrl = (
  envValue,
  localFallback = LOCAL_API_URL,
  productionFallback = PRODUCTION_API_URL,
) => {
  const normalizedEnvValue = normalizeUrl(envValue);

  const shouldBlockLoopback =
    import.meta.env.PROD &&
    !isLocalRuntime &&
    isLoopbackApiUrl(normalizedEnvValue);

  if (shouldBlockLoopback) {
    return productionFallback;
  }

  const value = resolveRuntimeHostnameForLoopback(normalizedEnvValue);
  const shouldReplaceLegacyApi =
    import.meta.env.PROD && LEGACY_API_URLS.has(value);

  if (value && !shouldBlockLoopback && !shouldReplaceLegacyApi) {
    return value;
  }

  return isLocalRuntime ? localFallback : productionFallback;
};

const baseApiUrl = getApiUrl(import.meta.env.VITE_BASE_API_URL);
const authApiUrl = getApiUrl(import.meta.env.VITE_AUTH_API_URL);
const dataApiUrl = getApiUrl(import.meta.env.VITE_DATA_API_URL);
const paymentApiUrl = getApiUrl(import.meta.env.VITE_PAYMENT_API_URL);
const betaApiUrl = getApiUrl(import.meta.env.VITE_BETA_API_URL);
// Local development always uses Vite's proxy so desktop and mobile follow the
// same R2 presign endpoint and avoid browser CORS differences.
const storageApiUrl = import.meta.env.DEV
  ? `${window.location.origin}/storage-api`
  : import.meta.env.VITE_STORAGE_API_URL;

export const CONFIG = {
  api: {
    baseUrl: baseApiUrl, // API chính (socket + API)
    authUrl: authApiUrl,
    storage: storageApiUrl, // API lưu trữ file
    data: dataApiUrl, // API data local
    payment: paymentApiUrl, // API thanh toán
    betaUrl: betaApiUrl,
    cdnUrl: import.meta.env.VITE_CDN_URL, // API cdn
    locketApi: import.meta.env.VITE_LOCKET_API_URL, // API Locket chính thức
    exportApi: import.meta.env.VITE_EXPORTS_API_URL, // API export data pdf, excel,...
    convertApi: import.meta.env.VITE_CONVERTS_API_URL,
    extenApi: import.meta.env.VITE_EXTENS_API_URL,
    isConfigured: Boolean(baseApiUrl && authApiUrl),
  },

  keys: {
    vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY, // Push notification
    turnstileKey: import.meta.env.VITE_TURNSTILE_SITE_KEY, // Cloudflare Turnstile

    apiKey: import.meta.env.VITE_PUBLIC_API_KEY,
  },

  app: {
    name: "LOCKET-PRO", // Tên app hiển thị
    author: "T97",
    shortname: "t97",
    fullName: "LOCKET-PRO - Chia sẻ khoảnh khắc trên Locket", // Tên đầy đủ
    clientVersion: "Beta2.5.5.2.6", // Version client
    apiVersion: "v2.2.1", // Version API
    buildVersion: import.meta.env.VITE_BUILD_COMMIT || "local",
    buildTime: import.meta.env.VITE_BUILD_TIME || "",
    startYear: 2025,
    env: import.meta.env.MODE, // development | production
    camera: {
      limits: {
        maxRecordTime: 15, // giây
        maxImageSizeMB: 10,
        maxVideoSizeMB: 10,
      },
      resolutions: {
        imageSizePx: 1920, // ảnh vuông
        videoResolutionPx: 1080, // FullHD vuông cho Locket (1080x1080)
      },
      constraints: {
        default: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        ultraHD: {
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
      },
    },
    moments: {
      initialVisible: 50, // Số lượng moments hiển thị ban đầu
      maxDisplayLimit: 5000, // Giới hạn tối đa moments hiển thị trên client
      loadMoreLimit: 50, // Số lượng moments tải thêm mỗi lần
      duplicateThreshold: 3, // Ngưỡng trùng lặp để dừng tải thêm
    },
    messages: {
      initialVisible: 50, // Số lượng messages hiển thị ban đầu
      maxDisplayLimit: 5000, // Giới hạn tối đa messages hiển thị trên client
      loadMoreLimit: 50, // Số lượng messages tải thêm mỗi lần
    },
    contact: {
      supportEmail: "tienmanh6811@gmail.com",
      supportNumber: "0359153413",
      zaloUrl: "https://zalo.me/0359153413",
    },
    community: {
      zalo: "https://zalo.me/0359153413",
    },
    bankInfo: {
      bankCode: "ICB",
      short_name: "VietinBank",
      urlImg: "https://cdn.locket-dio.com/v1/images/qr/dio-mbbank-qr.jpg",
      bankName: "Ngân hàng TMCP Công thương Việt Nam",
      accountNumber: "999964715555",
      accountName: "DAO VAN DOI",
    },
    myInfo: {
      fullName: "T97",
      github: "https://github.com/doi2523",
      avatarUrl: "https://github.com/doi2523.png",
    },
    docs: {
      personal_authorization:
        "https://docs.google.com/document/d/1c2ttnmPyR3YIYooMj69MlT1XAhCO_xMytHztzi6EaEY/edit?usp=sharing",
    },
  },
  ui: {
    theme: "light", // hoặc "dark"
    themes: [
      "light",
      "dark",
      "cupcake",
      "bumblebee",
      "emerald",
      "corporate",
      "synthwave",
      "retro",
      "valentine",
      "halloween",
      "garden",
      "forest",
      "lofi",
      "pastel",
      "fantasy",
      "wireframe",
      "black",
      "luxury",
      "dracula",
      "cmyk",
      "autumn",
      "business",
      "acid",
      "lemonade",
      "night",
      "coffee",
      "winter",
    ],
    maxToastVisible: 3,
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm:ss",

    moments: {
      initialVisible: 50,
      maxDisplayLimit: 5000,
      duplicateThreshold: 3,
    },
    chat: { initialVisible: 10 },

    categories: [
      { id: "update", label: "Cập nhật", icon: "Sparkles" },
      { id: "event", label: "Sự kiện", icon: "Gift" },
      { id: "announcement", label: "Thông báo", icon: "Megaphone" },
      { id: "tip", label: "Mẹo sử dụng", icon: "Lightbulb" },
    ],
  },
  cache: {
    keys: {
      user: "userData",
      memberToken: "memberToken",
      memberHeader: "memberHeader",
    },
    ttl: {
      user: 24 * 60 * 60 * 1000,
    },
  },
};
