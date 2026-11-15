import axios from "axios";
import { CONFIG } from "@/config";
import api from "@/libs/axios";
import { assertJsonSerializable } from "@/utils/standardize/jsonSerializable";

const UPLOAD_MEDIA_URL = `${CONFIG.api.baseUrl}/locket/post`;
const UPLOAD_MEDIA_URL_V2 = "/locket/postMomentV2";

export const uploadMedia = async (formData, setUploadProgress) => {
  let timeOutId;
  try {
    const fileType = formData.get("images") ? "image" : "video";

    // Thời gian chờ tùy vào loại file
    timeOutId = setTimeout(
      () => {
        console.log("⏳ Uploading is taking longer than expected...");
      },
      fileType === "image" ? 5000 : 10000
    );

    const response = await axios.post(
      UPLOAD_MEDIA_URL,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (setUploadProgress && typeof setUploadProgress === "function") {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            let currentProgress = 0;
            if (percent > currentProgress) {
              const updateProgress = (target) => {
                if (currentProgress < target) {
                  currentProgress += 1;
                  setUploadProgress(currentProgress);
                  setTimeout(() => updateProgress(target), 50);
                }
              };
              updateProgress(percent);
            }
          }
        },
      }
    );

    clearTimeout(timeOutId);
    console.log("✅ Upload thành công");
    return response.data;
  } catch (error) {
    clearTimeout(timeOutId);

    // Log lỗi chi tiết hơn
    console.error("❌ Lỗi khi upload:", {
      status: error.response?.status,
      code: error.response?.data?.code || error.code,
      message: error.response?.data?.message || error.message,
    });

    throw error;
  }
};
export const uploadMediaV2 = async (payload) => {
  try {
    // Lấy mediaInfo từ payload
    const { mediaInfo } = payload;
    // Lấy type từ mediaInfo để xác định là ảnh hay video
    const fileType = mediaInfo.type;

    // Đặt timeout tùy theo loại tệp (ảnh hoặc video)
    const timeoutDuration =
      fileType === "image" ? 5000 : fileType === "video" ? 10000 : 5000;
    const timeoutId = setTimeout(() => {
      console.log("⏳ Uploading is taking longer than expected...");
    }, timeoutDuration);

    // Gửi request với payload và header Content-Type: application/json
    const response = await api.post(
      UPLOAD_MEDIA_URL_V2,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    clearTimeout(timeoutId); // Hủy timeout khi upload thành công
    console.log("✅ Upload thành công");
    return response.data;
  } catch (error) {
    console.error("❌ Lỗi khi upload:", {
      status: error.response?.status,
      code: error.response?.data?.code || error.code,
      message: error.response?.data?.message || error.message,
    });

    throw error;
  }
};
export const PostMoments = async (payload) => {
  let timeoutId;
  try {
    // Final defensive boundary: requests restored after an iOS/PWA sleep must
    // never pass cyclic browser/IndexedDB objects into Axios JSON encoding.
    const requestPayload = assertJsonSerializable(payload || {});
    // Lấy mediaInfo từ payload
    const { mediaInfo } = requestPayload;
    // Lấy type từ mediaInfo để xác định là ảnh hay video
    const fileType = mediaInfo.type;

    // Đặt timeout tùy theo loại tệp (ảnh hoặc video)
    const timeoutDuration =
      fileType === "image" ? 10000 : fileType === "video" ? 15000 : 5000;
    timeoutId = setTimeout(() => {
      console.log("⏳ Uploading is taking longer than expected...");
    }, timeoutDuration);

    // Gửi request như thường, headers không cần thêm Authorization vì đã cấu hình sẵn
    const response = await api.post(
      UPLOAD_MEDIA_URL_V2,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json", // vẫn có thể custom nếu cần
          ...(requestPayload?.clientUploadId
            ? { "Idempotency-Key": requestPayload.clientUploadId }
            : {}),
        },
      }
    );

    console.log("✅ Upload thành công");
    return response.data;
  } catch (error) {
    console.error("❌ Lỗi khi upload:", {
      status: error.response?.status,
      code: error.response?.data?.code || error.code,
      message: error.response?.data?.message || error.message,
    });

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
