const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_STALE_MS = 60 * 60 * 1000;

const parseCoordinates = (lat, lon) => {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    const error = new Error("Tọa độ không hợp lệ.");
    error.code = "INVALID_COORDINATES";
    error.status = 400;
    throw error;
  }
  return { lat: latitude, lon: longitude };
};

const createWeatherCache = ({
  ttlMs = DEFAULT_TTL_MS,
  staleMs = DEFAULT_STALE_MS,
} = {}) => {
  const entries = new Map();
  const keyFor = ({ lat, lon }) => `${lat.toFixed(2)}:${lon.toFixed(2)}`;

  return {
    get(coordinates, { allowStale = false } = {}) {
      const entry = entries.get(keyFor(coordinates));
      if (!entry) return null;
      const ageMs = Date.now() - entry.timestamp;
      const maxAge = allowStale ? staleMs : ttlMs;
      if (ageMs > maxAge) {
        if (ageMs > staleMs) entries.delete(keyFor(coordinates));
        return null;
      }
      return { data: entry.data, ageMs, stale: ageMs > ttlMs };
    },
    set(coordinates, data) {
      entries.set(keyFor(coordinates), { timestamp: Date.now(), data });
      return data;
    },
    clear() {
      entries.clear();
    },
  };
};

module.exports = {
  createWeatherCache,
  parseCoordinates,
};
