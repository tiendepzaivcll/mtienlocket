// configAlias.js
import { CONFIG } from "@/config/webConfig";

// Config cho Moments
export const MOMENTS_CONFIG = {
  maxDisplayLimit: CONFIG.app.moments.maxDisplayLimit,
  duplicateThreshold: CONFIG.app.moments.duplicateThreshold,
  initialVisible: CONFIG.app.moments.initialVisible,
  loadMoreLimit: CONFIG.app.moments.loadMoreLimit,
};

// Config cho Messages
export const MESSAGES_CONFIG = {
  maxDisplayLimit: CONFIG.app.messages.maxDisplayLimit,
  initialVisible: CONFIG.app.messages.initialVisible,
  loadMoreLimit: CONFIG.app.messages.loadMoreLimit,
};

// Config cho Camera
export const CAMERA_CONFIG = {
  maxRecordTime: CONFIG.app.camera.limits.maxRecordTime,
  imageSizePx: CONFIG.app.camera.resolutions.imageSizePx,
  videoResolutionPx: CONFIG.app.camera.resolutions.videoResolutionPx,
  maxImageSizeMB: CONFIG.app.camera.limits.maxImageSizeMB,
  maxVideoSizeMB: CONFIG.app.camera.limits.maxVideoSizeMB,
};

export const COMMUNITY_CONFIG = {
  zalo: CONFIG.app.community.zalo,
};

export const CONTACT_CONFIG = {
  supportEmail: CONFIG.app.contact.supportEmail,
  supportNumber: CONFIG.app.contact.supportNumber,
  zaloUrl: CONFIG.app.contact.zaloUrl,
};

export const MYBANK_CONFIG = {
  bankCode: CONFIG.app.bankInfo.bankCode,
  urlImg: CONFIG.app.bankInfo.urlImg,
  bankShortname: CONFIG.app.bankInfo.short_name,
  bankName: CONFIG.app.bankInfo.bankName,
  accountNumber: CONFIG.app.bankInfo.accountNumber,
  accountName: CONFIG.app.bankInfo.accountName,
};

export const EMBEDVIDEO_CONFIG = {
  embedios: CONFIG.app.videoTutorials.iosAddscreen,
  embedAndroid: CONFIG.app.videoTutorials.androidAddscreen,
};

export const CACHE_CONFIG = {
  keys: CONFIG.cache.keys,
  ttls: CONFIG.cache.ttl,
};
