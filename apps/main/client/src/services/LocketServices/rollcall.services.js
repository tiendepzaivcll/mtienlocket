import api from "@/libs/axios";
import { instanceLocketV2 } from "@/libs/instanceLocket";
import { getISOWeek } from "@/utils";

function isCanceledRequest(error, signal) {
  return (
    signal?.aborted ||
    error?.name === "CanceledError" ||
    error?.code === "ERR_CANCELED"
  );
}

export const getRollcallPosts = async ({ selectWeek, selectYear, signal }) => {
  const { year, week } = getISOWeek();
  const requestedWeek = selectWeek || week;
  const requestedYear = selectYear || year;

  try {
    const res = await api.post("/locket/getRollcallPosts", {
      week_of_year: requestedWeek,
      source: "feed",
      year: requestedYear,
    }, {
      signal,
    });
    return Array.isArray(res.data?.data) ? res.data.data : [];
  } catch (proxyError) {
    if (isCanceledRequest(proxyError, signal)) throw proxyError;

    const body = {
      data: {
        week_of_year: {
          "@type": "type.googleapis.com/google.protobuf.Int64Value",
          value: requestedWeek,
        },
        source: "feed",
        year: {
          "@type": "type.googleapis.com/google.protobuf.Int64Value",
          value: requestedYear,
        },
      },
    };

    try {
      const res = await instanceLocketV2.post("getRollcallPosts", body, {
        signal,
      });
      return res.data?.result?.data?.posts || [];
    } catch (directError) {
      if (isCanceledRequest(directError, signal)) throw directError;
      console.warn("❌ Failed to load Rollcalls", directError);
      throw directError?.response ? directError : proxyError;
    }
  }
};

export const getRollcallMediaObjectUrl = async (url, { signal } = {}) => {
  if (!url || typeof URL === "undefined") {
    throw new Error("Missing Rollcall media URL");
  }

  const res = await api.get("/locket/getRollcallMediaV2", {
    params: { url },
    responseType: "blob",
    signal,
    timeout: 35_000,
  });
  const blob = res.data;

  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("Empty Rollcall media blob");
  }

  return URL.createObjectURL(blob);
};

export const postRollcallReaction = async () => {
  try {
    const body = {
      data: {
        x: 0,
        y: 1,
        rotation: 0.17351480882007525,
        reaction: "🔥",
        post_user_uid: "NzGrCyCyOjcVPpGvlLcaiIiujaA3",
        post_uid: "bSIcLYRunxenfxptYFeQ",
        scale: 1,
      },
    };
    const res = await instanceLocketV2.post("postRollcallReaction", body);
    const moments = res.data?.result?.data?.posts;
    return moments;
  } catch (err) {
    console.warn("❌ Failed", err);
  }
};

// {
//   "result": {
//     "status": 200
// }

export const likeRollcallComment = async () => {
  try {
    const body = {
      data: {
        post_user_uid: "NzGrCyCyOjcVPpGvlLcaiIiujaA3",
        post_uid: "bSIcLYRunxenfxptYFeQ",
        post_comment_id: "STgwjqm0Kq4bzPHQ4x25",
        like: true,
      },
    };
    const res = await instanceLocketV2.post("likeRollcallComment", body);
    const moments = res.data?.result;
    return moments;
  } catch (err) {
    console.warn("❌ Failed", err);
  }
};

// {
//   "result": {
//     "status": 200,
//     "data": {
//       "comment": {
//         "body": "Ghê",
//         "created_at": {
//           "_seconds": 1765688999,
//           "_nanoseconds": 164000000
//         },
//         "user": "RCQ94Icmh7fvFr5ycLaHJgyQo8j1",
//         "post_item_uid": "XWqy6VIigU0udv7cJP7V",
//         "uid": "STgwjqm0Kq4bzPHQ4x25",
//         "likes": []
//       }
//     }
//   }
// }
export const postRollcallComment = async () => {
  try {
    const body = {
      data: {
        reply_user_uid: "uid", // neeus reply thi them
        post_user_uid: "NzGrCyCyOjcVPpGvlLcaiIiujaA3",
        post_uid: "bSIcLYRunxenfxptYFeQ",
        post_item_id: "STgwjqm0Kq4bzPHQ4x25",
        body: "string",
      },
    };
    const res = await instanceLocketV2.post("postRollcallComment", body);
    const moments = res.data?.result;
    return moments;
  } catch (err) {
    console.warn("❌ Failed", err);
  }
};
