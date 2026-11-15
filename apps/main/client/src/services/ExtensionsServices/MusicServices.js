import api from "@/libs/axios";

export const getInfoMusicByUrl = async (url, platform) => {
  if (!url || !platform) {
    throw new Error("Thiếu link hoặc nền tảng nhạc.");
  }

  try {
    const res = await api.post("/api/getInfoMusic", { url, platform });

    if (res?.data?.status === "success") {
      return res.data.data;
    }

    throw new Error(res?.data?.message || "Không có dữ liệu nhạc hợp lệ.");
  } catch (error) {
    console.error("🚨 Lỗi khi gọi getInfoMusicByUrl:", error.message);
    throw new Error(
      error.response?.data?.message || error.message || "Không thể lấy thông tin bài hát.",
    );
  }
};
