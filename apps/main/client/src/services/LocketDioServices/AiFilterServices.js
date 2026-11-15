import api from "@/libs/axios";
import { uploadFileAndGetInfoR2 } from "./StorageServices";
import { getToken } from "@/utils";

export const fetchAiFilters = async () => {
  const response = await api.get("/api/ai-filters");
  return response.data?.data?.groups || [];
};

export const generateAiFilteredImage = async (file, filterId) => {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("AI Filter chỉ hỗ trợ ảnh.");
  }

  const { localId } = getToken() || {};
  const uploaded = await uploadFileAndGetInfoR2(file, "image", localId);
  const imageUrl = uploaded.publicUrl;
  if (!imageUrl) {
    throw new Error("R2 không trả về publicUrl cho ảnh đầu vào.");
  }

  const response = await api.post("/api/ai-filters/generate", {
    imageUrl,
    filterId,
  });
  return {
    ...response.data?.data,
    input: uploaded,
  };
};

export const aiImageResultToFile = async ({ imageBase64, mimeType, filterId }) => {
  if (!imageBase64) {
    throw new Error("Dịch vụ AI không trả về dữ liệu ảnh.");
  }
  const type = mimeType || "image/png";
  const response = await fetch(`data:${type};base64,${imageBase64}`);
  const blob = await response.blob();
  const extension = type.includes("jpeg") ? "jpg" : type.split("/")[1] || "png";
  return new File([blob], `t97-ai-${filterId || Date.now()}.${extension}`, {
    type,
  });
};
