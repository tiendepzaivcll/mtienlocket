const axios = require("axios");
const { instanceLocketV2 } = require("../../libs");
const { instanceFirestore } = require("../../libs/instanceFirestore.js");
const serverConfig = require("../../config/app.config.js");
const { createAnalytics } = require("../LocketAnalytics");
const { normalizeFriendDocument, decodeFirestoreValue } = require("../FirestoreRead");
const {
  getOrCreateAppCheckToken,
} = require("../AppCheck/appCheckService");

const USER_LOOKUP_CACHE_TTL = 15 * 1000;
const USER_LOOKUP_STALE_TTL = 5 * 60 * 1000;
const FRIEND_PROFILE_CACHE_TTL = 2 * 60 * 1000;
const FRIEND_PROFILE_STALE_TTL = 15 * 60 * 1000;
const INVITE_TOKEN_CACHE_TTL = 60 * 60 * 1000;
const userLookupCache = new Map();
const userLookupInFlight = new Map();
const friendProfileCache = new Map();
const inviteTokenCache = new Map();
const userLookupAnalytics = createAnalytics();
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const unwrapUserResult = (result) => {
  const payload = result?.result?.data || result?.data || result || null;
  return payload?.user && typeof payload.user === "object"
    ? {
        ...payload.user,
        celebrity_data:
          payload.user.celebrity_data || payload.celebrity_data || null,
      }
    : payload;
};

const hasCelebrityCapacity = (result) => {
  const user = unwrapUserResult(result);
  const friendCount = Number(user?.celebrity_data?.friend_count);
  const maxFriends = Number(user?.celebrity_data?.max_friends);
  return (
    Number.isFinite(friendCount) &&
    friendCount >= 0 &&
    Number.isFinite(maxFriends) &&
    maxFriends > 0
  );
};

const looksLikeCelebrity = (result) => {
  const user = unwrapUserResult(result);
  const marker = user?.celebrity;
  const accountTypes = Array.isArray(user?.accountTypes)
    ? user.accountTypes
    : Array.isArray(user?.account_types)
      ? user.account_types
      : [];
  const relationship = String(user?.friendship_status || "").toLowerCase();
  return Boolean(
    marker === true ||
      marker === 1 ||
      marker === "1" ||
      String(marker || "").toLowerCase() === "true" ||
      accountTypes.some(
        (type) => String(type || "").trim().toLowerCase() === "celebrity",
      ) ||
      user?.celebrity_data ||
      relationship.includes("follow")
  );
};

const normalizeCelebrityProfile = (result) => {
  const user = unwrapUserResult(result);
  if (!user || typeof user !== "object") return user;
  return looksLikeCelebrity(user) ? { ...user, celebrity: true } : user;
};

const getUserUid = (result) => {
  const user = unwrapUserResult(result);
  return String(user?.uid || user?.user_uid || user?.userUid || user?.id || "").trim();
};

const fetchUserByUidForCapacity = async (idToken, uid) => {
  if (!idToken || !uid) return null;
  try {
    const response = await instanceLocketV2.post(
      "fetchUserV2",
      { data: { user_uid: uid } },
      { meta: { idToken } },
    );
    return unwrapUserResult(response.data?.result);
  } catch (error) {
    console.warn("[friends] fetchUserV2 capacity fallback failed", {
      status: error?.response?.status || error?.status || null,
      code: error?.code || null,
    });
    return null;
  }
};

