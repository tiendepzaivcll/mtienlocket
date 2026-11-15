import { instanceLocketV2 } from "@/libs/instanceLocket";
import { generateUUIDv4Upper } from "@/utils/generate/uuid";

const int64Value = (value) => ({
  "@type": "type.googleapis.com/google.protobuf.Int64Value",
  value: String(value),
});

const groupResult = (response) => {
  const result = response.data?.result;
  const status = Number(result?.status || 200);
  if (status >= 400 || response.data?.error) {
    const error = new Error(
      response.data?.error?.message || result?.message || "Group operation failed",
    );
    error.status = status;
    throw error;
  }
  return result?.data ?? null;
};

export async function getGroupsState({ groupIds, lastFetchedAt } = {}) {
  const data = {};
  if (groupIds?.length) data.current_group_ids = groupIds;
  if (lastFetchedAt) data.last_fetched_at = int64Value(lastFetchedAt);
  return groupResult(await instanceLocketV2.post("getGroupsState", { data }));
}

export async function getGroupMessages({
  groupId,
  limit = 40,
  beforeTimestamp,
} = {}) {
  const data = {
    group_id: groupId,
    limit: int64Value(limit),
  };
  if (beforeTimestamp) data.before_timestamp = int64Value(beforeTimestamp);
  return groupResult(await instanceLocketV2.post("getGroupMessages", { data }));
}

async function groupChatOp(type, data) {
  return groupResult(
    await instanceLocketV2.post("groupChatOp", {
      data: { type, ...data },
    }),
  );
}

export const sendGroupMessage = ({ groupId, message, clientToken }) =>
  groupChatOp("sendMessage", {
    group_id: groupId,
    message,
    client_token: clientToken || generateUUIDv4Upper(),
  });

export const reactToGroupMessage = ({ groupId, messageId, emoji }) =>
  groupChatOp("addReaction", {
    group_id: groupId,
    message_id: messageId,
    emoji,
  });

export const removeGroupMessageReaction = ({ groupId, messageId }) =>
  groupChatOp("removeReaction", {
    group_id: groupId,
    message_id: messageId,
  });

export const deleteGroupMessage = ({ groupId, messageId }) =>
  groupChatOp("deleteMessage", {
    group_id: groupId,
    message_id: messageId,
  });

export const markGroupAsRead = ({ groupId, timestamp = Date.now() }) =>
  groupChatOp("markAsRead", {
    group_id: groupId,
    timestamp: int64Value(timestamp),
  });
