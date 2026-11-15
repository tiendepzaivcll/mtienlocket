// File: controllers/api.controller.js
const axios = require("axios");
const { db } = require("../config/firebase-admin-config");
const { authServices } = require("../services");
const { resolveMusicMetadata } = require("../services/Extensions/musicMetadata");
const {
  createWeatherCache,
  parseCoordinates,
} = require("../services/Extensions/weatherCache");

const APPROVED_USER_COLLECTION = "approved_users";
const ACCESS_ROLES = new Set(["vip", "celebrity"]);
const weatherCache = createWeatherCache();

const normalizeAccessId = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

const isApprovedDocEnabled = (data = {}) =>
  data.active !== false &&
  data.approved !== false &&
  data.enabled !== false &&
  data.disabled !== true;

const normalizeAccessRole = (value = "vip") =>
  ACCESS_ROLES.has(String(value || "").trim().toLowerCase())
    ? String(value).trim().toLowerCase()
    : "vip";

const checkFirestoreApproval = async (username) => {
  if (!db || !username) return null;

  const doc = await db.collection(APPROVED_USER_COLLECTION).doc(username).get();
  if (!doc.exists || !isApprovedDocEnabled(doc.data())) return null;

  const data = doc.data();

  return {
    role: normalizeAccessRole(data.role),
    aiFilterEnabled: data.aiFilterEnabled === true,
    ref: doc.ref,
  };
};

const getWeatherMeta = (code, isDay = true) => {
  const dayNight = isDay ? "day" : "night";
  const weatherMap = {
    0: { condition: "Trời quang", icon: "113", wk_condition: "clear" },
    1: { condition: "Ít mây", icon: "116", wk_condition: "mostlyClear" },
    2: { condition: "Có mây", icon: "119", wk_condition: "partlyCloudy" },
    3: { condition: "Nhiều mây", icon: "122", wk_condition: "mostlyCloudy" },
    45: { condition: "Sương mù", icon: "143", wk_condition: "foggy" },
    48: { condition: "Sương mù đóng băng", icon: "143", wk_condition: "foggy" },
    51: { condition: "Mưa phùn nhẹ", icon: "266", wk_condition: "drizzle" },
    53: { condition: "Mưa phùn", icon: "266", wk_condition: "drizzle" },
    55: { condition: "Mưa phùn nặng hạt", icon: "266", wk_condition: "heavyRain" },
    61: { condition: "Mưa nhẹ", icon: "296", wk_condition: "rain" },
    63: { condition: "Mưa", icon: "302", wk_condition: "rain" },
    65: { condition: "Mưa lớn", icon: "308", wk_condition: "heavyRain" },
    71: { condition: "Tuyết nhẹ", icon: "326", wk_condition: "snow" },
    73: { condition: "Tuyết", icon: "332", wk_condition: "snow" },
    75: { condition: "Tuyết lớn", icon: "338", wk_condition: "heavySnow" },
    80: { condition: "Mưa rào nhẹ", icon: "353", wk_condition: "rain" },
    81: { condition: "Mưa rào", icon: "356", wk_condition: "rain" },
    82: { condition: "Mưa rào lớn", icon: "359", wk_condition: "heavyRain" },
    95: { condition: "Dông", icon: "389", wk_condition: "thunderstorms" },
    96: { condition: "Dông kèm mưa đá", icon: "392", wk_condition: "thunderstorms" },
    99: { condition: "Dông kèm mưa đá lớn", icon: "395", wk_condition: "thunderstorms" },
  };

  const meta = weatherMap[code] || weatherMap[0];
  return {
    condition: meta.condition,
    wk_condition: meta.wk_condition,
    icon: `//cdn.weatherapi.com/weather/64x64/${dayNight}/${meta.icon}.png`,
  };
};

const getWeatherConditionKey = (condition = "") => {
  const text = String(condition || "").toLowerCase();
  if (text.includes("thunder") || text.includes("dông")) return "thunderstorms";
  if (text.includes("heavy rain") || text.includes("mưa lớn")) return "heavyRain";
  if (text.includes("rain") || text.includes("mưa")) return "rain";
  if (text.includes("drizzle") || text.includes("mưa phùn")) return "drizzle";
  if (text.includes("fog") || text.includes("mist") || text.includes("sương")) return "foggy";
  if (text.includes("cloud") || text.includes("mây")) return "mostlyCloudy";
  if (text.includes("clear") || text.includes("sunny") || text.includes("nắng")) return "clear";
  return "partlyCloudy";
};