const fetchFriendProfile = async (idToken, uid) => {
  const normalizedUid = String(uid || "").trim();
  if (!idToken || !normalizedUid) return null;

  const requesterUid = getTokenUid(idToken) || "anonymous";
  const cacheKey = `${requesterUid}:${normalizedUid}`;
  const cached = friendProfileCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < FRIEND_PROFILE_CACHE_TTL) {
    return cached.data;
  }

  let lastError;
  let refreshedAppCheckToken = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await instanceLocketV2.post(
        "fetchUserV2",
        { data: { user_uid: normalizedUid } },
        {
          meta: {
            idToken,
            ...(refreshedAppCheckToken
              ? { appCheckToken: refreshedAppCheckToken }
              : {}),
          },
        },
      );
      const payload = unwrapUserResult(response.data?.result || response.data);
      const profileUid = getUserUid(payload);
      const profile = payload && { ...payload, uid: profileUid };
      if (!profileUid || profileUid !== normalizedUid) {
        const error = new Error("Locket trả về hồ sơ bạn bè không hợp lệ.");
        error.code = "FRIEND_PROFILE_INVALID";
        error.status = 502;
        throw error;
      }

      friendProfileCache.set(cacheKey, { data: profile, timestamp: Date.now() });
      if (friendProfileCache.size > 1000) {
        friendProfileCache.delete(friendProfileCache.keys().next().value);
      }
      return profile;
    } catch (error) {
      lastError = error;
      if (Number(error?.response?.status) !== 401 || attempt > 0) break;
      try {
        refreshedAppCheckToken = await getOrCreateAppCheckToken({ forceRefresh: true });
      } catch (refreshError) {
        lastError = refreshError;
        break;
      }
      if (!refreshedAppCheckToken) break;
    }
  }

  // Read with the requesting user's Firebase session, subject to Locket's
  // Firestore rules. Never use our own Admin credentials for Locket profiles.
  try {
    const response = await instanceFirestore.get(
      `(default)/documents/users/${encodeURIComponent(normalizedUid)}`,
      { meta: { idToken } },
    );
    const fields = response.data?.fields;
    const documentUid = response.data?.name?.split("/").pop();
    if (fields && documentUid === normalizedUid) {
      const profile = { uid: normalizedUid };
      for (const key of ["username", "first_name", "last_name", "profile_picture_url", "badge", "celebrity", "celebrity_data"]) {
        if (fields[key]) profile[key] = decodeFirestoreValue(fields[key]);
      }
      if (profile.username || profile.first_name || profile.last_name) {
        friendProfileCache.set(cacheKey, { data: profile, timestamp: Date.now() });
        if (friendProfileCache.size > 1000) friendProfileCache.delete(friendProfileCache.keys().next().value);
        return profile;
      }
    }
  } catch (error) {
    // Keep the original failure; the fallback may also be forbidden by rules.
    lastError ||= error;
  }

  if (cached && now - cached.timestamp < FRIEND_PROFILE_STALE_TTL) {
    return { ...cached.data, lookup_stale: true };
  }
  throw lastError;
};

const getFriendProfiles = async (idToken, uids, concurrency = 6) => {
  const uniqueUids = [...new Set(
    (Array.isArray(uids) ? uids : [])
      .map((uid) => String(uid || "").trim())
      .filter((uid) => uid && uid.length <= 160),
  )];
  const users = new Array(uniqueUids.length);
  const failedUids = [];
  const failures = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < uniqueUids.length) {
      const index = cursor;
      cursor += 1;
      try {
        users[index] = await fetchFriendProfile(idToken, uniqueUids[index]);
      } catch (error) {
        failedUids.push(uniqueUids[index]);
        const status = Number(error?.response?.status || error?.status || 0);
        failures.push({ uid: uniqueUids[index], code: status === 401 || status === 403
          ? "FRIEND_PROFILE_AUTH_FAILED" : "FRIEND_PROFILE_UNAVAILABLE" });
        console.warn("[friends] profile fetch failed", {
          status: error?.response?.status || error?.status || null,
          code: error?.code || null,
        });
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), uniqueUids.length) },
      () => worker(),
    ),
  );
  return { users: users.filter(Boolean), failedUids, failures };
};

const recoverCelebrityCapacity = async (idToken, result, fallbackUid = "") => {
  const user = normalizeCelebrityProfile(result);
  if (
    (!fallbackUid && !looksLikeCelebrity(user)) ||
    hasCelebrityCapacity(user)
  ) return user;

  const uid = getUserUid(user) || String(fallbackUid || "").trim();
  const fetched = await fetchUserByUidForCapacity(idToken, uid);
  if (!hasCelebrityCapacity(fetched)) return user;

  console.log("[friends] celebrity snapshot recovered via fetchUserV2", { uid });
  return normalizeCelebrityProfile({
    ...user,
    ...fetched,
    celebrity_data: fetched.celebrity_data,
    friendship_status:
      user?.friendship_status || fetched?.friendship_status || "none",
  });
};

