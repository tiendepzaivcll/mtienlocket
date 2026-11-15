export const reactionUserId = (reaction) =>
  reaction?.sender || reaction?.user_id || reaction?.userId || null;

export function updateMessageReaction(
  messages = [],
  messageId,
  userId,
  emoji,
) {
  return messages.map((message) => {
    if (message?.id !== messageId) return message;

    const reactions = (Array.isArray(message.reactions)
      ? message.reactions
      : []
    ).filter((reaction) => reactionUserId(reaction) !== userId);

    if (emoji) {
      reactions.push({
        sender: userId,
        user_id: userId,
        emoji,
        created_at: Math.floor(Date.now() / 1000),
      });
    }

    return { ...message, reactions };
  });
}

export const removeMessageById = (messages = [], messageId) =>
  messages.filter((message) => message?.id !== messageId);

export function normalizeGroupMessage(message, groupId) {
  if (!message?.id) return null;
  const rawCreatedAt = Number(
    message.created_at || message.create_time || message.update_time || 0,
  );
  const createdAtMs =
    rawCreatedAt > 0 && rawCreatedAt < 100_000_000_000
      ? rawCreatedAt * 1000
      : rawCreatedAt;
  const createdAtSeconds = createdAtMs
    ? Math.floor(createdAtMs / 1000)
    : Math.floor(Date.now() / 1000);
  const content =
    message.content && typeof message.content === "object"
      ? message.content
      : { type: "text", content: message.text || "" };

  return {
    ...message,
    uid: groupId,
    group_id: groupId,
    sender: message.sender || message.user_id || "",
    user_id: message.user_id || message.sender || "",
    text: message.text || content.content || "",
    content,
    created_at: createdAtMs,
    create_time: createdAtSeconds,
    update_time: createdAtSeconds,
    reactions: (Array.isArray(message.reactions) ? message.reactions : []).map(
      (reaction) => ({
        ...reaction,
        sender: reactionUserId(reaction),
        user_id: reactionUserId(reaction),
      }),
    ),
  };
}