const getResolvedWeatherCondition = (condition, windKph) =>
  Number.isFinite(Number(windKph)) && Number(windKph) >= 25
    ? "windy"
    : getWeatherConditionKey(condition);

const getWeatherProvider = () =>
  String(process.env.WEATHER_PROVIDER || "")
    .trim()
    .toLowerCase();

const getWeatherApiKey = () =>
  process.env.WEATHERAPI_KEY ||
  (getWeatherProvider() !== "openweather" ? process.env.WEATHER_API_KEY : null);

const getOpenWeatherApiKey = () =>
  process.env.OPENWEATHER_API_KEY ||
  (getWeatherProvider() === "openweather" ? process.env.WEATHER_API_KEY : null);

const buildOpenWeatherCurrent = async ({ lat, lon }) => {
  const apiKey = getOpenWeatherApiKey();
  if (!apiKey) return null;

  const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
    params: {
      appid: apiKey,
      lat,
      lon,
      units: "metric",
      lang: "vi",
    },
    timeout: 10000,
  });

  const data = response.data || {};
  const weather = Array.isArray(data.weather) ? data.weather[0] : null;
  const tempC = Number(data.main?.temp);
  const displayTempC = tempC;
  const feelsLikeC = Number(data.main?.feels_like);
  const isDay =
    Number.isFinite(Number(data.dt)) &&
    Number.isFinite(Number(data.sys?.sunrise)) &&
    Number.isFinite(Number(data.sys?.sunset))
      ? data.dt >= data.sys.sunrise && data.dt < data.sys.sunset
      : true;
  const condition = weather?.description || weather?.main || "Thời tiết";
  const windKph = Number.isFinite(Number(data.wind?.speed))
    ? Number(data.wind.speed) * 3.6
    : null;

  return {
    location: {
      lat: Number(data.coord?.lat ?? lat),
      lon: Number(data.coord?.lon ?? lon),
      name: data.name || null,
      country: data.sys?.country || null,
      timezone_offset_seconds: data.timezone ?? null,
    },
    current: {
      temp_c: displayTempC,
      temp_c_rounded: Math.round(displayTempC),
      temperature: Math.round((displayTempC * 9) / 5 + 32),
      measured_temp_c: tempC,
      measured_temp_c_rounded: Math.round(tempC),
      temperature_offset_c: 0,
      condition,
      wk_condition: getResolvedWeatherCondition(condition, windKph),
      icon: weather?.icon
        ? `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
        : null,
      cloud_cover: data.clouds?.all,
      humidity: data.main?.humidity,
      feelslike_c: feelsLikeC,
      display_source: "openweather_current",
      wind_kph: windKph,
      is_day: isDay ? 1 : 0,
      weather_code: weather?.id,
      time: Number.isFinite(Number(data.dt))
        ? new Date(data.dt * 1000).toISOString()
        : null,
    },
  };
};

const buildWeatherApiCurrent = async ({ lat, lon }) => {
  const apiKey = getWeatherApiKey();
  if (!apiKey) return null;

  const response = await axios.get("https://api.weatherapi.com/v1/current.json", {
    params: {
      key: apiKey,
      q: `${lat},${lon}`,
      lang: "vi",
      aqi: "no",
    },
    timeout: 10000,
  });

  const current = response.data?.current;
  if (!current) return null;

  const tempC = Number(current.temp_c);
  const displayTempC = tempC;
  const feelsLikeC = Number(current.feelslike_c);
  const isDay = current.is_day === 1 || current.is_day === true;
  const condition = current.condition?.text || "Thời tiết";

  return {
    location: {
      lat: Number(response.data?.location?.lat ?? lat),
      lon: Number(response.data?.location?.lon ?? lon),
      name: response.data?.location?.name || null,
      region: response.data?.location?.region || null,
      country: response.data?.location?.country || null,
      timezone: response.data?.location?.tz_id || null,
    },
    current: {
      temp_c: displayTempC,
      temp_c_rounded: Math.round(displayTempC),
      temperature: Math.round((displayTempC * 9) / 5 + 32),
      measured_temp_c: tempC,
      measured_temp_c_rounded: Math.round(tempC),
      temperature_offset_c: 0,
      condition,
      wk_condition: getResolvedWeatherCondition(condition, current.wind_kph),
      icon: current.condition?.icon || null,
      cloud_cover: current.cloud,
      humidity: current.humidity,
      feelslike_c: feelsLikeC,
      display_source: "weatherapi_current",
      wind_kph: current.wind_kph,
      is_day: current.is_day,
      weather_code: current.condition?.code,
      last_updated: current.last_updated || null,
    },
  };
};

const buildOpenMeteoCurrent = async ({ lat, lon }) => {
  const weatherUrl = "https://api.open-meteo.com/v1/forecast";
  const weatherResponse = await axios.get(weatherUrl, {
    params: {
      latitude: lat,
      longitude: lon,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,wind_speed_10m",
      timezone: "auto",
    },
    timeout: 10000,
  });

  const current = weatherResponse.data?.current;
  if (!current) return null;

  const meta = getWeatherMeta(current.weather_code, current.is_day === 1);
  const measuredTempC = Number(current.temperature_2m);
  const feelsLikeC = Number(current.apparent_temperature);
  const tempC = Number.isFinite(measuredTempC) ? measuredTempC : feelsLikeC;
  const displayTempC = tempC;

  return {
    location: {
      lat: Number(lat),
      lon: Number(lon),
      timezone: weatherResponse.data?.timezone || null,
    },
    current: {
      temp_c: displayTempC,
      temp_c_rounded: Math.round(displayTempC),
      temperature: Math.round((displayTempC * 9) / 5 + 32),
      measured_temp_c: measuredTempC,
      measured_temp_c_rounded: Math.round(measuredTempC),
      temperature_offset_c: 0,
      condition: meta.condition,
      wk_condition: getResolvedWeatherCondition(
        meta.wk_condition,
        current.wind_speed_10m,
      ),
      icon: meta.icon,
      cloud_cover: current.cloud_cover,
      humidity: current.relative_humidity_2m,
      feelslike_c: feelsLikeC,
      display_source: Number.isFinite(measuredTempC)
        ? "temperature_2m"
        : "apparent_temperature",
      wind_kph: current.wind_speed_10m,
      is_day: current.is_day,
      weather_code: current.weather_code,
      time: current.time || null,
    },
  };
};

const enrichWeatherTwilight = async (weatherData, { lat, lon }) => {
  try {
    const response = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: lat,
        longitude: lon,
        daily: "sunrise,sunset",
        forecast_days: 1,
        timezone: "auto",
        timeformat: "unixtime",
      },
      timeout: 10000,
    });
    const sunriseSeconds = Number(response.data?.daily?.sunrise?.[0]);
    const sunsetSeconds = Number(response.data?.daily?.sunset?.[0]);
    if (!Number.isFinite(sunriseSeconds) || !Number.isFinite(sunsetSeconds)) {
      return weatherData;
    }

    return {
      ...weatherData,
      current: {
        ...weatherData.current,
        sunrise: new Date(sunriseSeconds * 1000).toISOString(),
        sunset: new Date(sunsetSeconds * 1000).toISOString(),
        sunrise_timestamp_ms: sunriseSeconds * 1000,
        sunset_timestamp_ms: sunsetSeconds * 1000,
      },
    };
  } catch (error) {
    console.warn("⚠️ Không lấy được giờ bình minh/hoàng hôn:", error.message);
    return weatherData;
  }
};

class ApiController {
  async checkAccess(req, res) {
    try {
      const { idToken, localId } = req.user || {};
      const userInfo = await authServices.getUserInfoV2(idToken, localId);
      const username = normalizeAccessId(userInfo?.username);

      const approval = await checkFirestoreApproval(username);

      if (!approval) {
        return res.status(403).json({
          success: false,
          code: "ACCESS_NOT_APPROVED",
          message: "Tài khoản chưa được admin phê duyệt.",
          data: {
            approved: false,
            username: userInfo?.username || null,
            contact: process.env.ADMIN_CONTACT || "t97system@icloud.com",
          },
        });
      }

      const previousUidLinks = await db
        .collection(APPROVED_USER_COLLECTION)
        .where("uid", "==", localId)
        .get();
      await Promise.all(
        previousUidLinks.docs
          .filter((doc) => doc.ref.path !== approval.ref.path)
          .map((doc) => doc.ref.set({ uid: null }, { merge: true })),
      );

      await approval.ref.set(
        {
          uid: localId,
          lastAccessAt: new Date().toISOString(),
        },
        { merge: true },
      );

      return res.status(200).json({
        success: true,
        data: {
          approved: true,
          username: userInfo?.username || null,
          role: approval.role,
          features: {
            aiFilter: approval.aiFilterEnabled,
          },
          source: "firestore",
        },
      });
    } catch (error) {
      console.error("❌ Lỗi checkAccess:", error);
      return res.status(500).json({
        success: false,
        message: "Không kiểm tra được quyền truy cập",
      });
    }
  }

  async getWeatherV2(req, res, next) {
    try {
      const coordinates = parseCoordinates(req.body?.lat, req.body?.lon);
      const { lat, lon } = coordinates;
      const cached = weatherCache.get(coordinates);
      if (cached) {
        return res.status(200).json({
          status: "success",
          message: "Lấy thông tin thời tiết thành công!",
          data: cached.data,
          meta: { cache: "hit", age_ms: cached.ageMs },
        });
      }

      let weatherData = null;
      const provider = getWeatherProvider();

      if (provider === "openweather") {
        try {
          weatherData = await buildOpenWeatherCurrent({ lat, lon });
        } catch (error) {
          console.warn("⚠️ OpenWeather fallback sang WeatherAPI/Open-Meteo:", error.message);
        }
      }

      if (!weatherData) {
        try {
          weatherData = await buildWeatherApiCurrent({ lat, lon });
        } catch (error) {
          console.warn("⚠️ WeatherAPI fallback sang OpenWeather/Open-Meteo:", error.message);
        }
      }

      if (!weatherData && provider !== "openweather") {
        try {
          weatherData = await buildOpenWeatherCurrent({ lat, lon });
        } catch (error) {
          console.warn("⚠️ OpenWeather fallback sang Open-Meteo:", error.message);
        }
      }

      if (!weatherData) {
        weatherData = await buildOpenMeteoCurrent({ lat, lon });
      }

      if (!weatherData?.current) {
        return res.status(502).json({
          status: "error",
          message: "Không lấy được dữ liệu thời tiết",
        });
      }

      weatherData = await enrichWeatherTwilight(weatherData, coordinates);

      weatherCache.set(coordinates, weatherData);

      return res.status(200).json({
        status: "success",
        message: "Lấy thông tin thời tiết thành công!",
        data: weatherData,
        meta: { cache: "miss" },
      });
    } catch (error) {
      console.error("❌ Lỗi getWeatherV2:", error);
      if (error.code === "INVALID_COORDINATES") {
        return res.status(400).json({ status: "error", message: error.message });
      }

      try {
        const coordinates = parseCoordinates(req.body?.lat, req.body?.lon);
        const cached = weatherCache.get(coordinates, { allowStale: true });
        if (cached) {
          return res.status(200).json({
            status: "success",
            message: "Đang dùng dữ liệu thời tiết gần nhất.",
            data: cached.data,
            meta: { cache: "stale", age_ms: cached.ageMs },
          });
        }
      } catch {
        // Validation response is handled above; no stale cache is available here.
      }
      return res.status(502).json({
        status: "error",
        message: "Không lấy được dữ liệu thời tiết.",
      });
    }
  }

  async getInfoMusic(req, res, next) {
    try {
      const { url, platform } = req.body;
      const musicData = await resolveMusicMetadata({ url, platform });

      return res.status(200).json({
        status: "success",
        data: musicData,
      });

    } catch (error) {
      console.error("❌ Lỗi getInfoMusic:", error.message);
      return res.status(error.status || 502).json({
        status: "error",
        code: error.code || "MUSIC_LOOKUP_FAILED",
        message: error.message || "Không thể lấy thông tin bài hát",
      });
    }
  }

  /**
   * Endpoint check VIP status
   * Kiểm tra xem VIP của user còn hạn hay hết rồi
   */
  async checkVipStatus(req, res) {
    try {
      const userEmail = req.user?.email;
      const userLocalId = req.user?.localId; // Firebase user_id from JWT

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Không tìm thấy email người dùng",
        });
      }

      if (!userLocalId) {
        return res.status(401).json({
          success: false,
          message: "Không tìm thấy Firebase ID người dùng",
        });
      }

      if (!db) {
        console.warn("⚠️ Firebase not initialized for checkVipStatus");
        // 🚀 GRACEFUL FALLBACK: If Firebase is down, assume user HAS VIP
        // Better to allow access when uncertain than to kick them out
        console.warn(`🚀 Firebase unavailable, allowing user ${userEmail} through with graceful fallback`);
        return res.status(200).json({
          success: true,
          data: {
            hasVip: true,
            isExpired: false,
            message: "Firebase unavailable, allowing through",
            remainingDays: 999,
            planDays: 30,
          },
        });
      }

      const normalizedEmail = userEmail.toLowerCase();
      const docRef = db.collection("subscriptions").doc(normalizedEmail);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(200).json({
          success: true,
          data: {
            hasVip: false,
            code: "VIP_DELETED",
            message: "Gói VIP của bạn đã bị xóa khỏi hệ thống",
          },
        });
      }

      const vipData = doc.data();
      let { expireAt, planDays, uid: vipUid } = vipData;

      // 🔄 AUTO-POPULATE: If uid is missing, add it to Firestore
      if (!vipUid) {
        console.info(`🔄 Auto-adding Firebase ID to ${normalizedEmail}: ${userLocalId}`);
        try {
          await docRef.update({ uid: userLocalId });
          vipUid = userLocalId; // Update local var for next check
        } catch (updateErr) {
          console.error("Auto-update Firebase ID error:", updateErr.message);
          // Don't fail here, continue with check
        }
      }

      // ✅ VERIFY: Check if Firebase ID matches
      if (vipUid && vipUid !== userLocalId) {
        console.warn(`❌ Firebase ID mismatch: request ID=${userLocalId}, VIP ID=${vipUid}`);
        return res.status(200).json({
          success: true,
          data: {
            hasVip: false,
            message: "Firebase ID không khớp với dữ liệu VIP đã lưu",
          },
        });
      }

      const now = Date.now();
      const isExpired = expireAt < now;
      const remainingDays = Math.ceil((expireAt - now) / (24 * 60 * 60 * 1000));

      // 📅 Log expireAt check
      if (isExpired) {
        console.warn(
          `❌ VIP expired for ${normalizedEmail}: expireAt=${new Date(expireAt).toISOString()}, now=${new Date(now).toISOString()}`
        );
      } else {
        console.info(
          `✅ VIP valid for ${normalizedEmail}: ${remainingDays} days remaining`
        );
      }

      return res.status(200).json({
        success: true,
        data: {
          hasVip: !isExpired,
          isExpired,
          expireAt,
          remainingDays: isExpired ? 0 : remainingDays,
          planDays,
        },
      });
    } catch (error) {
      console.error("❌ Lỗi checkVipStatus:", error.message);
      return res.status(500).json({
        success: false,
        message: "Lỗi kiểm tra VIP",
        error: error.message,
      });
    }
  }

  /**
   * Sync user Firebase ID to Firestore VIP record
   * Called when user first accesses app (after Firebase becomes available)
   * Purpose: Add uid to subscriptions even if Firebase was unavailable before
   */
  async syncUserUid(req, res) {
    try {
      const userEmail = req.user?.email;
      const userLocalId = req.user?.localId;

      if (!userEmail || !userLocalId) {
        return res.status(401).json({
          success: false,
          message: "Missing email or Firebase ID",
        });
      }

      if (!db) {
        console.warn("⚠️ Firebase not initialized for syncUserUid");
        return res.status(200).json({
          success: true,
          data: {
            synced: false,
            reason: "Firebase unavailable",
          },
        });
      }

      const normalizedEmail = userEmail.toLowerCase();
      const docRef = db.collection("subscriptions").doc(normalizedEmail);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(200).json({
          success: true,
          data: {
            synced: false,
            code: "VIP_DELETED",
            reason: "VIP subscription was deleted by admin",
          },
        });
      }

      const vipData = doc.data();
      const { uid: existingUid, expireAt, planDays } = vipData;
      const now = Date.now();
      const isExpired = expireAt < now;
      const remainingDays = Math.ceil((expireAt - now) / (24 * 60 * 60 * 1000));

      // If uid already exists and matches, no need to sync
      if (existingUid && existingUid === userLocalId) {
        console.info(`✅ UID already synced for ${userEmail}`);
        return res.status(200).json({
          success: true,
          data: {
            synced: false,
            reason: "UID already up-to-date",
            uid: userLocalId,
            expireAt,
            isExpired,
            remainingDays: isExpired ? 0 : remainingDays,
            planDays,
          },
        });
      }

      // If uid is missing OR doesn't match, update it
      console.info(
        `🔄 Syncing UID for ${userEmail}: ${existingUid || "missing"} → ${userLocalId}`
      );
      await docRef.update({ uid: userLocalId });

      return res.status(200).json({
        success: true,
        data: {
          synced: true,
          reason: "UID successfully synced to Firestore",
          uid: userLocalId,
          email: normalizedEmail,
          expireAt,
          isExpired,
          remainingDays: isExpired ? 0 : remainingDays,
          planDays,
        },
      });
    } catch (error) {
      console.error("❌ Lỗi syncUserUid:", error.message);
      return res.status(500).json({
        success: false,
        message: "Lỗi sync UID",
        error: error.message,
      });
    }
  }
}

module.exports = new ApiController()
