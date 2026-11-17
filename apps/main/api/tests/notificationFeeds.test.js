const test = require("node:test");
const assert = require("node:assert/strict");
const { notificationToArticle, notificationsToArticles } = require("../src/services/Notifications/newsFeed");

const notice = (overrides = {}) => ({
  id: "first", title: "Thông báo", message: "Nội dung thông báo", pinned: false,
  created_at: "2026-11-16T06:00:00.000Z", updated_at: "2026-11-17T06:00:00.000Z",
  author: "MTIEN", ...overrides,
});

test("a notice projects to a reloadable article without a second storage record", () => {
  const input = notice();
  assert.deepEqual(notificationToArticle(input), {
    id: "first", slug: "notification-first", title: "Thông báo",
    description: input.message, message: input.message, author: "MTIEN", category: "announcement",
    published_at: input.created_at, updated_at: input.updated_at, pinned: false,
    thumbnail: null, source: "admin-notification",
    content: { blocks: [{ type: "text", data: input.message, className: "whitespace-pre-wrap break-words" }] },
  });
});

test("admin markup remains escaped text rather than executable HTML or embedded links", () => {
  const message = '<img src=x onerror="alert(1)">\n<script>alert(2)</script>\nhttps://example.com/?a=1&b=2';
  const article = notificationToArticle(notice({ title: "<b>Title</b>", message,
    author: "forged", internalToken: "never public" }));
  assert.equal(article.title, "<b>Title</b>");
  assert.equal(article.description, message);
  assert.deepEqual(article.content.blocks, [{ type: "text", data: message, className: "whitespace-pre-wrap break-words" }]);
  assert.equal(article.author, "MTIEN");
  assert.equal(article.internalToken, undefined);
  assert.equal(article.content.blocks.some((block) => block.type === "html" || block.link), false);
});

test("article order matches pinned-first then created-newest without promoting edited old posts", () => {
  const posts = notificationsToArticles([
    notice({ id: "old", updated_at: "2026-11-20T06:00:00Z" }),
    notice({ id: "recent", created_at: "2026-11-17T06:00:00Z" }),
    notice({ id: "pinned", pinned: true, created_at: "2026-11-15T06:00:00Z" }),
  ]);
  assert.deepEqual(posts.map((post) => post.id), ["pinned", "recent", "old"]);
  assert.deepEqual(posts.map((post) => post.slug), ["notification-pinned", "notification-recent", "notification-old"]);
});
