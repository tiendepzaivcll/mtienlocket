const { projectNotification, sortNotifications } = require("./store");

function notificationToArticle(value) {
  const item = projectNotification(value);
  return {
    id: item.id,
    slug: `notification-${item.id}`,
    title: item.title,
    description: item.message,
    message: item.message,
    author: "MTIEN",
    category: "announcement",
    published_at: item.created_at,
    updated_at: item.updated_at,
    pinned: item.pinned,
    thumbnail: null,
    source: "admin-notification",
    // The news renderer escapes text blocks. Never interpret admin prose as HTML.
    content: {
      blocks: [{ type: "text", data: item.message, className: "whitespace-pre-wrap break-words" }],
    },
  };
}

function notificationsToArticles(items) {
  return sortNotifications(items.map(projectNotification)).map(notificationToArticle);
}

module.exports = { notificationToArticle, notificationsToArticles };
