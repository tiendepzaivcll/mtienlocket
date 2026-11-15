const captionPresetStore = require("../services/CaptionPreset/store");

const fail = (res, error) =>
  res.status(error.status || 500).json({ success: false, message: error.message });

module.exports = {
  async list(req, res) {
    try {
      res.json({ success: true, data: await captionPresetStore.list() });
    } catch (error) {
      fail(res, error);
    }
  },

  async save(req, res) {
    try {
      const data = await captionPresetStore.save(req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      fail(res, error);
    }
  },

  async remove(req, res) {
    try {
      const data = await captionPresetStore.remove(req.query.section, req.params.presetId);
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error);
    }
  },
};
