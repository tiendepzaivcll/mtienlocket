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
  const option = findModelOption(req.body?.modelId);
  if (!option) {
    return res.status(400).json({
      success: false,
      message: "Mô hình AI không được hỗ trợ.",
    });
  }

  if (option.supportsImageGeneration === false) {
    return res.status(409).json({
      success: false,
      code: "AI_FILTER_MODEL_NOT_IMAGE",
      message: "HY4 Flash Free chỉ hỗ trợ chat và đọc ảnh, không tạo ảnh. Hãy chọn một mô hình tạo ảnh cho AI Filter.",
    });
  }

  if (!isProviderConfigured(option.provider)) {
    return res.status(409).json({
      success: false,
      message:
        option.provider === "kira"
          ? "Server chưa có KIRA_API_KEY."
          : "Server chưa có Cloudflare Account ID hoặc Workers AI API token.",
    });
  }

  try {
    await settingsStore.save(option.id);
    const data = await getSettingsStatus();
    return res.json({
      success: true,
      data,
      message: "Đã đổi mô hình AI và áp dụng ngay.",
    });
  } catch (error) {
    return res.status(error.status || 503).json({
      success: false,
      message: error.message || "Không lưu được mô hình AI.",
    });
  }
};
