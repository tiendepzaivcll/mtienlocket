const { createHash, timingSafeEqual } = require("node:crypto");

const digest = (value) => createHash("sha256").update(value).digest();

function verifyInternalToken(req, res, next) {
  const expected = String(process.env.STORAGE_INTERNAL_TOKEN || "").trim();
  if (!expected) {
    return res.status(503).json({ error: "STORAGE_INTERNAL_TOKEN is not configured" });
  }
  const supplied = req.headers["x-storage-token"];
  if (typeof supplied !== "string" || !timingSafeEqual(digest(supplied), digest(expected))) {
    return res.status(401).json({ error: "Unauthorized storage request" });
  }
  return next();
}

module.exports = { verifyInternalToken };
