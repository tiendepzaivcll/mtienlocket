import { useState, useEffect } from "react";
import { getInfoWeather } from "@/services";
import {
  isCacheNearLocation,
  readWeatherCache,
  WEATHER_CACHE_DURATION_MS,
  writeWeatherCache,
} from "./weatherCache";

const FALLBACK_LOCATION = {
  latitude: 10.7769,
  longitude: 106.7009,
};

export function useLocationWeather() {
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let isActive = true;
    let refreshTimer;
    const parsedCache = readWeatherCache(localStorage);

    if (isValidWeather(parsedCache?.weather)) {
      setLocation(parsedCache.location);
      setWeather(parsedCache.weather);
    }

    const fetchWeather = async ({ latitude, longitude }) => {
      try {
        const data = await getInfoWeather({ lat: latitude, lon: longitude });

        if (isActive && data?.location && isValidWeather(data.current)) {
          setLocation(data.location);
          setWeather(data.current);

          writeWeatherCache(localStorage, {
            location: data.location,
            weather: data.current,
          });
        }
      } catch {
        // Weather is a nice-to-have caption; keep UI quiet on failure.
      }
    };

    const startWeatherUpdates = (coordinates) => {
      const cacheIsNear = isCacheNearLocation(parsedCache, coordinates);
      if (!cacheIsNear || !isValidWeather(parsedCache?.weather)) {
        setWeather(null);
      }
      fetchWeather(coordinates);
      refreshTimer = window.setInterval(
        () => fetchWeather(coordinates),
        WEATHER_CACHE_DURATION_MS,
      );
    };

    if (!navigator.geolocation) {
      startWeatherUpdates(FALLBACK_LOCATION);
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          startWeatherUpdates({ latitude, longitude });
        },
        () => startWeatherUpdates(FALLBACK_LOCATION),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60 * 1000,
        },
      );
    }

    return () => {
      isActive = false;
      if (refreshTimer) window.clearInterval(refreshTimer);
    };
  }, []);

  return { location, weather };
}

const isValidWeather = (weather) =>
  weather &&
  weather.temp_c_rounded !== undefined &&
  weather.temp_c !== undefined &&
  weather.wk_condition;
