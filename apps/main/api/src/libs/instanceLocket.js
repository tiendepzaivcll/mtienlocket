const axios = require("axios");
const serverConfig = require("../config/app.config");
const {
  getOrCreateAppCheckToken,
} = require("../services/AppCheck/appCheckService");

const loginHeader = {
  "Content-Type": "application/json",
  "Accept-Language": "en-US",
  "X-Ios-Bundle-Identifier": "com.locket.Locket",
  "User-Agent": "FirebaseAuth.iOS/10.23.1 com.locket.Locket/2.8.0 iPhone/18.0 hw/iPhone12_1",
  "X-Client-Version": "iOS/FirebaseSDK/10.23.1/FirebaseCore-iOS",
  "X-Firebase-GMPID": "1:641029076083:ios:cc8eb46290d69b234fa606",
  "X-Firebase-Client": "H4sIAAAAAAAAAKtWykhNLCpJSk0sKVayio7VUSpLLSrOzM9TslIyUqoFAFyivEQfAAAA",
};

const BASE_URL_LOCKET = serverConfig.function.locketApi;

const instanceLocketV2 = axios.create({
  baseURL: BASE_URL_LOCKET,
  timeout: 30000,
  headers: {
    ...loginHeader,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Interceptor: thêm token động trước mỗi request
instanceLocketV2.interceptors.request.use(
  async (config) => {
    const token = config?.meta?.idToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const omitAppCheck = config?.meta?.omitAppCheck === true;
    let appCheckToken = null;
    if (!omitAppCheck) {
      appCheckToken = config?.meta?.appCheckToken || null;
      if (!appCheckToken) {
        try {
          appCheckToken = await getOrCreateAppCheckToken();
        } catch (error) {
          // App Check is best-effort for existing Locket endpoints. Upstream can
          // still decide whether the specific operation requires the header.
          console.warn("App Check unavailable:", error?.code || error?.message);
        }
      }
    }

    if (appCheckToken) {
      config.headers["X-Firebase-AppCheck"] = appCheckToken;
    } else {
      delete config.headers["X-Firebase-AppCheck"];
    }

    const omitInstanceIdToken = config?.meta?.omitInstanceIdToken === true;
    const instanceIdToken =
      config?.meta?.instanceIdToken || process.env.FIREBASE_INSTANCE_ID_TOKEN;

    if (omitInstanceIdToken) {
      delete config.headers["Firebase-Instance-ID-Token"];
    } else if (instanceIdToken) {
      config.headers["Firebase-Instance-ID-Token"] = instanceIdToken;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

module.exports = { instanceLocketV2 };
