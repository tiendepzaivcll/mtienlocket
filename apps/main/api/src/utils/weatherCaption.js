const includesAny = (value, terms) =>
  terms.some((term) => value.includes(term));

const WEATHER_SYMBOLS = new Set([
  "wind",
  "sun.max.fill",
  "moon.fill",
  "cloud.fill",
  "cloud.sun.fill",
  "cloud.moon.fill",
  "cloud.rain.fill",
  "cloud.heavyrain.fill",
  "cloud.drizzle.fill",
  "cloud.bolt.rain.fill",
  "cloud.hail.fill",
  "cloud.snow.fill",
  "cloud.fog.fill",
]);

const CLOUDY_CONDITIONS = new Set([
  "blowingdust",
  "blowingsnow",
  "blizzard",
  "cloudy",
  "drizzle",
  "foggy",
  "flurries",
  "freezingrain",
  "freezingdrizzle",
  "hail",
  "haze",
  "heavyrain",
  "heavysnow",
  "hurricane",
  "isolatedthunderstorms",
  "mostlycloudy",
  "rain",
  "scatteredthunderstorms",
  "sleet",
  "snow",
  "smoky",
  "strongstorms",
  "thunderstorms",
  "tropicalstorm",
  "windy",
  "wintrymix",
]);
const TWILIGHT_SUPPORTED_CONDITIONS = new Set([
  "breezy",
  "clear",
  "frigid",
  "hot",
  "mostlyclear",
  "partlycloudy",
  "sunflurries",
  "sunshowers",
]);
const BACKGROUND_CONFIG = {
  clearDay: ["#2D9AFF", "#6BDCFF"],
  clearNight: ["#370C6F", "#575CD4"],
  sunrise: ["#AE88FF", "#FFC1AD"],
  sunset: ["#6C77DA", "#FFC896"],
  cloudy: ["#7790A6", "#AAAAAA"],
};
const TWILIGHT_WINDOW_MS = 30 * 60 * 1000;

const isWeatherDaylight = (weather = {}) => {
  weather = weather && typeof weather === "object" ? weather : {};
  if (weather.is_day !== undefined) {
    return weather.is_day === 1 || weather.is_day === true;
  }
  if (weather.is_daylight !== undefined) return weather.is_daylight === true;
  return true;
};

const getWeatherTemperatureC = (weather = {}) => {
  weather = weather && typeof weather === "object" ? weather : {};
  const celsius = Number(weather.temp_c_rounded ?? weather.temp_c);
  if (Number.isFinite(celsius)) return celsius;

  const fahrenheit = Number(weather.temperature);
  return Number.isFinite(fahrenheit) ? ((fahrenheit - 32) * 5) / 9 : undefined;
};

const getWeatherTemperatureF = (weather = {}) => {
  weather = weather && typeof weather === "object" ? weather : {};
  const fahrenheit = Number(weather.temperature);
  if (Number.isFinite(fahrenheit)) return fahrenheit;

  const celsius = Number(weather.temp_c ?? weather.temp_c_rounded);
  return Number.isFinite(celsius) ? (celsius * 9) / 5 + 32 : undefined;
};

const getCondition = (weather = {}) => {
  const source = weather && typeof weather === "object" ? weather : {};
  return String(
    source.symbol_name || source.wk_condition || source.condition || "",
  ).toLowerCase();
};

const getTimestampMs = (weather, timestampKey, isoKey) => {
  const timestamp = Number(weather?.[timestampKey]);
  if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
  const parsed = Date.parse(weather?.[isoKey]);
  return Number.isFinite(parsed) ? parsed : null;
};

const getWeatherGradientKey = (weather = {}, now = Date.now()) => {
  const condition = getCondition(weather).replace(/[^a-z]/g, "");
  if (!isWeatherDaylight(weather)) return "clearNight";
  if (CLOUDY_CONDITIONS.has(condition)) return "cloudy";

  if (TWILIGHT_SUPPORTED_CONDITIONS.has(condition)) {
    const sunrise = getTimestampMs(weather, "sunrise_timestamp_ms", "sunrise");
    const sunset = getTimestampMs(weather, "sunset_timestamp_ms", "sunset");
    if (sunrise && Math.abs(now - sunrise) <= TWILIGHT_WINDOW_MS) return "sunrise";
    if (sunset && Math.abs(now - sunset) <= TWILIGHT_WINDOW_MS) return "sunset";
  }
  return "clearDay";
};

const getWeatherSymbol = (weather = {}) => {
  weather = weather && typeof weather === "object" ? weather : {};
  const code = Number(weather.weather_code);
  const condition = getCondition(weather);
  const isDay = isWeatherDaylight(weather);

  if (WEATHER_SYMBOLS.has(condition)) return condition;
  if (condition === "wind" || condition.includes("windy")) return "wind";
  if (Number.isFinite(code)) {
    if ((code >= 200 && code <= 232) || [95, 96, 99].includes(code)) {
      return "cloud.bolt.rain.fill";
    }
    if ((code >= 300 && code <= 321) || [51, 53, 55].includes(code)) {
      return "cloud.drizzle.fill";
    }
    if (
      (code >= 500 && code <= 531) ||
      [61, 63, 65, 80, 81, 82].includes(code)
    ) {
      return [502, 503, 504, 522].includes(code)
        ? "cloud.heavyrain.fill"
        : "cloud.rain.fill";
    }
    if ((code >= 600 && code <= 622) || [71, 73, 75].includes(code)) {
      return "cloud.snow.fill";
    }
    if ((code >= 701 && code <= 762) || [45, 48].includes(code)) {
      return "cloud.fog.fill";
    }
    if (code === 771 || code === 781) return "wind";
    if ([0, 1, 800, 1000].includes(code)) {
      return isDay ? "sun.max.fill" : "moon.fill";
    }
    if ([2, 801, 1003].includes(code)) {
      return isDay ? "cloud.sun.fill" : "cloud.moon.fill";
    }
    if ([3, 802, 803, 804, 1006, 1009].includes(code)) return "cloud.fill";
  }

  if (includesAny(condition, ["thunder", "storm", "dông", "sấm"])) {
    return "cloud.bolt.rain.fill";
  }
  if (includesAny(condition, ["sleet", "hail", "freezing", "mưa đá"])) {
    return "cloud.hail.fill";
  }
  if (includesAny(condition, ["snow", "blizzard", "tuyết"])) {
    return "cloud.snow.fill";
  }
  if (includesAny(condition, ["heavy rain", "heavyrain", "mưa lớn"])) {
    return "cloud.heavyrain.fill";
  }
  if (includesAny(condition, ["rain", "shower", "mưa"])) {
    return "cloud.rain.fill";
  }
  if (includesAny(condition, ["drizzle", "mưa phùn"])) {
    return "cloud.drizzle.fill";
  }
  if (includesAny(condition, ["fog", "mist", "haze", "sương"])) {
    return "cloud.fog.fill";
  }
  if (includesAny(condition, ["partly", "mostlyclear", "ít mây"])) {
    return isDay ? "cloud.sun.fill" : "cloud.moon.fill";
  }
  if (includesAny(condition, ["cloud", "mây"])) return "cloud.fill";
  return isDay ? "sun.max.fill" : "moon.fill";
};

const getWeatherColors = (weather = {}, now = Date.now()) =>
  BACKGROUND_CONFIG[getWeatherGradientKey(weather, now)] ||
  BACKGROUND_CONFIG.clearDay;

module.exports = {
  getWeatherColors,
  getWeatherGradientKey,
  getWeatherSymbol,
  getWeatherTemperatureC,
  getWeatherTemperatureF,
  isWeatherDaylight,
};
