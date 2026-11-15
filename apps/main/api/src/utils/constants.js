require("dotenv").config();

const constants = {
  USER_AGENT:
    "FirebaseAuth.iOS/10.23.1 com.locket.Locket/1.82.0 iPhone/18.0 hw/iPhone12_1",
  IOS_BUNDLE_ID: "com.locket.Locket",
  LOGIN_HEADERS: {
    "Content-Type": "application/json",
    "User-Agent":
      "FirebaseAuth.iOS/10.23.1 com.locket.Locket/1.82.0 iPhone/18.0 hw/iPhone12_1",
    "X-Ios-Bundle-Identifier": "com.locket.Locket",
  },
  UPLOADER_HEADERS: {
    "content-type": "application/octet-stream",
    "x-goog-upload-protocol": "resumable",
    "x-goog-upload-offset": "0",
    "x-goog-upload-command": "upload, finalize",
    "upload-incomplete": "?0",
    "upload-draft-interop-version": "3",
    "user-agent":
      "com.locket.Locket/1.43.1 iPhone/17.3 hw/iPhone15_3 (GTMSUF/1)",
  },
  STORAGE_URL: process.env.STORAGE_API_URL,
};

module.exports = constants;
