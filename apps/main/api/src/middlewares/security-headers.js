function securityHeaders(req, res, next) {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()",
  );
  res.setHeader(
    "Content-Security-Policy-Report-Only",
    "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  );

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
}

module.exports = { securityHeaders };
