import { CACHE_CONFIG } from "@/config";

const CACHE_KEY = CACHE_CONFIG.keys.user;
const CACHE_DURATION_MS = CACHE_CONFIG.ttls.user;

export const saveUserCache = (user) => {
  const now = Date.now();
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      data: user,
      localId: user?.localId || user?.uid || null,
      timestamp: now,
    })
  );
};

export const getUserCache = (expectedLocalId) => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached);
    const now = Date.now();
    const cachedLocalId = parsed.localId || parsed.data?.localId || parsed.data?.uid;

    if (expectedLocalId && cachedLocalId !== expectedLocalId) {
      clearUserCache();
      return null;
    }

    if (now - parsed.timestamp < CACHE_DURATION_MS) {
      return parsed.data;
    }

    clearUserCache();
    return null;
  } catch {
    return null;
  }
};

export const clearUserCache = () => {
  localStorage.removeItem(CACHE_KEY);
};
