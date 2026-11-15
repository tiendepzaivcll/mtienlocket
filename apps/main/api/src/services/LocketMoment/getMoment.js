const axios = require("axios");
const { instanceFirestore } = require("../../libs");
const {
  isStructuredMomentCursor,
  queryMomentsByFriend,
} = require("../FirestoreRead");

const getLocketMoments = async (
  idToken,
  userId,
  pageToken,
  userUid,
  limit = 20,
) => {
  // The sample project queried the friend filter directly in Firestore. Keep
  // the existing listDocuments path as fallback because it supplies native
  // page tokens and works even when a composite index is unavailable.
  if (userUid && (!pageToken || isStructuredMomentCursor(pageToken))) {
    try {
      const result = await queryMomentsByFriend({
        idToken,
        userId,
        friendId: userUid,
        limit,
        cursor: pageToken,
      });
      return {
        moments: result.documents.map(normalizeMoment).filter(Boolean),
        nextPageToken: result.nextPageToken,
      };
    } catch (error) {
      if (pageToken) throw error;
      console.warn(
        "⚠️ Structured moment query unavailable, using REST pagination:",
        error.response?.status || error.code || error.message,
      );
    }
  }

  try {
    const moments = [];
    let nextPageToken = pageToken || null;
    let pageCount = 0;
    const maxPages = userUid ? 10 : 1;

    do {
      const params = {
        orderBy: "date desc",
        pageSize: userUid ? 100 : limit,
      };

      if (nextPageToken) params.pageToken = nextPageToken;

      const response = await instanceFirestore.get(
        `/locket/documents/history/${userId}/entries`,
        {
          params,
          meta: {
            idToken,
          },
        },
      );

      const documents = response.data.documents || [];

      for (const doc of documents) {
        const moment = normalizeMoment(doc);
        if (!moment) continue;
        if (userUid && moment.user !== userUid) continue;
        moments.push(moment);
        if (moments.length >= limit) break;
      }

      nextPageToken = response.data.nextPageToken || null;
      pageCount += 1;
    } while (userUid && moments.length < limit && nextPageToken && pageCount < maxPages);

    return {
      moments: moments.slice(0, limit),
      nextPageToken,
    };
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy moments:",
      error.response?.data || error.message,
    );
    return {
      moments: [],
      nextPageToken: null,
    };
  }
};

const countLocketsByPagination = async (idToken, userId) => {
  let count = 0;
  let pageToken = null;

  do {
    const response = await instanceFirestore.get(
      `/locket/documents/history/${userId}/entries`,
      {
        params: {
          pageSize: 100,
          ...(pageToken ? { pageToken } : {}),
        },
        meta: { idToken },
      },
    );

    count += Array.isArray(response.data?.documents)
      ? response.data.documents.filter(
          (document) => document.fields?.user?.stringValue === userId,
        ).length
      : 0;
    pageToken = response.data?.nextPageToken || null;
  } while (pageToken);

  return { count, read_time: null };
};

const getLocketsCount = async (idToken, userId) => {
  if (!idToken || !userId) {
    return { count: 0, read_time: null };
  }

  return countLocketsByPagination(idToken, userId);
};

const getLocketMomentById = async (idToken, userId, momentId) => {
  if (!momentId) {
    return null;
  }

  try {
    const response = await instanceFirestore.get(
      `/locket/documents/history/${userId}/entries/${momentId}`,
      {
        timeout: 8000,
        meta: {
          idToken,
        },
      },
    );

    return withMomentReactions(idToken, normalizeMoment(response.data));
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error(
        "❌ Lỗi khi lấy moment theo id:",
        error.response?.data || error.message,
      );
    }
  }

  const listedMoment = await findMomentInHistoryPages(idToken, userId, momentId);
  if (listedMoment) {
    return withMomentReactions(idToken, listedMoment);
  }

  return withMomentReactions(idToken, { id: momentId, reactions: [] });
};

