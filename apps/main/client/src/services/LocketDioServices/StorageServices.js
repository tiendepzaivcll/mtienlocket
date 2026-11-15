import { CONFIG } from "@/config/webConfig";
import api from "@/libs/axios";
import { createR2Uploader } from "./r2Upload.js";

// Our storage service uses the Firebase ID token; no Dio member session.
export const uploadFileAndGetInfoR2 = createR2Uploader({
  api,
  storageUrl: CONFIG.api.storage,
  clientVersion: CONFIG.app.clientVersion,
  fetchUpload: (...args) => fetch(...args),
});
