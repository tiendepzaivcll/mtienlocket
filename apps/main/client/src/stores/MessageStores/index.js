// src/store/messagesStore.js
import { create } from "zustand";
import { GetAllMessage, getMessagesPageWithUser } from "@/services";
import {
  getAllConversations,
  getMessagesByConversationId,
  saveConversations,
  saveMessages,
  deleteMessagesByIds,
  deleteMessageById,
  upsertConversations,
} from "@/cache/chatsDB";
import { MESSAGES_CONFIG } from "@/config";
import { reconcileMessages } from "./messageDedupe";
import {
  removeMessageById,
  updateMessageReaction,
} from "./messageMutations";

const { initialVisible } = MESSAGES_CONFIG;

export const useMessagesStore = create((set, get) => ({
  // ==== 1️⃣ State chính ====
  conversations: [], // danh sách các conversation (hiển thị sidebar, chỉ info cơ bản)
  messages: {}, // tin nhắn thực tế, lưu theo userId: { [userId]: [msg1, msg2, ...] }
  loading: false,
  hasMore: true,
  visibleCount: initialVisible,
  isLoadingMore: false,
  messagePageTokens: {},
  messageHasMore: {},
  loadingOlderConversation: null,

  // ==== 2️⃣ Fetch tất cả conversations từ local → API ====
  fetchConversations: async () => {
    set({ loading: true });
    try {
      const localData = await getAllConversations();
      set({
        conversations: localData?.length
          ? [...localData].sort((a, b) => b.update_time - a.update_time)
          : [],
      });
      const apiData = await GetAllMessage({ limit: initialVisible });
      if (apiData?.length) {
        set({
          conversations: [...apiData].sort(
            (a, b) => b.update_time - a.update_time
          ),
        });
        saveConversations(apiData); // lưu vào local DB
      }
    } catch (err) {
      console.error("Fetch messages error:", err);
    } finally {
      set({ loading: false });
    }
  },

  upsertConversation: (conversation) => {
    const { conversations } = get();
    const map = new Map(conversations.map((c) => [c.uid, c]));

    map.set(conversation.uid, {
      ...map.get(conversation.uid),
      ...conversation,
      update_time: Date.now(),
    });

    const merged = [...map.values()].sort(
      (a, b) => b.update_time - a.update_time
    );

    set({ conversations: merged });

    upsertConversations(conversation);
  },

  // ➕ ADD / UPSERT CONVERSATION
  addConversation: (conversation) => {
    const { conversations } = get();

    const map = new Map(conversations.map((c) => [c.uid, c]));
    map.set(conversation.uid, {
      ...map.get(conversation.uid),
      ...conversation,
    });

    const merged = [...map.values()].sort(
      (a, b) => b.update_time - a.update_time
    );

    set({ conversations: merged });
    saveConversations([conversation]);
  },

  // ==== 3️⃣ Lấy tin nhắn theo userId (conversationId) ====
  getMessagesByUser: async (conversationId, { force = false } = {}) => {
    const { messages } = get();

    // 1. Nếu đã cache → trả ngay
    if (!force && messages[conversationId]?.length) {
      return messages[conversationId];
    }

    // 2. Load local DB
    const local = messages[conversationId]?.length
      ? messages[conversationId]
      : await getMessagesByConversationId(conversationId);
    if (!messages[conversationId]?.length) {
      set({
        messages: { ...messages, [conversationId]: local },
      });
    }

    // 3. Sync API
    // Note: Phải để null mới get các mess từ mới nhất về cũ
    const page = await getMessagesPageWithUser({
      messageId: conversationId,
    });
    const apiData = page?.messages;

    set((state) => ({
      messagePageTokens: {
        ...state.messagePageTokens,
        [conversationId]: page?.nextPageToken || null,
      },
      messageHasMore: {
        ...state.messageHasMore,
        [conversationId]: Boolean(page?.nextPageToken),
      },
    }));

    if (apiData?.length) {
      await saveMessages(apiData);

      const { messages: merged, replacedClientIds } = reconcileMessages(
        local,
        apiData,
      );
      await deleteMessagesByIds(replacedClientIds);

      set({
        messages: {
          ...get().messages,
          [conversationId]: merged,
        },
      });

      return merged;
    }

    return local;
  },

  refreshRecentMessageThreads: async (limit = 4) => {
    const state = get();
    const recentConversationIds = state.conversations
      .filter((conversation) => state.messages[conversation.uid]?.length)
      .sort((a, b) => Number(b.update_time || 0) - Number(a.update_time || 0))
      .slice(0, Math.max(0, Number(limit) || 0))
      .map((conversation) => conversation.uid)
      .filter(Boolean);

    await Promise.allSettled(
      recentConversationIds.map((conversationId) =>
        get().getMessagesByUser(conversationId, { force: true }),
      ),
    );
  },

  loadOlderMessages: async (conversationId) => {
    const state = get();
    const pageToken = state.messagePageTokens[conversationId];
    if (!conversationId || !pageToken || state.loadingOlderConversation) {
      return false;
    }

    set({ loadingOlderConversation: conversationId });
    try {
      const page = await getMessagesPageWithUser({
        messageId: conversationId,
        pageToken,
        limit: 50,
      });
      const incoming = page?.messages || [];
      const current = get().messages[conversationId] || [];
      const { messages: merged, replacedClientIds } = reconcileMessages(
        current,
        incoming,
      );

      await Promise.all([
        saveMessages(incoming),
        deleteMessagesByIds(replacedClientIds),
      ]);
      set((latest) => ({
        messages: { ...latest.messages, [conversationId]: merged },
        messagePageTokens: {
          ...latest.messagePageTokens,
          [conversationId]: page?.nextPageToken || null,
        },
        messageHasMore: {
          ...latest.messageHasMore,
          [conversationId]: Boolean(page?.nextPageToken),
        },
      }));
      return incoming.length > 0;
    } finally {
      set({ loadingOlderConversation: null });
    }
  },

  markConversationRead: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.uid === conversationId
          ? { ...conversation, isRead: true, unreadCount: 0 }
          : conversation,
      ),
    }));
  },

  // ==== 4️⃣ Add message mới ====
  addMessageWithUser: async (conversationId, msg) => {
    const { messages } = get();
    const current = messages[conversationId] || [];

    if (current.some((m) => m.id === msg.id)) return;

    const updated = [msg, ...current].sort(
      (a, b) => b.update_time - a.update_time
    );

    set({
      messages: {
        ...messages,
        [conversationId]: updated,
      },
    });

    await saveMessages(msg);
  },
  // ==== 4️⃣ Add message mới ====
  addMessageWithUserV2: async (conversationId, newMessages) => {
    if (!conversationId || !newMessages) return;

    // 1️⃣ Chuẩn hoá payload
    const items = Array.isArray(newMessages) ? newMessages : [newMessages];

    const current = get().messages[conversationId] || [];
    const {
      messages: updated,
      incoming,
      replacedClientIds,
    } = reconcileMessages(current, items);

    if (!incoming.length) return;

    set({
      messages: {
        ...get().messages,
        [conversationId]: updated,
      },
    });

    // 4️⃣ Lưu cache / DB
    await Promise.all([
      saveMessages(incoming),
      deleteMessagesByIds(replacedClientIds),
    ]);
  },

  // ==== 5️⃣ Remove message ====
  removeMessage: async (conversationId, msgId) => {
    if (!conversationId || !msgId) return;
    const current = get().messages[conversationId] || [];
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: removeMessageById(current, msgId),
      },
    }));
    await deleteMessageById(msgId);
  },

  updateReaction: async (conversationId, msgId, userId, emoji) => {
    if (!conversationId || !msgId || !userId) return;
    const updated = updateMessageReaction(
      get().messages[conversationId] || [],
      msgId,
      userId,
      emoji,
    );
    set((state) => ({
      messages: { ...state.messages, [conversationId]: updated },
    }));
    const changed = updated.find((message) => message.id === msgId);
    if (changed) await saveMessages(changed);
  },

  // ==== 6️⃣ Reset / scroll ====
  resetVisible: () => set({ visibleCount: initialVisible }),
  increaseVisibleCount: () => {
    const { visibleCount, messages } = get();
    if (visibleCount < messages.length) {
      set({
        visibleCount: Math.min(visibleCount + initialVisible, messages.length),
      });
    }
  },
}));
