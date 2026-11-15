import { CONFIG } from "./webConfig";

// Chat server host
export const BASE_SERVER_HOST = CONFIG.api.baseUrl;
export const BETA_SERVER_HOST = CONFIG.api.betaUrl;
// Namespace
export const API_NAMESPACE = {
  main: "/api",
  locket: "/locket",
  chat: "/chat",
};

// Endpoints
export const API_ENDPOINTS = {
  // Socket URL
  socketUrl: BASE_SERVER_HOST,
};


export const PUBLIC_API = {
  feeds: "v1/public/feeds",
  timelines: "v1/public/timelines",
  frames: "v1/public/myframes",
  backgroundList: "v1/public/getAllbackgrounds",
  celebrates: "v1/public/getAllCelebrate",
  notifications: "v1/public/notification",
  plans: "v1/public/dio-plans",
  themes: "v1/public/themes",
  getOverlaysV2: "v1/public/getAllOverlaysV2",
  collection: "v1/public/getAllCollections"
};