const withMomentReactions = async (idToken, moment) => {
  if (!moment?.id) return moment;

  const [extraReactions, externalInfo] = await Promise.all([
    getMomentReactions(idToken, moment.id),
    getExternalMomentInfo(moment.id),
  ]);

  const mergedReactions = mergeNormalizedReactions(
    moment.reactions,
    extraReactions,
    externalInfo?.reactions,
  );

  if (!mergedReactions.length && !externalInfo?.views?.length) return moment;

  return {
    ...moment,
    reactions: mergedReactions,
    views: externalInfo?.views?.length ? externalInfo.views : moment.views || [],
  };
};

async function getExternalMomentInfo(momentId) {
  const configuredUrl = (process.env.LOCKET_INFO_MOMENT_API_BASE || "").trim();
  if (!configuredUrl || !momentId) return null;

  const normalizedUrl = configuredUrl.replace(/\/+$/, "");
  const isFullEndpoint = /\/locket\/getInfoMomentV2$/i.test(normalizedUrl);

  try {
    const response = await axios.post(
      isFullEndpoint ? normalizedUrl : "/locket/getInfoMomentV2",
      {
        pageToken: null,
        idMoment: momentId,
        limit: null,
      },
      {
        baseURL: isFullEndpoint ? undefined : normalizedUrl,
        timeout: 8000,
        headers: getExternalMomentInfoHeaders(),
      },
    );

    const payload = decodeMaybeJson(response.data);
    const data = payload?.data || payload || {};

    return {
      reactions: normalizeReactions(data.reactions),
      views: normalizeViews(data.views),
    };
  } catch (error) {
    const status = error.response?.status;
    if (![401, 403, 404].includes(status)) {
      console.warn(
        "⚠️ Không đọc được external getInfoMomentV2:",
        error.response?.data || error.message,
      );
    }
    return null;
  }
}

function getExternalMomentInfoHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (process.env.LOCKET_INFO_MOMENT_API_KEY) {
    headers["x-api-key"] = process.env.LOCKET_INFO_MOMENT_API_KEY;
  }

  if (process.env.LOCKET_INFO_MOMENT_MEMBER_TOKEN) {
    headers["x-locketdio-member"] = process.env.LOCKET_INFO_MOMENT_MEMBER_TOKEN;
  }

  if (process.env.LOCKET_INFO_MOMENT_HEADERS_JSON) {
    try {
      Object.assign(
        headers,
        JSON.parse(process.env.LOCKET_INFO_MOMENT_HEADERS_JSON),
      );
    } catch (error) {
      console.warn("⚠️ LOCKET_INFO_MOMENT_HEADERS_JSON không hợp lệ");
    }
  }

  return headers;
}

