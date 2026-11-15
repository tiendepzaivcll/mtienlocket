import api from "@/lib/axios";

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

export const getMessagesWithUser = async ({
  messageId, // 👈 uid của conversation
  withUser, // 👈 uid của người đối thoại
  timestamp = null,
}) => {
  try {
    const res = await api.post("/locket/getMessageWithUserV2", {
      messageId: messageId,
      otherUserId: withUser,
      timestamp,
    });
    return res.data?.data;
  } catch (err) {
    console.warn("Failed", err);
    return null;
  }
};
