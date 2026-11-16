const notificationStore = require("../services/Notifications/store");

function createNotificationController(store = notificationStore) {
  const fail = (res, error) => res.set("Cache-Control", "no-store").status(error.status || 500).json({
    success: false,
    code: error.code || "NOTIFICATIONS_ERROR",
    message: error.status ? error.message : "Không xử lý được thông báo. Vui lòng thử lại.",
  });

  return {
    async list(_req, res) {
      try { res.set("Cache-Control", "no-store").json({ success: true, data: await store.list({ force: true }) }); }
      catch (error) { fail(res, error); }
    },
    async create(req, res) {
      try { res.status(201).json({ success: true, data: await store.create(req.body) }); }
      catch (error) { fail(res, error); }
    },
    async update(req, res) {
      try { res.json({ success: true, data: await store.update(req.params.id, req.body) }); }
      catch (error) { fail(res, error); }
    },
    async remove(req, res) {
      try { await store.remove(req.params.id); res.json({ success: true }); }
      catch (error) { fail(res, error); }
    },
    async publicList(_req, res) {
      try {
        const items = await store.list();
        res.set("Cache-Control", "no-store").json({
          success: true, notifications: items.map(notificationStore.projectNotification),
        });
      } catch (error) { fail(res, error); }
    },
  };
}

module.exports = { ...createNotificationController(), createNotificationController };
