import db from "./configDB";

export async function saveConversations(conversations) {
  try {
    await db.conversations.bulkPut(conversations);
    // console.log("✅ Saved conversations:", conversations.length);
  } catch (err) {
    console.error("❌ Failed to save conversations:", err);
  }
}

export async function getAllConversations() {
  try {
    const items = await db.conversations
      .orderBy("update_time") // sắp xếp theo createdAt
      .reverse() // mới nhất lên đầu
      .toArray();

    // console.log("📥 Loaded conversations:", items.length);
    return items;
  } catch (err) {
    console.error("❌ Failed to load conversations:", err);
    return [];
  }
}

// Upsert 1 hoặc nhiều hội thoại (thêm mới nếu chưa có, update nếu trùng)
export async function upsertConversations(conversations) {
  try {
    const items = Array.isArray(conversations)
      ? conversations
      : [conversations];
    await db.conversations.bulkPut(items); // bulkPut đã tự động upsert
    // console.log("🔄 Upsert conversations:", items.length);
  } catch (err) {
    console.error("❌ Failed to upsert conversations:", err);
  }
}

export async function saveMessages(messages) {
  const items = Array.isArray(messages) ? messages : messages ? [messages] : [];
  if (!items.length) return;
  try {
    await db.messages.bulkPut(items);
  } catch (err) {
    console.error("[saveMessages] bulkPut failed", {
      error: err,
      messages: items,
    });
  }
}

export async function deleteMessagesByIds(messageIds = []) {
  const ids = [...new Set(messageIds.filter(Boolean))];
  if (!ids.length) return;
  await db.messages.bulkDelete(ids);
}

export async function deleteMessageById(messageId) {
  if (!messageId) return;
  await db.messages.delete(messageId);
}


export async function addMessage(message) {
  await db.messages.put(message);
}

export async function getMessagesByConversationId(
  conversationId,
  limit = 50
) {
  const items = await db.messages
    .where("uid")
    .equals(conversationId)
    .toArray();

  return items
    .sort((a, b) => b.update_time - a.update_time)
    .slice(0, limit);
}

export async function getOlderMessages(conversationId, beforeTime, limit = 50) {
  return await db.messages
    .where("conversationId")
    .equals(conversationId)
    .and((m) => m.update_time < beforeTime)
    .orderBy("update_time")
    .reverse()
    .limit(limit)
    .toArray();
}

export async function saveMessageWithUsers(conversationId, withUser, messages) {
  try {
    // Tạo record mới
    await db.conversationWithUser.put({
      uid: conversationId,
      with_user: withUser,
      messages,
      update_time: Date.now(),
    });
    // console.log("Saved messages for conversation:", conversationId);
  } catch (err) {
    console.error("Failed to save messages:", err);
  }
}

export async function getAllMessages() {
  try {
    const items = await db.conversationWithUser
      .orderBy("update_time") // sắp xếp theo createdAt
      .reverse() // mới nhất lên đầu
      .toArray();

    // console.log("📥 Loaded conversations:", items.length);
    return items;
  } catch (err) {
    console.error("❌ Failed to load conversations:", err);
    return [];
  }
}

// Thêm 1 tin nhắn mới vào messages của conversation
export async function addMessageToConversation(
  conversationId,
  withUser,
  newMessage
) {
  try {
    const existing = await db.conversationWithUser.get(conversationId);

    if (existing) {
      // Nếu đã có record, append message mới
      await db.conversationWithUser.put({
        ...existing,
        messages: [...(existing.messages || []), newMessage],
        update_time: Date.now(),
      });
    } else {
      // Nếu chưa có record, tạo mới
      await db.conversationWithUser.put({
        uid: conversationId,
        with_user: withUser,
        messages: [newMessage],
        update_time: Date.now(),
      });
    }

    // console.log("✅ Added new message to conversation:", conversationId);
  } catch (err) {
    console.error("❌ Failed to add message:", err);
  }
}

// Xoá toàn bộ dữ liệu trong 1 bảng (ví dụ conversations)
export async function clearConversations() {
  try {
    await db.conversations.clear();
    console.log("🗑️ Cleared all conversations");
  } catch (err) {
    console.error("❌ Failed to clear conversations:", err);
  }
}
