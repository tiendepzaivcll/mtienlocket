const {
  findModelOption,
  getSettingsStatus,
  isProviderConfigured,
  settingsStore,
} = require("../services/AiFilter/settingsStore");

exports.get = async (_req, res) => {
  const data = await getSettingsStatus({ force: true });
  res.json({ success: true, data });
};

exports.save = async (req, res) => {
  const modelId = req.body?.modelId;
  const kiraApiKey = req.body?.kiraApiKey;

  const option = modelId ? findModelOption(modelId) : null;
  if (!option && !kiraApiKey) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng chọn mô hình AI hoặc nhập Kira API Key.",
    });
  }

  if (option && option.supportsImageGeneration === false) {
    return res.status(409).json({
      success: false,
      code: "AI_FILTER_MODEL_NOT_IMAGE",
      message: "Model này chỉ hỗ trợ chat và đọc ảnh, không tạo được ảnh. Hãy chọn một mô hình tạo ảnh cho AI Filter.",
    });
  }

  try {
    await settingsStore.save({
      modelId: option ? option.id : undefined,
      kiraApiKey: typeof kiraApiKey === "string" ? kiraApiKey.trim() : undefined,
    });
    const data = await getSettingsStatus({ force: true });
    return res.json({
      success: true,
      data,
      message: "Đã cập nhật cấu hình AI Filter thành công.",
    });
  } catch (error) {
    return res.status(error.status || 503).json({
      success: false,
      message: error.message || "Không lưu được cấu hình AI Filter.",
    });
  }
};