function decodeMaybeJson(value) {
  if (!value || typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch (_) {
    // Some captured HAR responses are stored as base64 text.
  }

  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch (_) {
    return null;
  }
}

function normalizeViews(views) {
  if (!Array.isArray(views)) return [];

  return views.map((view) => ({
    ...view,
    user: view.user || view.uid || view.user_uid || view.viewer_uid || null,
    viewedAt: view.viewedAt || view.viewed_at || view.createdAt || null,
  }));
}

const findMomentInHistoryPages = async (idToken, userId, momentId) => {
  let nextPageToken = null;
  let pageCount = 0;
  const maxPages = 8;

  try {
    do {
      const params = {
        orderBy: "date desc",
        pageSize: 100,
      };

      if (nextPageToken) params.pageToken = nextPageToken;

      const response = await instanceFirestore.get(
        `/locket/documents/history/${userId}/entries`,
        {
          params,
          meta: {
            idToken,
          },
        },
      );

      const documents = response.data.documents || [];
      const matchedDoc = documents.find((doc) => {
        const fields = doc.fields || {};
        const id = fields.canonical_uid?.stringValue || doc.name?.split("/").pop();
        return id === momentId;
      });

      if (matchedDoc) {
        return normalizeMoment(matchedDoc);
      }

      nextPageToken = response.data.nextPageToken || null;
      pageCount += 1;
    } while (nextPageToken && pageCount < maxPages);
  } catch (error) {
    console.error(
      "❌ Lỗi khi tìm moment trong history:",
      error.response?.data || error.message,
    );
  }

  return null;
};

function normalizeMoment(doc) {
  if (!doc || !doc.fields) return null;

  const f = doc.fields;
  const overlays = f.overlays?.arrayValue?.values || [];

  // chỉ lấy overlay đầu tiên (nếu có)
  const overlay = overlays[0]?.mapValue?.fields || {};
  const overlayData = overlay.data?.mapValue?.fields || {};

  const backgroundFields = overlayData.background?.mapValue?.fields || {};

  const getIsPublic = (f) => {
    const sentToAll = parseFirestoreValue(f.sent_to_all);
    const sentToSelfOnly = parseFirestoreValue(f.sent_to_self_only);

    // Ưu tiên sent_to_self_only nếu có true
    if (sentToSelfOnly) return false;
    if (sentToAll) return true;
    return false;
  };

  const parsedReactions = collectReactionValues(f);

  return {
    id: f.canonical_uid?.stringValue || doc.name.split("/").pop(),
    caption:
      f.caption?.stringValue ||
      overlayData.text?.stringValue ||
      overlay.alt_text?.stringValue ||
      "",
    user: f.user?.stringValue || null,
    // Consistent field names - both camelCase and snake_case for compatibility
    // Preserve signed Firebase URLs. Replacing only the hostname can invalidate
    // legacy signatures; image_url is also required by some older entries.
    thumbnailUrl:
      f.thumbnail_url?.stringValue || f.image_url?.stringValue || null,
    thumbnail_url:
      f.thumbnail_url?.stringValue || f.image_url?.stringValue || null,
    image_url:
      f.image_url?.stringValue || f.thumbnail_url?.stringValue || null,
    videoUrl: f.video_url?.stringValue || null,
    video_url: f.video_url?.stringValue || null,
    thumbnailCdnUrl: replaceFirebaseWithCDN(
      f.thumbnail_url?.stringValue || f.image_url?.stringValue,
    ),
    imageCdnUrl: replaceFirebaseWithCDN(
      f.image_url?.stringValue || f.thumbnail_url?.stringValue,
    ),
    videoCdnUrl: replaceFirebaseWithCDN(f.video_url?.stringValue),
    md5: f.md5?.stringValue || null,
    reactions: normalizeReactions(parsedReactions),
    date: f.date?.timestampValue || doc.createTime || null,
    isPublic: getIsPublic(f),
    overlays: {
      id: overlay.overlay_id?.stringValue || null,
      type: overlay.overlay_type?.stringValue || null,
      captionType: overlayData.type?.stringValue || null,
      text: overlayData.text?.stringValue || null,
      textColor: overlayData.text_color?.stringValue || null,
      maxLines: overlayData.max_lines?.integerValue
        ? parseInt(overlayData.max_lines.integerValue, 10)
        : null,
      background: {
        materialBlur:
          overlayData.background?.mapValue?.fields?.material_blur
            ?.stringValue || null,
        colors: parseFirestoreValue(backgroundFields.colors) || [],
      },
      icon: parseFirestoreValue(overlayData.icon),
      music: parseFirestoreValue(overlayData.music),
      payload: parseFirestoreValue(overlayData.payload),
    },
    createTime: doc.createTime || null,
    updateTime: doc.updateTime || null,
  };
}

async function getMomentReactions(idToken, momentId) {
  const defaultDbReactions = await getDefaultDatabaseMomentReactions(
    idToken,
    momentId,
  );
  if (defaultDbReactions.length) return defaultDbReactions;

  const queriedReactions = await queryMomentReactions(idToken, momentId);
  if (queriedReactions.length) return queriedReactions;

  const candidatePaths = [
    `/locket/documents/moment_reactions/${momentId}`,
    `/locket/documents/moment_reactions/${momentId}/entries`,
    `/locket/documents/moment_reactions/${momentId}/reactions`,
    `/locket/documents/moments/${momentId}/reactions`,
  ];

  for (const path of candidatePaths) {
    try {
      const response = await instanceFirestore.get(path, {
        params: path.endsWith("/entries") || path.endsWith("/reactions")
          ? { pageSize: 100 }
          : undefined,
        timeout: 5000,
        meta: { idToken },
      });

      if (Array.isArray(response.data?.documents)) {
        const reactions = response.data.documents.flatMap((doc) =>
          normalizeReactions({
            ...parseFirestoreValue({ mapValue: { fields: doc.fields || {} } }),
            id: doc.name?.split("/").pop(),
          })
        );
        if (reactions.length) return reactions;
        continue;
      }

      const fields = response.data?.fields || {};
      const values = collectReactionValues(fields);
      const reactions = normalizeReactions(values.length
        ? values
        : parseFirestoreValue({ mapValue: { fields } }));
      if (reactions.length) return reactions;
    } catch (error) {
      if (![403, 404].includes(error.response?.status)) {
        console.warn(
          "⚠️ Không đọc được moment reactions:",
          path,
          error.response?.data || error.message,
        );
      }
    }
  }

  return [];
}

async function getDefaultDatabaseMomentReactions(idToken, momentId) {
  const firestoreBaseURL = process.env.FIREBASE_FIRESTORE_API_BASE;
  if (!firestoreBaseURL || !idToken || !momentId) return [];

  try {
    const response = await axios.get(
      `/moments/${momentId}/reactions`,
      {
        baseURL: `${firestoreBaseURL.replace(/\/+$/, "")}/(default)/documents`,
        params: { pageSize: 100 },
        timeout: 7000,
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: "application/json",
        },
      },
    );

    return (response.data?.documents || []).flatMap((doc) =>
      normalizeReactions({
        ...parseFirestoreValue({ mapValue: { fields: doc.fields || {} } }),
        id: doc.name?.split("/").pop(),
      })
    );
  } catch (error) {
    if (![403, 404].includes(error.response?.status)) {
      console.warn(
        "⚠️ Không đọc được default moment reactions:",
        error.response?.data || error.message,
      );
    }
    return [];
  }
}

