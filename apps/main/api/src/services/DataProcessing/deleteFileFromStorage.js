const axios = require("axios");
const serverConfig = require("../../config/app.config");

const deleteFileFromStorageR2 = async (filePath) => {
  const { services } = serverConfig;
  if (!services.storageUrl) {
    return { success: false, error: "STORAGE_API_URL chưa được cấu hình; bỏ qua dọn file R2." };
  }
  try {
    const res = await axios.post(
      `${services.storageUrl}/api/delete`,
      { key: filePath }, // body
      {
        headers: {
          "Content-Type": "application/json",
          // Nếu có auth token nội bộ giữa servers:
          // Authorization: `Bearer ${YOUR_INTERNAL_SECRET_TOKEN}`,
        },
      },
    );

    // axios trả về data trực tiếp
    const data = res.data;

    if (data.success) {
      console.log("✅ Deleted processed object from R2");
      return { success: true, message: data.message };
    } else {
      console.error(
        "❌ Delete failed (R2)",
        data.error || "Unknown error",
      );
      return { success: false, error: data.error || "Delete failed" };
    }
  } catch (error) {
    console.error("❌ Failed to delete from R2", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  deleteFileFromStorageR2,
};
