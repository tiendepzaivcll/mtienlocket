const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY;
const WEATHER_API_URL = "https://api.weatherapi.com/v1/current.json";

export const getInfoWeather = async ({ lat, lon }) => {
  if (!WEATHER_API_KEY) {
    console.warn("VITE_WEATHER_API_KEY is not configured");
    return null;
  }

  if (!lat || !lon) {
    console.warn("⚠️ Thiếu lat or lon");
    return null;
  }

  try {
    const response = await fetch(
      `${WEATHER_API_URL}?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`
    );

    if (!response.ok) {
      console.error("❌ getInfoWeather: API error", response.status);
      return null;
    }

    const data = await response.json();

    if (data?.location && data?.current) {
      // Format data to match expected structure
      return {
        location: {
          name: data.location.name,
          region: data.location.region,
          country: data.location.country,
          localtime: data.location.localtime,
        },
        current: {
          temp_c: data.current.temp_c,
          temp_c_rounded: Math.round(data.current.temp_c),
          temp_f: data.current.temp_f,
          condition: data.current.condition.text,
          icon: data.current.condition.icon,
          humidity: data.current.humidity,
          wind_kph: data.current.wind_kph,
          feelslike_c: data.current.feelslike_c,
          uv: data.current.uv,
        },
      };
    }

    console.error("❌ getInfoWeather: Không có dữ liệu hợp lệ", data);
    return null;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi getInfoWeather:", error.message);
    return null;
  }
};
