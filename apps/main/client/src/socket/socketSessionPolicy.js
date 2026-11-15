export const resolveSocketSessionUid = ({ storedLocalId, user } = {}) =>
  storedLocalId || user?.localId || user?.uid || null;

export const shouldForceSocketReconnect = (reason) =>
  reason === "io server disconnect";