// Helper to extract UID from document name or fields
const extractUidFromDoc = (doc, fieldNames = ['user', 'sender', 'recipient']) => {
  // Try to get from specified fields first
  for (const field of fieldNames) {
    const value = doc.fields?.[field]?.stringValue;
    if (value) return value;
  }

  // Fallback: extract from document name (format: .../users/localId/collection/uid)
  if (doc.name) {
    const parts = doc.name.split('/');
    return parts[parts.length - 1]; // Last part is the document ID (which is the uid)
  }

  return null;
};

const getAllFriends = async (idToken, localId) => {
  let pageToken = null;
  const allFriends = [];

  try {
    do {
      const response = await instanceFirestore.get(
        `(default)/documents/users/${localId}/friends`,
        {
          params: {
            pageSize: 100,
            ...(pageToken && { pageToken }),
          },
          meta: { idToken },
        }
      );

      const documents = response.data.documents || [];

      const parsedFriends = documents
        .map(normalizeFriendDocument)
        .filter(Boolean);

      allFriends.push(...parsedFriends);

      pageToken = response.data.nextPageToken || null;

    } while (pageToken);

    return allFriends;

  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy danh sách bạn bè:",
      error.response?.data || error.message
    );
    // Do not disguise an upstream failure as a legitimately empty friend list.
    // The client keeps its offline cache when this request fails.
    throw error;
  }
};

const readFriendRequests = require("./requestReader").createRequestReader(instanceFirestore);
const getIncomingFriendRequests = (idToken, localId) =>
  readFriendRequests(idToken, localId, "incoming");
const getOutgoingFriendRequests = (idToken, localId) =>
  readFriendRequests(idToken, localId, "outgoing");
const deleteFriendRequests = require("./friendRequestActions")
  .createFriendRequestActions(instanceLocketV2);

const getUserByUsername = async (idToken, username, options = {}) => {
  if (!username) return null;
  const normalizedUsername = String(username).toLowerCase();
  const celebrityUid = String(options?.celebrityUid || "").trim();
  const cacheKey = `${getTokenUid(idToken) || "anonymous"}:${normalizedUsername}`;
  const cached = userLookupCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < USER_LOOKUP_CACHE_TTL) {
    if (
      (!celebrityUid && !looksLikeCelebrity(cached.data)) ||
      hasCelebrityCapacity(cached.data)
    ) {
      return cached.data;
    }
    // Never pin an incomplete Celebrity response in memory. Locket can omit
    // capacity from one lookup and return it again on the next request.
    userLookupCache.delete(cacheKey);
  }
  if (userLookupInFlight.has(cacheKey)) return userLookupInFlight.get(cacheKey);

  const lookup = (async () => {
    let lastError;
    let refreshedAppCheckToken = null;
    let appCheckRetried = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await instanceLocketV2.post(
          "getUserByUsername",
          {
            data: {
              username: normalizedUsername,
              analytics: userLookupAnalytics,
            },
          },
          {
            meta: {
              idToken,
              ...(refreshedAppCheckToken
                ? { appCheckToken: refreshedAppCheckToken }
                : {}),
            },
          },
        );
        const data = response.data?.result?.data || null;
        if (data) {
          const recovered = await recoverCelebrityCapacity(
            idToken,
            data,
            celebrityUid,
          );
          const cacheable =
            (!celebrityUid && !looksLikeCelebrity(recovered)) ||
            hasCelebrityCapacity(recovered);
          if (cacheable) {
            userLookupCache.set(cacheKey, {
              data: recovered,
              timestamp: Date.now(),
            });
            if (userLookupCache.size > 500) {
              userLookupCache.delete(userLookupCache.keys().next().value);
            }
          }
          return recovered;
        }
        return null;
      } catch (error) {
        lastError = error;
        const status = Number(error?.response?.status);
        if (status === 401 && !appCheckRetried) {
          appCheckRetried = true;
          try {
            refreshedAppCheckToken = await getOrCreateAppCheckToken({
              forceRefresh: true,
            });
          } catch (appCheckError) {
            const sourceError = new Error(
              "Không thể đổi DeviceCheck thành App Check mới. Hãy nạp lại DeviceCheck token từ app Locket.",
            );
            sourceError.status = 503;
            sourceError.code = appCheckError?.code || "APPCHECK_EXCHANGE_FAILED";
            throw sourceError;
          }
          if (refreshedAppCheckToken) continue;

          const sourceError = new Error(
            "Backend chưa có DeviceCheck token để tạo App Check khi đọc slot.",
          );
          sourceError.status = 503;
          sourceError.code = "APPCHECK_SOURCE_REQUIRED";
          throw sourceError;
        }
        if (status === 401 && appCheckRetried) {
          const rejected = new Error(
            "Locket từ chối App Check mới. DeviceCheck token có thể đã hết hiệu lực.",
          );
          rejected.status = 401;
          rejected.code = "APPCHECK_REJECTED";
          throw rejected;
        }
        if (![429, 502, 503, 504].includes(status) || attempt === 1) break;
        await wait(1200);
      }
    }

    if (cached && now - cached.timestamp < USER_LOOKUP_STALE_TTL) {
      return { ...cached.data, lookup_stale: true };
    }
    if ([429, 502, 503, 504].includes(Number(lastError?.response?.status))) {
      const error = new Error(
        "Locket đang tạm giới hạn tìm kiếm. Vui lòng chờ một chút rồi thử lại.",
      );
      error.status = 503;
      throw error;
    }
    throw lastError;
  })();

  userLookupInFlight.set(cacheKey, lookup);
  try {
    return await lookup;
  } finally {
    userLookupInFlight.delete(cacheKey);
  }
};