async function queryMomentReactions(idToken, momentId) {
  const collectionIds = ["moment_reactions", "momentReactions", "reactions"];
  const momentFieldPaths = [
    "moment_uid",
    "momentUid",
    "moment_id",
    "momentId",
    "canonical_uid",
    "canonicalUid",
  ];

  for (const collectionId of collectionIds) {
    for (const fieldPath of momentFieldPaths) {
      try {
        const response = await instanceFirestore.post(
          "/locket/documents:runQuery",
          {
            structuredQuery: {
              from: [
                {
                  collectionId,
                  allDescendants: true,
                },
              ],
              where: {
                fieldFilter: {
                  field: { fieldPath },
                  op: "EQUAL",
                  value: { stringValue: momentId },
                },
              },
              limit: 100,
            },
          },
          {
            timeout: 7000,
            meta: { idToken },
          },
        );

        const documents = (response.data || [])
          .map((row) => row.document)
          .filter(Boolean);
        const reactions = documents.flatMap((doc) => {
          const data = parseFirestoreValue({
            mapValue: { fields: doc.fields || {} },
          });
          return normalizeReactions({
            ...data,
            id: doc.name?.split("/").pop(),
          });
        });

        if (reactions.length) return reactions;
      } catch (error) {
        const status = error.response?.status;
        if (![400, 403, 404].includes(status)) {
          console.warn(
            "⚠️ Không query được moment reactions:",
            collectionId,
            fieldPath,
            error.response?.data || error.message,
          );
        }
      }
    }
  }

  return [];
}

