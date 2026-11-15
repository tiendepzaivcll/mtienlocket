import { instanceMain } from "@/libs";

export const getInfoWeather = async ({ lat, lon }) => {
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
    console.warn("⚠️ Tọa độ thời tiết không hợp lệ");
    return null;
  }

  try {
    const res = await instanceMain.post("/api/weatherV2", {
      lat: latitude,
      lon: longitude,
    });

    if (res?.data?.status === "success") {
      return res.data.data;
    }

    console.error("❌ getInfoWeather: Không có dữ liệu hợp lệ", res?.data);
    return null;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi getInfoWeather:", error.message);
    return null;
  }
};
