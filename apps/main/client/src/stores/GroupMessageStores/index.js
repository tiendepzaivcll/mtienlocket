import { create } from "zustand";
import {
  getGroupMessages,
  getGroupsState,
  markGroupAsRead,
} from "@/services";
import {
  deleteGroupsByIds,
  getAllGroups,
  saveGroups,
  setGroupsLastFetchedAt,
} from "@/cache/groupsDB";
import {
  deleteMessageById,
  getMessagesByConversationId,
  saveMessages,
} from "@/cache/chatsDB";
import { reconcileMessages } from "@/stores/MessageStores/messageDedupe";
import {
  normalizeGroupMessage,
  removeMessageById,
  updateMessageReaction,
} from "@/stores/MessageStores/messageMutations";

const sortGroups = (groups) =>
  [...groups].sort(
    (a, b) => Number(b.last_updated_at || 0) - Number(a.last_updated_at || 0),
  );

const mergeGroups = (current, incoming, removedIds = []) => {
  const removed = new Set(removedIds);
  const byId = new Map(
    current.filter((group) => !removed.has(group.id)).map((group) => [group.id, group]),
  );
  incoming.forEach((group) => {
    if (group?.id) byId.set(group.id, { ...byId.get(group.id), ...group });
  });
  return sortGroups([...byId.values()]);
};

export const useGroupMessagesStore = create((set, get) => ({
  groups: [],
  messages: {},
  loadingGroups: false,
  loadingConversation: null,
  loadingOlderConversation: null,
  groupHasMore: {},

  fetchGroups: async () => {
    set({ loadingGroups: true });
    try {
      const local = await getAllGroups();
      if (local.length) set({ groups: sortGroups(local) });

      const response = await getGroupsState();
      if (!response) return get().groups;
      const incoming = Array.isArray(response.groups) ? response.groups : [];
      const removedIds = Array.isArray(response.removed_group_ids)
        ? response.removed_group_ids
        : [];
      const serverIds = new Set(incoming.map((group) => group.id));
      const missingIds = get()
        .groups.filter((group) => !serverIds.has(group.id))
        .map((group) => group.id);
      const allRemovedIds = [...new Set([...removedIds, ...missingIds])];
      const groups = mergeGroups(get().groups, incoming, allRemovedIds);
      set({ groups });
      await Promise.all([
        saveGroups(groups),
        deleteGroupsByIds(allRemovedIds),
      ]);
      const latest = Math.max(
        0,
        ...groups.map((group) => Number(group.last_updated_at || 0)),
      );
      if (latest) await setGroupsLastFetchedAt(latest);
      return groups;
    } catch (error) {
      console.error("fetchGroups error:", error);
      return get().groups;
    } finally {
      set({ loadingGroups: false });
    }
  },

  fetchGroupMessages: async (groupId, { force = false } = {}) => {
    if (!groupId) return [];
    const cached = get().messages[groupId] || [];
    if (!force && cached.length) return cached;
    set({ loadingConversation: groupId });
    try {
      const local = cached.length
        ? cached
        : await getMessagesByConversationId(groupId);
      if (!cached.length && local.length) {
        set((state) => ({
          messages: { ...state.messages, [groupId]: local },
        }));
      }
      const response = await getGroupMessages({ groupId, limit: 40 });
      const incoming = (response?.messages || [])
        .map((message) => normalizeGroupMessage(message, groupId))
        .filter(Boolean);
      const { messages } = reconcileMessages(local, incoming);
      set((state) => ({
        messages: { ...state.messages, [groupId]: messages },
        groupHasMore: {
          ...state.groupHasMore,
          [groupId]: incoming.length >= 40,
        },
      }));
      await saveMessages(incoming);
      return messages;
    } catch (error) {
      console.error("fetchGroupMessages error:", error);
      return get().messages[groupId] || [];
    } finally {
      set({ loadingConversation: null });
    }
  },

  loadOlderGroupMessages: async (groupId) => {
    const current = get().messages[groupId] || [];
    if (!groupId || !current.length || get().loadingOlderConversation) {
      return false;
    }
    const beforeTimestamp = Math.min(
      ...current.map((message) => Number(message.created_at || 0)).filter(Boolean),
    );
    if (!Number.isFinite(beforeTimestamp)) return false;
    set({ loadingOlderConversation: groupId });
    try {
      const response = await getGroupMessages({
        groupId,
        limit: 40,
        beforeTimestamp,
      });
      const incoming = (response?.messages || [])
        .map((message) => normalizeGroupMessage(message, groupId))
        .filter(Boolean);
      const { messages } = reconcileMessages(current, incoming);
      set((state) => ({
        messages: { ...state.messages, [groupId]: messages },
        groupHasMore: {
          ...state.groupHasMore,
          [groupId]: incoming.length >= 40,
        },
      }));
      await saveMessages(incoming);
      return incoming.length > 0;
    } finally {
      set({ loadingOlderConversation: null });
    }
  },

  markGroupRead: async (groupId) => {
    const timestamp = Date.now();
    set((state) => ({
      groups: state.groups.map((group) =>
        group.id === groupId
          ? { ...group, unread_count: 0, last_read_at: timestamp }
          : group,
      ),
    }));
    await markGroupAsRead({ groupId, timestamp });
  },

  updateReaction: async (groupId, messageId, userId, emoji) => {
    const updated = updateMessageReaction(
      get().messages[groupId] || [],
      messageId,
      userId,
      emoji,
    );
    set((state) => ({
      messages: { ...state.messages, [groupId]: updated },
    }));
    const changed = updated.find((message) => message.id === messageId);
    if (changed) await saveMessages(changed);
  },

  removeMessage: async (groupId, messageId) => {
    const updated = removeMessageById(get().messages[groupId] || [], messageId);
    set((state) => ({
      messages: { ...state.messages, [groupId]: updated },
      groups: state.groups.map((group) =>
        group.id === groupId && group.latest_message?.id === messageId
          ? { ...group, latest_message: updated[0] || null }
          : group,
      ),
    }));
    await deleteMessageById(messageId);
  },

  refreshActiveGroup: async (groupId) => {
    await Promise.allSettled([
      get().fetchGroups(),
      groupId
        ? get().fetchGroupMessages(groupId, { force: true })
        : Promise.resolve(),
    ]);
  },
}));
