const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStaticPath = require("ffmpeg-static");
const { logInfo, logWarning } = require("../../utils/logEventUtils.js");

const resolveExistingPath = (...candidates) =>
  candidates.find((candidate) => candidate && fs.existsSync(candidate));

const resolveFfprobePath = () => {
  let installerPath = null;
  let staticPath = null;

  try {
    installerPath = require("@ffprobe-installer/ffprobe").path;
  } catch (error) {
    logWarning("ffmpegConfig", `@ffprobe-installer unavailable: ${error.message}`);
  }

  try {
    staticPath = require("ffprobe-static").path;
  } catch (error) {
    logWarning("ffmpegConfig", `ffprobe-static unavailable: ${error.message}`);
  }

  return resolveExistingPath(installerPath, staticPath);
};

const configureFfmpeg = () => {
  const ffprobePath = resolveFfprobePath();

  if (ffmpegStaticPath && fs.existsSync(ffmpegStaticPath)) {
    ffmpeg.setFfmpegPath(ffmpegStaticPath);
  } else {
    logWarning("ffmpegConfig", "ffmpeg-static binary not found, using system ffmpeg");
  }

  if (ffprobePath) {
    ffmpeg.setFfprobePath(ffprobePath);
    logInfo("ffmpegConfig", `Using ffprobe: ${ffprobePath}`);
  } else {
    logWarning("ffmpegConfig", "ffprobe binary not found, using system ffprobe");
  }

  return {
    ffmpegPath: ffmpegStaticPath,
    ffprobePath,
  };
};

module.exports = {
  configureFfmpeg,
  resolveFfprobePath,
};
