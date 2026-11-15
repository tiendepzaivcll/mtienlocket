import { defineConfig, loadEnv } from "vite";
import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

const getBuildCommit = () => {
  const railwayCommit = String(process.env.RAILWAY_GIT_COMMIT_SHA || "").trim();
  if (railwayCommit) return railwayCommit.slice(0, 8);

  try {
    return execFileSync("git", ["rev-parse", "--short=8", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "local";
  }
};

const buildCommit = getBuildCommit();
const buildTime = new Date().toISOString();
// A commit SHA alone is not enough when Railway serves a committed `dist`
// without rebuilding it. Keep an ID shared by the JS bundle and version.json
// so every actual build can be detected by an already-open iOS PWA.
const buildId = `${buildCommit}-${Date.parse(buildTime).toString(36)}`;

const manifestForPlugIn = {
  // ✅ Dùng đúng chiến lược cập nhật SW
  strategies: "injectManifest",
  srcDir: "src",
  filename: "sw.js",

  // ✅ Auto inject code register SW
  injectRegister: "auto",
  injectManifest: {
    maximumFileSizeToCacheInBytes: 0, // ✅ TẮT HOÀN TOÀN cache tự động
    // HEIC decoder is a ~3 MB emergency fallback. Keep it lazy so normal
    // Android/JPEG users do not download it during service-worker install.
    globIgnores: ["**/heic-to-*.js"],
  },

  // ✅ Tự kiểm tra và cập nhật SW khi có bản mới
  registerType: "autoUpdate",

  includeAssets: [
    "t97-favicon.ico",
    "t97-apple-touch-icon.png",
    "t97-icon-maskable-512x512.png",
  ],

  manifest: {
    name: "T97",
    short_name: "T97",
    description: "T97 - Đăng ảnh & Video lên Locket",
    display: "standalone",
    background_color: "#feb801",
    theme_color: "#feb801",
    scope: "/",
    start_url: "/",
    orientation: "portrait",
    icons: [
      {
        src: "/t97-icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/t97-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/t97-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/t97-icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  },
};

const brand = process.env.VITE_BRAND;
const publicDir = brand ? `public-${brand}` : "public";

const disableLocalServiceWorker = {
  name: "disable-local-service-worker",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = new URL(req.url || "/", "http://localhost").pathname;
      if (pathname !== "/sw.js") return next();

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.end(`
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(windows.map((client) => client.navigate(client.url)));
  })());
});
`);
    });
  },
};

const localStorageUploadProxy = {
  name: "local-storage-upload-proxy",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const requestUrl = new URL(req.url || "/", "http://localhost");
      if (requestUrl.pathname !== "/storage-upload-proxy") return next();

      if (req.method !== "PUT") {
        res.statusCode = 405;
        return res.end("Method not allowed");
      }

      try {
        const targetValue = requestUrl.searchParams.get("url");
        const targetUrl = new URL(targetValue);
        const isR2Host = targetUrl.hostname.endsWith(".r2.cloudflarestorage.com");

        if (targetUrl.protocol !== "https:" || !isR2Host) {
          res.statusCode = 400;
          return res.end("Invalid storage target");
        }

        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);

        const uploadResponse = await fetch(targetUrl, {
          method: "PUT",
          headers: {
            "Content-Type": req.headers["content-type"] || "application/octet-stream",
          },
          body: Buffer.concat(chunks),
        });

        res.statusCode = uploadResponse.status;
        res.end(Buffer.from(await uploadResponse.arrayBuffer()));
      } catch (error) {
        console.error("Local storage upload proxy failed:", error.message);
        res.statusCode = 502;
        res.end("Storage upload failed");
      }
    });
  },
};

const noCacheAppShell = {
  name: "no-cache-app-shell",
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = new URL(req.url || "/", "http://localhost").pathname;
      const acceptsHtml = String(req.headers.accept || "").includes("text/html");
      const isVersionEntry = [
        "/",
        "/index.html",
        "/sw.js",
        "/manifest.webmanifest",
        "/version.json",
      ].includes(pathname);

      if (acceptsHtml || isVersionEntry) {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, max-age=0",
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      next();
    });
  },
};

// Ghi ra dist/version.json chứa commit đang deploy để client kiểm tra "có bản mới không"
// một cách độc lập với vòng đời service worker (đáng tin cả trên iOS PWA).
const emitVersionJson = {
  name: "emit-version-json",
  apply: "build",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ commit: buildCommit, buildId, buildTime }),
    });
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const allowedHosts = [
    "t97.io.vn",
    "healthcheck.railway.app",
    process.env.RAILWAY_PUBLIC_DOMAIN,
  ].filter(Boolean);
  const storageTarget = (env.VITE_STORAGE_API_URL || "http://localhost:5003")
    .trim().replace(/\/+$/, "");
  return {
  define: {
    "import.meta.env.VITE_BUILD_COMMIT": JSON.stringify(buildCommit),
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildTime),
  },
  publicDir,
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  server: {
    host: true,
    allowedHosts,
    proxy: {
      "/storage-api": {
        target: storageTarget,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/storage-api/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyRequest) => {
            proxyRequest.removeHeader("origin");
          });
        },
      },
    },
    headers: {
      "Cache-Control": "no-store",
    },
  },
  preview: {
    host: true,
    allowedHosts,
  },
  plugins: [
    disableLocalServiceWorker,
    localStorageUploadProxy,
    noCacheAppShell,
    emitVersionJson,
    tailwindcss(),
    react(),
    VitePWA(manifestForPlugIn),
    visualizer({ filename: "dist/stats.html" }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // alias @ trỏ vào thư mục src
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          icons: ["lucide-react", "react-icons"],
          swiper: ["swiper"],
          tour: ["driver.js"],
          marquee: ["react-fast-marquee"],
          toast: ["sonner"],
          crop: ["react-easy-crop"],
          vendor: ["axios", "zustand", "dexie"]
        },
      },
    },
    chunkSizeWarningLimit: 1500, // tăng giới hạn warning, đỡ spam console
  },
  };
});
