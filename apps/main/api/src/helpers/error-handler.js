const logEvents = require("./log-events");
const { v4: uuid } = require("uuid");

module.exports = (err, req, res, next) => {
    const errorId = uuid();
    const isMalformedJson = err?.type === "entity.parse.failed";
    const status = isMalformedJson ? 400 : (err.status || 500);
    
    const production = process.env.NODE_ENV === "production";
    console.error("🔴 ERROR HANDLER:", {
      errorId,
      message: err.message,
      status,
      code: err.code,
      ...(!production
        ? { stack: err.stack, data: err.data || err.response?.data }
        : {}),
    });
    
    logEvents(
        `idError ----- ${errorId} ----- ${req.url} ----- ${req.method} ----- ${err.message}`
    );

    // Kiểm tra xem headers đã được gửi chưa
    if (res.headersSent) {
        return next(err);
    }

    res.status(status);
    res.send({
        success: false,
        message: isMalformedJson ? "Malformed JSON request" : err.message,
        code: isMalformedJson ? "MALFORMED_JSON" : err.code,
        terminal: err.terminal,
        data: err.data || err.response?.data,
        error: {
            status,
            message: isMalformedJson ? "Malformed JSON request" : err.message,
            code: isMalformedJson ? "MALFORMED_JSON" : err.code,
            terminal: err.terminal,
            details: err.data || err.response?.data || err.toString(),
            errorId,
        },
    });
};
