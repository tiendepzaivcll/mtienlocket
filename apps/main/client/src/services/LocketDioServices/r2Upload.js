export const normalizeR2Presign = (data = {}) => {
  const result = {
    ...data,
    uploadUrl: data.uploadUrl || data.url,
    publicUrl: data.publicUrl || data.publicURL,
    path: data.path || data.key,
  };
  if (![result.uploadUrl, result.publicUrl, result.path].every(
    (value) => typeof value === "string" && value.trim(),
  )) {
    throw new Error("R2 presign response is missing uploadUrl, publicUrl or path");
  }
  return result;
};

export const createR2Uploader = ({ api, storageUrl, clientVersion, fetchUpload }) =>
  async (file, previewType = "other", localId) => {
    if (!file) throw new Error("No file provided");
    if (!storageUrl?.trim()) throw new Error("Chưa cấu hình VITE_STORAGE_API_URL cho R2 riêng.");
    const baseUrl = storageUrl.trim().replace(/\/+$/, "");
    const uploadedAt = new Date().toISOString();
    const extension = file.name.split(".").pop();
    const filename = `t97_${Date.now()}_${localId}_cli${clientVersion}.${extension}`;
    const res = await api.post(`${baseUrl}/api/presignedV3`, {
      filename,
      contentType: file.type,
      type: previewType.toLowerCase(),
      size: file.size,
      uploadedAt,
    }, {
      skipMemberToken: true,
      withCredentials: false,
    });

    const storageData = normalizeR2Presign(res.data?.data);
    const uploadUrl = baseUrl.endsWith("/storage-api")
      ? `/storage-upload-proxy?url=${encodeURIComponent(storageData.uploadUrl)}`
      : storageData.uploadUrl;
    const response = await fetchUpload(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) {
      const error = new Error(`Upload lên R2 thất bại (${response.status || "network"})`);
      error.status = response.status || 502;
      error.code = "R2_UPLOAD_FAILED";
      throw error;
    }

    return {
      ...storageData,
      name: storageData.name || filename,
      size: storageData.size || file.size,
      uploadedAt: storageData.uploadedAt || uploadedAt,
    };
  };
