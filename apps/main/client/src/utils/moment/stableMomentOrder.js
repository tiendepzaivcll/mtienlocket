const momentId = (item) =>
  item?.id === null || item?.id === undefined ? "" : String(item.id);

/** Refresh existing fields without moving moments already visible on screen. */
export const mergeStableMomentOrder = (
  existing,
  incoming,
  mergeItem,
  { newItemsAt = "start" } = {},
) => {
  const currentItems = Array.isArray(existing) ? existing : [];
  const freshItems = Array.isArray(incoming) ? incoming : [];
  const merge =
    typeof mergeItem === "function"
      ? mergeItem
      : (current, fresh) => ({ ...(current || {}), ...(fresh || {}) });

  const freshById = new Map();
  const freshOrder = [];
  for (const fresh of freshItems) {
    const id = momentId(fresh);
    if (!id) continue;
    if (!freshById.has(id)) freshOrder.push(id);
    freshById.set(
      id,
      freshById.has(id) ? merge(freshById.get(id), fresh) : fresh,
    );
  }

  const existingIds = new Set();
  const updatedExisting = currentItems.map((current) => {
    const id = momentId(current);
    if (!id) return current;
    existingIds.add(id);
    return freshById.has(id) ? merge(current, freshById.get(id)) : current;
  });
  const genuinelyNew = freshOrder
    .filter((id) => !existingIds.has(id))
    .map((id) => merge(null, freshById.get(id)))
    .filter(Boolean);

  return newItemsAt === "end"
    ? [...updatedExisting, ...genuinelyNew]
    : [...genuinelyNew, ...updatedExisting];
};
