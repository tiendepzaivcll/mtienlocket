import { CONFIG } from "@/config/webConfig";
import api from "@/lib/axios";

export const uploadFileAndGetInfoR2 = async (
  file,
  previewType = "other",
  localId
) => {
  if (!file) throw new Error("No file provided");

  const safeType = previewType.toLowerCase(); // image / video / other
  const timestamp = Date.now();
  const extension = file.name.split(".").pop(); // jpg, mp4...

  const fileName = `locketdio_${timestamp}_${localId}_cli${CONFIG.app.clientVersion}.${extension}`;

  const cleanContentType = file.type
    ? file.type.split(";")[0].trim().toLowerCase()
    : (safeType === "video" ? "video/mp4" : "image/jpeg");

  // === Bước 1: Gọi BE để lấy Presigned URL
  const res = await api.post(`${CONFIG.api.storage}/api/presignedV3`, {
    filename: fileName,
    contentType: cleanContentType,
    type: safeType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  });

  const { url, publicURL, key, expiresIn } = res.data.data;

  // === Bước 2: Upload file qua presigned URL
  const uploadRes = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": cleanContentType,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error("❌ Upload to R2 failed");
  }

  return {
    downloadURL: publicURL,
    metadata: {
      name: fileName,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      path: key,
    },
  };
};
