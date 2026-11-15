const pick = (value, camelKey, snakeKey) =>
  value?.[camelKey] ?? value?.[snakeKey];

const getString = (field) => pick(field, "stringValue", "string_value") ?? null;
const getBoolean = (field) =>
  pick(field, "booleanValue", "boolean_value") ?? false;
const getInteger = (field) => {
  const value = pick(field, "integerValue", "integer_value");
  return value === undefined || value === null ? 0 : Number.parseInt(value, 10);
};
const getTimestamp = (field) =>
  pick(field, "timestampValue", "timestamp_value") ?? null;
const getMapFields = (field) =>
  pick(field, "mapValue", "map_value")?.fields || {};
const getArrayValues = (field) =>
  pick(field, "arrayValue", "array_value")?.values || [];

function timestampToMillis(value) {
  const timestamp = getTimestamp(value) ?? value;
  if (!timestamp) return 0;

  if (typeof timestamp === "string") {
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const seconds = Number(timestamp.seconds ?? timestamp._seconds ?? 0);
  const nanos = Number(timestamp.nanos ?? timestamp._nanoseconds ?? 0);
  return seconds * 1000 + Math.floor(nanos / 1e6);
}

const timestampToSeconds = (value) =>
  Math.floor(timestampToMillis(value) / 1000);

function decodeFirestoreValue(value) {
  if (!value) return null;
  if (pick(value, "nullValue", "null_value") !== undefined) return null;

  const stringValue = getString(value);
  if (stringValue !== null) return stringValue;

  const integerValue = pick(value, "integerValue", "integer_value");
  if (integerValue !== undefined) return Number.parseInt(integerValue, 10);

  const doubleValue = pick(value, "doubleValue", "double_value");
  if (doubleValue !== undefined) return Number(doubleValue);

  const booleanValue = pick(value, "booleanValue", "boolean_value");
  if (booleanValue !== undefined) return booleanValue;

  const timestampValue = getTimestamp(value);
  if (timestampValue !== null) return timestampToMillis(timestampValue);

  const mapValue = pick(value, "mapValue", "map_value");
  if (mapValue !== undefined) {
    return Object.fromEntries(
      Object.entries(mapValue.fields || {}).map(([key, child]) => [
        key,
        decodeFirestoreValue(child),
      ]),
    );
  }

  const arrayValue = pick(value, "arrayValue", "array_value");
  if (arrayValue !== undefined) {
    return (arrayValue.values || []).map(decodeFirestoreValue);
  }

  return null;
}

const getDocument = (input) =>
  input?.document_change?.document || input?.documentChange?.document || input;

const getDocumentId = (document) => document?.name?.split("/").pop() || null;

function normalizeFriendDocument(input) {
  const document = getDocument(input);
  if (!document?.fields) return null;
  const fields = document.fields;
  const uid = getString(fields.user) || getDocumentId(document);
  if (!uid) return null;

  const createdAt = timestampToMillis(document.createTime || document.create_time);
  const updatedAt = timestampToMillis(document.updateTime || document.update_time);

  return {
    uid,
    date: document.createTime || document.create_time || null,
    createdAt,
    updatedAt,
    hidden: getBoolean(fields.hidden),
    isCelebrity: getBoolean(fields.celebrity),
    sharedHistoryOn: fields.shared_history_on
      ? timestampToMillis(fields.shared_history_on)
      : null,
  };
}

function normalizeConversationDocument(input, userId) {
  const document = getDocument(input);
  if (!document?.fields) return null;
  const fields = document.fields;
  const members = getArrayValues(fields.members)
    .map(getString)
    .filter(Boolean);
  const latestFields = getMapFields(fields.latest_message);
  const uid = getString(fields.uid) || getDocumentId(document);
  if (!uid) return null;

  const latestMessage = Object.keys(latestFields).length
    ? {
        body: getString(latestFields.body) || "",
        sender: getString(latestFields.sender) || "",
        createdAt: timestampToSeconds(latestFields.created_at),
        replyMoment: getString(latestFields.reply_moment),
        thumbnailUrl: getString(latestFields.thumbnail_url),
      }
    : null;

  return {
    uid,
    members,
    with_user: members.find((member) => member !== userId) || null,
    unreadCount: getInteger(fields.unread_count),
    isRead: getBoolean(fields.is_read),
    lastReadAt: timestampToSeconds(fields.last_read_at),
    otherLastReadAt: timestampToSeconds(fields.other_last_read_at),
    lastUpdated: timestampToSeconds(fields.last_updated),
    update_time: latestMessage?.createdAt || timestampToSeconds(fields.last_updated),
    latestMessage,
    otherLastDeliveredAt: timestampToSeconds(fields.other_last_delivered_at),
    otherLastDeliveredMessageCreatedAt: timestampToSeconds(
      fields.other_last_delivered_message_created_at,
    ),
    createTime: timestampToSeconds(document.createTime || document.create_time),
    updateTime: timestampToSeconds(document.updateTime || document.update_time),
  };
}

function normalizeChatMessageDocument(input, conversationId = null) {
  const document = getDocument(input);
  if (!document?.fields) return null;
  const fields = document.fields;
  const pathParts = document.name?.split("/") || [];
  const conversationIndex = pathParts.indexOf("conversations");
  const resolvedConversationId =
    conversationId ||
    (conversationIndex >= 0 ? pathParts[conversationIndex + 1] : null);

  return {
    id: getDocumentId(document),
    uid: resolvedConversationId,
    client_token: getString(fields.client_token),
    text: getString(fields.body) || "",
    sender: getString(fields.sender) || "",
    thumbnail_url: getString(fields.thumbnail_url),
    reply_moment: getString(fields.reply_moment),
    reactions: getArrayValues(fields.reactions).map((reaction) => {
      const reactionFields = getMapFields(reaction);
      return {
        sender: getString(reactionFields.sender),
        emoji: getString(reactionFields.emoji),
        created_at: timestampToSeconds(reactionFields.created_at),
      };
    }),
    create_time:
      timestampToSeconds(fields.created_at) ||
      timestampToSeconds(document.createTime || document.create_time),
    update_time:
      timestampToSeconds(fields.created_at) ||
      timestampToSeconds(document.updateTime || document.update_time),
  };
}

module.exports = {
  decodeFirestoreValue,
  getArrayValues,
  getBoolean,
  getDocument,
  getDocumentId,
  getMapFields,
  getString,
  normalizeChatMessageDocument,
  normalizeConversationDocument,
  normalizeFriendDocument,
  timestampToMillis,
  timestampToSeconds,
};
