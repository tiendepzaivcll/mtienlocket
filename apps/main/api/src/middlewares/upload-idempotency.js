const {
  runIdempotentUpload,
} = require("../services/LocketMoment/uploadIdempotency");

const DOWNSTREAM_TIMEOUT_MS = 4 * 60 * 1000;

function getClientUploadId(req) {
  const header = req.get?.("Idempotency-Key") || req.headers?.["idempotency-key"];
  const value = String(header || req.body?.clientUploadId || "").trim();
  return value || null;
}

function isValidClientUploadId(value) {
  return Boolean(
    value && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value),
  );
}

function captureControllerResponse(res, next) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const originalJson = res.json.bind(res);

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      res.removeListener("finish", onFinish);
      callback();
    };

    const timer = setTimeout(() => {
      finish(() => {
        const error = new Error("UPLOAD_DOWNSTREAM_TIMEOUT");
        error.status = 504;
        error.code = "UPLOAD_DOWNSTREAM_TIMEOUT";
        reject(error);
      });
    }, DOWNSTREAM_TIMEOUT_MS);

    res.json = (body) => {
      const statusCode = Number(res.statusCode || 200);
      if (statusCode >= 200 && statusCode < 300) {
        finish(() => resolve({ statusCode, body }));
      } else {
        finish(() => {
          const error = new Error("UPLOAD_DOWNSTREAM_RESPONSE_SENT");
          error.status = statusCode;
          error.code = "UPLOAD_DOWNSTREAM_RESPONSE_SENT";
          error.downstreamResponseSent = true;
          error.responseBody = body;
          reject(error);
        });
      }
      return originalJson(body);
    };

    function onFinish() {
      if (settled) return;
      finish(() => {
        const error = new Error("UPLOAD_NON_JSON_RESPONSE");
        error.status = Number(res.statusCode || 500);
        error.code = "UPLOAD_NON_JSON_RESPONSE";
        error.downstreamResponseSent = true;
        reject(error);
      });
    }

    res.once("finish", onFinish);

    try {
      next();
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

async function uploadIdempotency(req, res, next) {
  const clientUploadId = getClientUploadId(req);
  const userId = req.user?.localId || req.user?.uid;

  if (!clientUploadId || !userId) return next();
  if (!isValidClientUploadId(clientUploadId)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_IDEMPOTENCY_KEY",
      message: "Idempotency-Key không hợp lệ",
    });
  }

  try {
    const outcome = await runIdempotentUpload({
      userId,
      clientUploadId,
      work: () => captureControllerResponse(res, next),
    });

    if (outcome.replayed && !res.headersSent) {
      return res
        .status(Number(outcome.result?.statusCode || 200))
        .json(outcome.result?.body ?? { success: true });
    }
  } catch (error) {
    if (res.headersSent) return;
    if (error?.downstreamResponseSent && error?.responseBody !== undefined) {
      return res
        .status(Number(error.status || 500))
        .json(error.responseBody);
    }
    next(error);
  }
}

module.exports = { uploadIdempotency, getClientUploadId, isValidClientUploadId };
