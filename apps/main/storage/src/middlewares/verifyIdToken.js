const https = require("node:https");
const jwt = require("jsonwebtoken");

const CERTIFICATES_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

function fetchCertificates() {
  return new Promise((resolve, reject) => {
    const request = https.get(CERTIFICATES_URL, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error("Firebase certificates unavailable"));
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) request.destroy(new Error("Certificate response too large"));
      });
      response.on("error", reject);
      response.on("end", () => {
        try {
          const certificates = JSON.parse(body);
          if (!certificates || typeof certificates !== "object" || Array.isArray(certificates)) throw new Error("Invalid certificates");
          const maxAge = Number(/max-age=(\d+)/i.exec(response.headers["cache-control"] || "")?.[1] || 300);
          resolve({ certificates, maxAge: Math.min(maxAge, 3600) });
        } catch (error) {
          reject(error);
        }
      });
    });
    // Bound the complete request, including a peer that trickles response data.
    const timeout = setTimeout(() => request.destroy(new Error("Certificate request timed out")), 5000);
    request.once("close", () => clearTimeout(timeout));
    request.on("error", reject);
  });
}

function createCertificateProvider(load = fetchCertificates, now = Date.now) {
  let cached;
  let expiresAt = 0;
  let loadedAt = 0;
  let pending;
  return async (kid) => {
    // Refresh once for a newly rotated key, while bounding unknown-kid traffic.
    if (cached && now() < expiresAt && (!kid || Object.hasOwn(cached, kid) || now() - loadedAt < 60_000)) return cached;
    if (!pending) {
      pending = load().then(({ certificates, maxAge }) => {
        cached = certificates;
        loadedAt = now();
        expiresAt = now() + maxAge * 1000;
        return cached;
      }).finally(() => { pending = undefined; });
    }
    return pending;
  };
}

const getCertificates = createCertificateProvider();

function createVerifyIdToken({
  getProjectId = () => process.env.FIREBASE_AUTH_PROJECT_ID,
  certificates = getCertificates,
  now = Date.now,
} = {}) {
  return async (req, res, next) => {
    const projectId = String(getProjectId() || "").trim();
    if (!projectId) return res.status(503).json({ error: "FIREBASE_AUTH_PROJECT_ID is not configured" });
    const authorization = req.headers.authorization;
    const token = typeof authorization === "string" && /^Bearer ([^\s]+)$/.exec(authorization)?.[1];
    let decoded;
    try {
      decoded = token && jwt.decode(token, { complete: true });
    } catch {
      return res.status(401).json({ error: "Invalid Firebase ID token" });
    }
    if (!decoded || decoded.header.alg !== "RS256" || typeof decoded.header.kid !== "string") {
      return res.status(401).json({ error: "Invalid Firebase ID token" });
    }
    let keys;
    try {
      keys = await certificates(decoded.header.kid);
    } catch {
      return res.status(503).json({ error: "Firebase token verification is temporarily unavailable" });
    }
    try {
      if (!Object.hasOwn(keys, decoded.header.kid)) throw new Error("Unknown signing key");
      const clockTimestamp = Math.floor(now() / 1000);
      const payload = jwt.verify(token, keys[decoded.header.kid], {
        algorithms: ["RS256"],
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
        clockTimestamp,
      });
      if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128 ||
          !Number.isFinite(payload.exp) || !Number.isFinite(payload.iat) || payload.iat > clockTimestamp) {
        throw new Error("Invalid Firebase claims");
      }
      req.user = {
        idToken: token,
        localId: payload.sub,
        uid: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        exp: payload.exp,
        iat: payload.iat,
      };
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired Firebase ID token" });
    }
  };
}

module.exports = {
  verifyIdToken: createVerifyIdToken(),
  createVerifyIdToken,
  createCertificateProvider,
};
