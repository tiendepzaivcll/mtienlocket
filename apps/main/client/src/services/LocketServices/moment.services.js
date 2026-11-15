import { getMomentById } from "@/cache/momentDB";
import { instanceLocketV2 } from "@/libs";
import { getToken } from "@/utils";
import { generateUUIDv4Upper } from "@/utils/generate/uuid";
import { createLocketAnalytics } from "./locketAnalytics";

const normalizeMomentViewsResponse = (raw) => {
  const data =
    raw?.result?.data ||
    raw?.data?.result?.data ||
    raw?.data ||
    raw?.result ||
    raw ||
    {};

  if (Array.isArray(data)) {
    return { moment_views: data };
  }

  const momentViews =
    data?.moment_views ||
    data?.momentViews ||
    data?.views ||
    raw?.moment_views ||
    [];

  return {
    ...data,
    moment_views: Array.isArray(momentViews) ? momentViews : [],
  };
};

const createIntValue = (value) => ({
  "@type": "type.googleapis.com/google.protobuf.Int64Value",
  value: String(value || 0),
});

const buildEndBefore = (viewedAt) => {
  if (!viewedAt) return null;
  const seconds = viewedAt._seconds ?? viewedAt.seconds ?? null;
  const nanoseconds = viewedAt._nanoseconds ?? viewedAt.nanoseconds ?? 0;

  if (!seconds) return null;

  return {
    _seconds: createIntValue(seconds),
    _nanoseconds: createIntValue(nanoseconds),
  };
};

const getLastViewCursor = (views = []) => {
  const last = views[views.length - 1];
  return buildEndBefore(last?.viewed_at || last?.viewedAt);
};

const buildReactionCreatedAt = (createdAt) => {
  if (!createdAt) return null;

  if (createdAt._seconds) {
    return {
      _seconds: createIntValue(createdAt._seconds),
      _nanoseconds: createIntValue(createdAt._nanoseconds || 0),
    };
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  return {
    _seconds: createIntValue(Math.floor(date.getTime() / 1000)),
    _nanoseconds: createIntValue((date.getTime() % 1000) * 1e6),
  };
};

export const SendReactMoment = async (emoji, selectedMomentId, power) => {
  try {
    const { localId } = getToken();
    const body = {
      data: {
        moment_uid: selectedMomentId,
        reaction: emoji || "💛",
        owner_uid: localId,
        from_memory: false,
        analytics: createLocketAnalytics(),
      },
    };

    if (power) {
      body.data.intensity = power;
    }

    const response = await instanceLocketV2.post("reactToMoment", body);

    return response.data;
  } catch (err) {
    console.warn("❌ React Failed", err);
    throw err;
  }
};

export const GetViewsMoment = async (idMoment) => {
  try {
    const allViews = [];
    let endBefore = null;
    let expectedCount = null;
    let page = 0;

    do {
      const body = {
        data: {
          moment_uid: idMoment,
          analytics: createLocketAnalytics(),
        },
      };

      if (endBefore) body.data.end_before = endBefore;

      const res = await instanceLocketV2.post("getMomentViews", body);
      const normalized = normalizeMomentViewsResponse(res.data);
      const views = normalized.moment_views || [];
      expectedCount = Number(normalized.count ?? expectedCount ?? views.length);

      const seen = new Set(
        allViews.map((view) => `${view.user}:${JSON.stringify(view.viewed_at)}`)
      );
      views.forEach((view) => {
        const key = `${view.user}:${JSON.stringify(view.viewed_at)}`;
        if (!seen.has(key)) allViews.push(view);
      });

      endBefore = getLastViewCursor(views);
      page += 1;
      if (!views.length || allViews.length >= expectedCount) break;
    } while (endBefore && page < 10);

    return {
      moment_views: allViews,
      count: expectedCount ?? allViews.length,
    };
  } catch (err) {
    console.warn("❌ React Failed", err);
    return { moment_views: [] };
  }
};

export const MarkReactionAsViewed = async ({
  momentId,
  reactionId,
  createdAt,
}) => {
  if (!momentId || !reactionId || !createdAt) return null;

  const reactionCreatedAt = buildReactionCreatedAt(createdAt);
  if (!reactionCreatedAt) return null;

  try {
    const response = await instanceLocketV2.post("markReactionAsViewed", {
      data: {
        analytics: createLocketAnalytics(),
        moment_uid: momentId,
        reaction_created_at: reactionCreatedAt,
        reaction_uid: reactionId,
      },
    });

    return response.data;
  } catch (err) {
    console.warn("❌ markReactionAsViewed Failed", err);
    return null;
  }
};

export const GetLastestMoment = async () => {
  try {
    const body = {
      data: {
        excluded_users: [],
        fetch_streak: true,
        should_count_missed_moments: true,
      },
    };

    const res = await instanceLocketV2.post("getLatestMomentV2", body); // 👈 thêm body
    const moments = res.data.result;
    return moments;
  } catch (err) {
    console.warn("❌ React Failed", err);
  }
};

export const SendMessageMoment = async (message, selectedMomentId, uid) => {
  try {
    const body = {
      data: {
        msg: message || " ", // Nội dung tin nhắn
        analytics: {
          amplitude: {
            device_id: generateUUIDv4Upper(),
            session_id: -1,
          },
          google_analytics: {
            app_instance_id: generateUUIDv4Upper().replace(/-/g, "").toLowerCase(),
          },
          android_version: "1.196.0",
          android_build: "406",
          platform: "android",
        },
        client_token: generateUUIDv4Upper(),
        moment_uid: selectedMomentId || null,
        receiver_uid: uid,
      },
    };

    const response = await instanceLocketV2.post("sendChatMessageV2", body);

    return response.data;
  } catch (err) {
    console.error("sendMessage error:", err);
    throw err;
  }
};

export const DeleteMoment = async (selectedMomentId) => {
  try {
    const infoMoment = await getMomentById(selectedMomentId);
    const { localId } = getToken();

    if (!infoMoment) {
      console.warn("❌ Moment not found for deletion");
      return null;
    }

    //Xác định có xoá toàn cục không?
    const deleteGlobally = infoMoment.user === localId;

    const body = {
      data: {
        moment_uid: selectedMomentId,
        owner_uid: infoMoment.user,
        delete_globally: deleteGlobally, // true nếu là chủ sở hữu
      },
    };

    const res = await instanceLocketV2.post("deleteMomentV2", body);

    const deletedIds = res?.data?.result?.data;
    const deletedId = Array.isArray(deletedIds) ? deletedIds[0] : null;
    return deletedId; // 👉 trả về ID đã xoá
  } catch (err) {
    console.warn("❌ Failed", err);
    return null;
  }
};

export const markAsViewedMoment = async (selectedMomentId) => {
  try {
    const body = {
      data: {
        moment_uid: selectedMomentId,
        notify: false,
      },
    };
    const res = await instanceLocketV2.post("markMomentAsViewed", body);
    const moments = res.data;
    return moments;
  } catch (err) {
    console.warn("❌ Failed", err);
  }
};
