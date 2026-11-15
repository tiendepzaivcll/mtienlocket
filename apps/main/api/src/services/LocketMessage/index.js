const { instanceFirestore, instanceLocketV2 } = require("../../libs");
const {
  normalizeChatMessageDocument,
  normalizeConversationDocument,
} = require("../FirestoreRead");
const { getRollcallMedia } = require("./rollcallMedia");

const getAllMessages = async (idToken, userId, pageToken, limit = 20) => {
  const params = {
    pageSize: limit,
    orderBy: "last_updated desc", // hoặc "updateTime desc"
  };

  if (pageToken) params.pageToken = pageToken;

  try {
    const response = await instanceFirestore.get(
      `/(default)/documents/users/${userId}/conversations`,
      {
        params,
        meta: {
          idToken,
        },
      },
    );
    const documents = response.data.documents || [];
    // Chuẩn hoá dữ liệu Firestore -> plain object
    const conversations = documents
      .map((doc) => normalizeConversationDocument(doc, userId))
      .filter(Boolean);

    return {
      messages: conversations,
      nextPageToken: response.data.nextPageToken || null,
    };
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy mess:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

const getMessagesWithUser = async (idToken, userId, conversationId, pageToken, limit = 50, otherUserId = null) => {
  const params = {
    pageSize: limit,
    orderBy: "created_at desc",
  };

  if (pageToken) params.pageToken = pageToken;

  try {
    // Correct path: messages are stored in central conversations collection
    const path = `/(default)/documents/conversations/${conversationId}/messages`;
    const response = await instanceFirestore.get(path, {
      params,
      meta: { idToken },
    });

    const documents = response.data.documents || [];
    const messages = documents
      .map((doc) => normalizeChatMessageDocument(doc, conversationId))
      .filter(Boolean);

    return {
      messages,
      nextPageToken: response.data.nextPageToken || null,
    };

  } catch (error) {
    console.error("❌ Error getting messages:", error.response?.data || error.message);
    throw error;
  }
};

const getRollcallPosts = async (idToken, weekOfYear, year, source = "feed") => {
  try {
    const body = {
      data: {
        week_of_year: {
          "@type": "type.googleapis.com/google.protobuf.Int64Value",
          value: weekOfYear,
        },
        source: source,
        year: {
          "@type": "type.googleapis.com/google.protobuf.Int64Value",
          value: year,
        },
      },
    };

    const response = await instanceLocketV2.post("getRollcallPosts", body, {
      meta: { idToken },
    });

    return response.data?.result?.data?.posts || [];
  } catch (error) {
    console.error("❌ getRollcallPosts error:", error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  getAllMessages,
  getMessagesWithUser,
  getRollcallPosts,
  getRollcallMedia,
};
