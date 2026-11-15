import { loginHeader } from "@/constants/constrain";
import api from "@/libs/axios";
import { instanceLocket } from "@/libs/instanceLocket";
import { getToken } from "@/utils";
import { generateUUIDv4Upper } from "@/utils/generate/uuid";

export const GetAllMessage = async ({ timestamp = null, limit = 50 }) => {
  try {
    const res = await api.post("/locket/getAllMessageV2", {
      timestamp: timestamp,
      limit: limit,
    });
    return res.data?.data;
  } catch (err) {
    console.warn("Failed", err);
  }
};

export const getMessagesPageWithUser = async ({
  messageId, // 👈 uid của người cần lấy message
  pageToken = null,
  timestamp = null,
  limit = 50,
}) => {
  try {
    const res = await api.post("/locket/getMessageWithUserV2", {
      messageId: messageId,
      pageToken,
      timestamp,
      limit,
    });
    return {
      messages: res.data?.data || [],
      nextPageToken: res.data?.nextPageToken || null,
    };
  } catch (err) {
    console.warn("Failed", err);
    return null;
  }
};

export const getMessagesWithUser = async (params) =>
  (await getMessagesPageWithUser(params))?.messages || null;

export const sendMessage = async (messageInfo) => {
  try {
    const { idToken } = getToken();

    const body = {
      data: {
        msg: messageInfo.message || " ", // Nội dung tin nhắn
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
        client_token: messageInfo.client_token || generateUUIDv4Upper(),
        moment_uid: messageInfo?.moment_id || null,
        receiver_uid: messageInfo.receiver_uid,
      },
    };

    const response = await instanceLocket.post("sendChatMessageV2", body, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...loginHeader,
      },
    });

    return response.data;
  } catch (err) {
    console.error("sendMessage error:", {
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
    });
    throw err;
  }
};

export const markReadMessage = async (conversationId) => {
  try {
    const { idToken } = getToken();

    const body = {
      data: {
        conversation_uid: conversationId,
      },
    };

    const response = await instanceLocket.post("markAsRead", body, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...loginHeader,
      },
    });

    return response.data;
  } catch (err) {
    console.error("markReadMessage error:", {
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
    });
    throw err;
  }
};

export const sendReactionOnMessage = async (reactionData) => {
  try {
    const { idToken } = getToken();

    const body = {
      data: {
        message_id: reactionData.messageId,
        emoji: reactionData.emoji,
        conversation_id: reactionData.conversationId,
      },
    };

    const response = await instanceLocket.post(
      "sendChatMessageReaction",
      body,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...loginHeader,
        },
      }
    );

    return response.data;
  } catch (err) {
    console.error("sendReactionOnMessage error:", {
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
    });
    throw err;
  }
};

export const removeReactionOnMessage = async ({
  messageId,
  conversationId,
}) => {
  try {
    const { idToken } = getToken();
    const response = await instanceLocket.post(
      "removeChatMessageReaction",
      {
        data: {
          message_id: messageId,
          conversation_id: conversationId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...loginHeader,
        },
      },
    );

    return response.data;
  } catch (err) {
    console.error("removeReactionOnMessage error:", {
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
    });
    throw err;
  }
};

export const deleteMessage = async (deleteData) => {
  try {
    const { idToken } = getToken();

    const body = {
      data: {
        message_uid: deleteData.messageId || deleteData.message_uid,
        conversation_uid:
          deleteData.conversationId || deleteData.conversation_uid,
      },
    };

    const response = await instanceLocket.post("deleteChatMessage", body, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...loginHeader,
      },
    });

    return response.data;
  } catch (err) {
    console.error("deleteMessage error:", {
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
    });
    throw err;
  }
};
