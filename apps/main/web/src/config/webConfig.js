//config/webConfig.js

export const CONFIG = {
  api: {
    baseUrl: import.meta.env.VITE_BASE_API_URL, // API chính (socket + API)
    authUrl: import.meta.env.VITE_AUTH_API_URL,
    storage: import.meta.env.VITE_STORAGE_API_URL, // API lưu trữ file
    data: import.meta.env.VITE_DATA_API_URL, // API data local
    payment: import.meta.env.VITE_PAYMENT_API_URL, // API thanh toán
    cdnUrl: import.meta.env.VITE_CDN_URL, // API cdn
    locketApi: import.meta.env.VITE_LOCKET_API_URL, // API Locket chính thức
    exportApi: import.meta.env.VITE_EXPORTS_API_URL, // API export data pdf, excel,...
    convertApi: import.meta.env.VITE_CONVERTS_API_URL,
    extenApi: import.meta.env.VITE_EXTENS_API_URL,
  },

  keys: {
    vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY, // Push notification
    turnstileKey: import.meta.env.VITE_TURNSTILE_SITE_KEY, // Cloudflare Turnstile

    apiKey: import.meta.env.VITE_PUBLIC_API_KEY,
  },

  app: {
    name: "Locket.io.vn", // Tên app hiển thị
    author: "T97",
    shortname: "locketdio",
    fullName: "Locket.io.vn - Đăng ảnh & Video lên Locket", // Tên đầy đủ
    clientVersion: "Beta2.5.5.2.4", // Version client
    apiVersion: "v2.2.1", // Version API
    startYear: 2026,
    env: import.meta.env.MODE, // development | production
    camera: {
      limits: {
        maxRecordTime: 30, // 30 giây cho VIP
        maxImageSizeMB: 20,
        maxVideoSizeMB: 40,
      },
      resolutions: {
        imageSizePx: 1920, // ảnh vuông
        videoResolutionPx: 1080,
      },
      constraints: {
        default: {
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
        ultraHD: {
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
      },
    },
    moments: {
      initialVisible: 30, // Số lượng moments hiển thị ban đầu
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
      supportEmail: "t97system@icloud.com",
      supportNumber: "1800-123-456",
    },
    community: {
      discord: "https://t.me/t97system",
      telegram: "https://t.me/t97system",
      messenger: "https://m.me/t97system",
    },
    sponsors: {
      urlImg: "https:///vcb_qr.jpg",
      bankName: "Ngân hàng Vietcombank (VCB)",
      accountNumber: "TH797979",
      accountName: "NGUYEN VAN THONG",
    },
    bankInfo: {
      bankCode: "ICB",
      short_name: "VietinBank",
      urlImg: "https://t.me/t97system",
      bankName: "A",
      accountNumber: "NULL",
      accountName: "NULL",
    },
    myInfo: {
      fullName: "T97 System",
      email: "t97system@icloud.com",
      phone: "0123456789",
      github: "NULL",
      avatarUrl: "NULL",
    },
    docs: {
      personal_authorization:
        "https://docs.google.com/document/d/1c2ttnmPyR3YIYooMj69MlT1XAhCO_xMytHztzi6EaEY/edit?usp=sharing",
    },
    videoTutorials: {
      youtubeChannel: "https://www.youtube.com/@Locketdio",
      iosAddscreen: {
        title: "Hướng dẫn thêm Locket.io.vn vào màn hình chính trên iPhone!",
        url: "https://www.youtube.com/embed/iElPAnQ7lNY",
      }, // Hướng dẫn thêm trang web vào màn hình chính trên iPhone (Safari)
      androidAddscreen: {
        title: "Hướng dẫn thêm Locket.io.vn vào màn hình chính trên Android!",
        url: "https://www.youtube.com/embed/JtgfTNbKTZY",
      }, // Hướng dẫn thêm trang web vào màn hình chính trên Android (Chrome)
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
};