function collectReactionValues(fields = {}) {
  const reactionKeys = [
    "reactions",
    "reaction",
    "moment_reactions",
    "momentReactions",
    "reaction_data",
    "reactionData",
    "reactions_by_user",
    "reactionsByUser",
    "votes",
    "voters",
    "poll_votes",
    "pollVotes",
    "poll_responses",
    "pollResponses",
    "responses",
  ];

  return reactionKeys
    .map((key) => parseFirestoreValue(fields[key]))
    .filter((value) => value !== null && value !== undefined);
}

function normalizeReactions(reactions) {
  if (!reactions) return [];

  const hasReactionShape = (reaction) =>
    reaction &&
    typeof reaction === "object" &&
    !Array.isArray(reaction) &&
    [
      "emoji",
      "string",
      "reaction",
      "value",
      "vote",
      "choice",
      "answer",
      "user",
      "user_uid",
      "uid",
      "user_id",
      "viewer_uid",
    ].some((key) => reaction[key] !== undefined);

  const normalizeReaction = (reaction, fallbackUser = null) => {
    if (typeof reaction === "string") {
      return {
        user: fallbackUser,
        emoji: reaction,
        reaction,
        intensity: 0,
        createdAt: null,
      };
    }

    if (!reaction || typeof reaction !== "object") return null;

    if (Array.isArray(reaction)) {
      return reaction
        .map((item) => normalizeReaction(item, fallbackUser))
        .filter(Boolean);
    }

    const emoji =
      reaction.emoji ||
      reaction.string ||
      reaction.reaction ||
      reaction.value ||
      reaction.vote ||
      reaction.choice ||
      reaction.answer ||
      null;

    return {
      ...reaction,
      user:
        reaction.user ||
        reaction.user_uid ||
        reaction.uid ||
        reaction.user_id ||
        reaction.viewer_uid ||
        fallbackUser ||
        null,
      emoji,
      reaction: reaction.reaction || reaction.emoji || emoji,
      intensity: reaction.intensity || reaction.power || 0,
      createdAt:
        reaction.createdAt ||
        reaction.created_at ||
        reaction.date ||
        reaction.timestamp ||
        reaction.updated_at ||
        reaction.updatedAt ||
        null,
    };
  };

  if (Array.isArray(reactions)) {
    return reactions
      .flatMap((reaction) =>
        reaction && typeof reaction === "object" && !hasReactionShape(reaction)
          ? normalizeReactions(reaction)
          : normalizeReaction(reaction)
      )
      .filter(Boolean);
  }

  if (typeof reactions === "object") {
    const direct = normalizeReaction(reactions);
    if (direct?.emoji || direct?.reaction) return [direct];

    return Object.entries(reactions)
      .flatMap(([uid, reaction]) => normalizeReaction(reaction, uid))
      .filter(Boolean);
  }

  return [];
}

function mergeNormalizedReactions(...reactionGroups) {
  const map = new Map();

  reactionGroups
    .flatMap((group) => normalizeReactions(group))
    .forEach((reaction, index) => {
      const key = `${reaction.user || `anonymous:${index}`}:${reaction.emoji || reaction.reaction || ""}`;
      if (!map.has(key)) map.set(key, reaction);
    });

  return Array.from(map.values());
}

function replaceFirebaseWithCDN(url) {
  if (!url) return null; // hoặc "" nếu bạn muốn
  return url.replace(
    "https://firebasestorage.googleapis.com",
    "https://cdn.locketcamera.com",
  );
}

function parseFirestoreValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.mapValue !== undefined) {
    const fields = v.mapValue.fields || {};
    const obj = {};
    for (const key in fields) {
      obj[key] = parseFirestoreValue(fields[key]);
    }
    return obj;
  }
  if (v.arrayValue !== undefined) {
    return (v.arrayValue.values || []).map(parseFirestoreValue);
  }
  return null;
}

module.exports = {
  getLocketMoments,
  getLocketMomentById,
  getLocketsCount,
};
