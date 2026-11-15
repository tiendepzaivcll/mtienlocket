const baseUrl = String(
  process.env.API_BASE_URL || "http://localhost:5001",
).replace(/\/+$/, "");

async function checkJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

async function run() {
  const health = await checkJson("/health");
  if (health.status !== "ok") {
    throw new Error(`/health is ${health.status || "unknown"}`);
  }
  if (!health.checks?.deployment?.ready) {
    throw new Error(
      `deployment missing: ${health.checks?.deployment?.missingKeys?.join(", ")}`,
    );
  }

  const socketResponse = await fetch(
    `${baseUrl}/socket.io/?EIO=4&transport=polling`,
    { signal: AbortSignal.timeout(10_000) },
  );
  const socketHandshake = await socketResponse.text();
  if (!socketResponse.ok || !socketHandshake.startsWith("0{")) {
    throw new Error("Socket.IO handshake endpoint is unavailable");
  }

  console.log(`Smoke OK: ${baseUrl}`);
  console.log(
    `health=${health.status} deployment=${health.checks.deployment.ready} socket=ready`,
  );
}

run().catch((error) => {
  console.error(`Smoke failed: ${error.message}`);
  process.exitCode = 1;
});
