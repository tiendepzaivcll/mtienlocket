import db from "./configDB";

const GROUPS_META_KEY = "groups_sync";

export async function getAllGroups() {
  return db.groups.orderBy("last_updated_at").reverse().toArray();
}

export async function saveGroups(groups = []) {
  if (groups.length) await db.groups.bulkPut(groups);
}

export async function deleteGroupsByIds(groupIds = []) {
  const ids = [...new Set(groupIds.filter(Boolean))];
  if (ids.length) await db.groups.bulkDelete(ids);
}

export async function getGroupsLastFetchedAt() {
  return (await db.groupsMeta.get(GROUPS_META_KEY))?.lastFetchedAt || 0;
}

export async function setGroupsLastFetchedAt(lastFetchedAt) {
  await db.groupsMeta.put({
    key: GROUPS_META_KEY,
    lastFetchedAt,
    updatedAt: Date.now(),
  });
}