const getInviteTokenFromProfile = async (urlOrUsername) => {
  const raw = String(urlOrUsername || "").trim();
  if (!raw) return null;

  const profileUrl = new URL(
    /^https?:\/\//i.test(raw)
      ? raw.replace(/^http:\/\//i, "https://")
      : `https://locket.cam/${raw.replace(/^@/, "")}`,
  );

  if (!["locket.cam", "www.locket.cam"].includes(profileUrl.hostname)) {
    const error = new Error("Chỉ chấp nhận link profile locket.cam");
    error.status = 400;
    throw error;
  }

  const cacheKey = `${profileUrl.hostname}${profileUrl.pathname}`.toLowerCase();
  const cached = inviteTokenCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < INVITE_TOKEN_CACHE_TTL) {
    return cached.token;
  }

  profileUrl.searchParams.set("_", String(Date.now()));
  const response = await axios.get(profileUrl.toString(), {
    timeout: 20000,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    },
  });
  const html = String(response.data || "");
  const dynamicLink = html
    .match(/https:\/\/locket\.page\.link\/\?link=[^"'<>\s]+/i)?.[0]
    ?.replace(/&amp;/g, "&");

  if (!dynamicLink) return null;

  const inviteUrl = new URL(dynamicLink).searchParams.get("link");
  const token = inviteUrl?.match(/\/invites\/([^/?]+)/i)?.[1] || null;
  if (token) {
    inviteTokenCache.set(cacheKey, { token, timestamp: Date.now() });
    if (inviteTokenCache.size > 500) {
      inviteTokenCache.delete(inviteTokenCache.keys().next().value);
    }
  }
  return token;
};

const getUserForInviteProfile = async (idToken, urlOrUsername) => {
  const inviteToken = await getInviteTokenFromProfile(urlOrUsername);
  if (!inviteToken) return null;

  const response = await instanceLocketV2.post(
    "fetchUserForInviteToken",
    {
      data: {
        invite_token: inviteToken,
        analytics: getCelebrityDeviceAnalytics(),
      },
    },
    {
      meta: { idToken: getCelebritySessionIdToken(idToken) },
    },
  );

  const result = response.data?.result?.data;
  if (!result?.user) return null;
  return {
    ...result.user,
    celebrity_data: result.celebrity_data || result.user.celebrity_data,
  };
};

const getTokenUid = (token) => {
  try {
    const payload = JSON.parse(
      Buffer.from(String(token).split(".")[1], "base64url").toString("utf8"),
    );
    return payload.user_id || payload.sub || null;
  } catch {
    return null;
  }
};

const getCelebritySessionIdToken = (userIdToken) => {
  const deviceIdToken = process.env.LOCKET_DEVICE_ID_TOKEN;
  if (!deviceIdToken) return userIdToken;

  const userUid = getTokenUid(userIdToken);
  const deviceUid = getTokenUid(deviceIdToken);
  return userUid && userUid === deviceUid ? deviceIdToken : userIdToken;
};

const getCelebrityDeviceAnalytics = () => {
  try {
    const analytics = JSON.parse(process.env.LOCKET_DEVICE_ANALYTICS || "null");
    if (analytics && typeof analytics === "object") return analytics;
  } catch {
    // Fall through to metadata that does not identify a device session.
  }

  return {
    platform: "ios",
    ios_version: "2.55.0.2",
  };
};

const sendFriendRequest = async (idToken, friendUid) => {
  if (!friendUid) return null;
  if (getTokenUid(idToken) === String(friendUid).trim()) {
    const error = new Error("Bạn không thể gửi lời mời kết bạn cho chính mình.");
    error.status = 400;
    error.code = "SELF_FRIEND_REQUEST";
    throw error;
  }
  const body = {
    data: {
      user_uid: friendUid,
      source: "signUp",
      platform: "iOS",
      messenger: "Messages",
      invite_variant: {
        value: "1002",
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
      },
      share_history_eligible: true,
      rollcall: false,
      prompted_reengagement: false,
      create_ofr_for_temp_users: false,
      get_reengagement_status: false,
    },
  };
  let response;
  let appCheckRetried = false;
  let instanceHeaderRetried = false;
  let refreshedAppCheckToken = null;
  for (;;) {
    try {
      response = await instanceLocketV2.post("sendFriendRequest", body, {
        meta: {
          idToken,
          ...(refreshedAppCheckToken
            ? { appCheckToken: refreshedAppCheckToken }
            : {}),
          ...(instanceHeaderRetried ? { omitInstanceIdToken: true } : {}),
        },
      });
      break;
    } catch (error) {
      // A stale App Check token or an installation-scoped Instance ID header
      // can be rejected only on write endpoints. Try each alternative once,
      // then preserve the upstream error without exposing headers/tokens.
      if (Number(error.response?.status) !== 401) throw error;
      if (!appCheckRetried) {
        appCheckRetried = true;
        try {
          refreshedAppCheckToken = await getOrCreateAppCheckToken({
            forceRefresh: true,
          });
        } catch {
          refreshedAppCheckToken = null;
        }
        continue;
      }
      if (!instanceHeaderRetried) {
        instanceHeaderRetried = true;
        continue;
      }
      throw error;
    }
  }

  let callableResult = response.data?.result ?? response.data;

  let v2Unauthorized =
    Number(callableResult?.status) === 401 ||
    (Array.isArray(callableResult?.errors) &&
      callableResult.errors.some((message) =>
        String(message).toLowerCase().includes("unauthorized"),
      ));

  // Some Locket deployments return callable status 401 inside an HTTP 200
  // response. Refresh App Check for that shape too, but keep the retry bounded.
  if (v2Unauthorized && !instanceHeaderRetried) {
    instanceHeaderRetried = true;
    try {
      if (!refreshedAppCheckToken) {
        refreshedAppCheckToken = await getOrCreateAppCheckToken({
          forceRefresh: true,
        });
      }
      const retriedResponse = await instanceLocketV2.post(
        "sendFriendRequest",
        body,
        {
          meta: {
            idToken,
            ...(refreshedAppCheckToken
              ? { appCheckToken: refreshedAppCheckToken }
              : {}),
            omitInstanceIdToken: true,
          },
        },
      );
      callableResult = retriedResponse.data?.result ?? retriedResponse.data;
      v2Unauthorized =
        Number(callableResult?.status) === 401 ||
        (Array.isArray(callableResult?.errors) &&
          callableResult.errors.some((message) =>
            String(message).toLowerCase().includes("unauthorized"),
          ));
    } catch {
      // Keep the original callable 401 below; do not expose refresh details.
    }
  }

  if (v2Unauthorized) {
    const error = new Error(
      "Locket từ chối yêu cầu (401). App Check đã hợp lệ phía Firebase nhưng API không chấp nhận phiên hoặc thiết bị hiện tại.",
    );
    error.status = 401;
    error.data = callableResult;
    throw error;
  }

  const errors = Array.isArray(callableResult?.errors)
    ? callableResult.errors.filter(Boolean)
    : [];
  const status = Number(callableResult?.status);

  if (errors.length || (Number.isFinite(status) && status >= 400)) {
    const error = new Error(errors.join(", ") || "Locket từ chối yêu cầu");
    error.status = Number.isFinite(status) ? status : 400;
    error.data = callableResult;
    throw error;
  }

  return callableResult?.data ?? callableResult ?? null;
};

const sendFollowRequest = async (idToken, celebrityUid) => {
  if (!celebrityUid) return null;

  const celebritySessionIdToken = getCelebritySessionIdToken(idToken);
  const body = {
    data: {
      celebrity_uid: celebrityUid,
      intent: "add-friend",
      analytics: getCelebrityDeviceAnalytics(),
    },
  };
  const hasDeviceSession = Boolean(
    process.env.FIREBASE_APPCHECK_TOKEN &&
      process.env.FIREBASE_INSTANCE_ID_TOKEN &&
      process.env.LOCKET_DEVICE_ID_TOKEN,
  );

  let response;
  try {
    response = hasDeviceSession
      ? await axios.post(
          new URL("sendFollowRequest", serverConfig.function.locketApi).toString(),
          body,
          {
            timeout: 30000,
            headers: {
              "Content-Type": "application/json",
              Accept: "*/*",
              baggage: process.env.LOCKET_DEVICE_BAGGAGE,
              Authorization: `Bearer ${celebritySessionIdToken}`,
              "X-Firebase-AppCheck": process.env.FIREBASE_APPCHECK_TOKEN,
              priority: "u=3, i",
              "Accept-Language": "vi-VN,vi;q=0.9",
              "sentry-trace": process.env.LOCKET_DEVICE_SENTRY_TRACE,
              "User-Agent":
                "com.locket.Locket/2.55.0 iPhone/26.1 hw/iPhone16_2",
              "Firebase-Instance-ID-Token":
                process.env.FIREBASE_INSTANCE_ID_TOKEN,
            },
          },
        )
      : await instanceLocketV2.post("sendFollowRequest", body, {
          meta: { idToken: celebritySessionIdToken },
        });
  } catch (error) {
    if (Number(error.response?.status) === 401 && hasDeviceSession) {
      const authError = new Error(
        "App Check trong HAR đã được dùng cho thao tác ghi. Cần phiên App Check mới từ app Locket.",
      );
      authError.status = 401;
      authError.data = error.response?.data;
      throw authError;
    }
    throw error;
  }

  const callableResult = response.data?.result ?? response.data;
  const status = Number(callableResult?.status);
  const errors = Array.isArray(callableResult?.errors)
    ? callableResult.errors.filter(Boolean)
    : [];

  if (errors.length || (Number.isFinite(status) && status >= 400)) {
    const error = new Error(
      errors.join(", ") || "Locket từ chối yêu cầu theo dõi slot",
    );
    error.status = Number.isFinite(status) ? status : 400;
    error.data = callableResult;
    throw error;
  }

  return callableResult?.data ?? callableResult ?? null;
};

module.exports = {
  getAllFriends,
  getFriendProfiles,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  deleteFriendRequests,
  getUserByUsername,
  getUserForInviteProfile,
  sendFriendRequest,
  sendFollowRequest,
};
