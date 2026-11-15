const telemetry = {
  startedAt: Date.now(),
  requests: 0,
  errors5xx: 0,
  totalDurationMs: 0,
  byRoute: new Map(),
};

function normalizeRoute(method, path) {
  const safePath = String(path || "/")
    .split("?")[0]
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ":id")
    .replace(/\/[A-Za-z0-9_-]{32,}(?=\/|$)/g, "/:id");
  return `${String(method || "GET").toUpperCase()} ${safePath}`;
}

function requestTelemetry(req, res, next) {
  const startedAt = Date.now();
  res.once("finish", () => {
    const durationMs = Date.now() - startedAt;
    const route = normalizeRoute(req.method, req.originalUrl || req.url);
    telemetry.requests += 1;
    telemetry.totalDurationMs += durationMs;
    if (res.statusCode >= 500) telemetry.errors5xx += 1;

    const current = telemetry.byRoute.get(route) || {
      requests: 0,
      errors5xx: 0,
      totalDurationMs: 0,
    };
    current.requests += 1;
    current.totalDurationMs += durationMs;
    if (res.statusCode >= 500) current.errors5xx += 1;
    telemetry.byRoute.set(route, current);
  });
  next();
}

function getTelemetrySnapshot() {
  const busiestRoutes = [...telemetry.byRoute.entries()]
    .sort((a, b) => b[1].requests - a[1].requests)
    .slice(0, 10)
    .map(([route, value]) => ({
      route,
      requests: value.requests,
      errors5xx: value.errors5xx,
      averageDurationMs: value.requests
        ? Math.round(value.totalDurationMs / value.requests)
        : 0,
    }));

  return {
    since: new Date(telemetry.startedAt).toISOString(),
    requests: telemetry.requests,
    errors5xx: telemetry.errors5xx,
    averageDurationMs: telemetry.requests
      ? Math.round(telemetry.totalDurationMs / telemetry.requests)
      : 0,
    busiestRoutes,
  };
}

module.exports = { requestTelemetry, getTelemetrySnapshot, normalizeRoute };
