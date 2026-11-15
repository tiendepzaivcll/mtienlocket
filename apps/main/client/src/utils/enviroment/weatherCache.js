export const WEATHER_CACHE_KEY = "weather_cache_v6";
export const WEATHER_CACHE_DURATION_MS = 10 * 60 * 1000;
const MOVE_THRESHOLD_DEG = 0.015;

export const readWeatherCache = (storage, now = Date.now()) => {
  try {
    const raw = storage?.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.weather || now - Number(parsed.timestamp) >= WEATHER_CACHE_DURATION_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const writeWeatherCache = (storage, data, now = Date.now()) => {
  try {
    storage?.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({ ...data, timestamp: now }),
    );
  } catch {
    // Weather cache is optional (private mode and quota failures are harmless).
  }
};

export const isCacheNearLocation = (cached, coordinates) => {
  const cachedLat = Number(cached?.location?.lat);
  const cachedLon = Number(cached?.location?.lon);
  const latitude = Number(coordinates?.latitude);
  const longitude = Number(coordinates?.longitude);
  return (
    [cachedLat, cachedLon, latitude, longitude].every(Number.isFinite) &&
    Math.abs(cachedLat - latitude) < MOVE_THRESHOLD_DEG &&
    Math.abs(cachedLon - longitude) < MOVE_THRESHOLD_DEG
  );
};
