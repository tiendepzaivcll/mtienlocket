function normalizeRequest(doc, direction) {
  const fields = doc?.fields || {};
  const field = direction === "incoming" ? fields.requesting_user : fields.requested_user;
  const uid = field?.stringValue || field?.referenceValue?.split("/").pop();
  // Request document IDs can be unrelated to user IDs. Never use them as peers.
  if (!uid) return null;
  return { uid, to: fields.requested_user?.stringValue || null,
    date: fields.created_at?.timestampValue || doc.createTime || null,
    status: fields.status?.stringValue || "pending" };
}

function createRequestReader(client) {
  return async (idToken, localId, direction) => {
    if (!["incoming", "outgoing"].includes(direction) || !localId) throw new Error("Invalid request direction or user");
    const requests = new Map();
    const seenTokens = new Set();
    let pageToken;
    try {
      do {
        const response = await client.get(
          `(default)/documents/users/${encodeURIComponent(localId)}/${direction}_friend_requests`,
          { params: { pageSize: 100, ...(pageToken ? { pageToken } : {}) }, meta: { idToken } },
        );
        if (!response.data || typeof response.data !== "object" || Array.isArray(response.data) ||
          (response.data.documents != null && !Array.isArray(response.data.documents))) {
          throw new Error("Invalid Firestore request list");
        }
        for (const doc of response.data.documents || []) {
          const request = normalizeRequest(doc, direction);
          if (request && request.uid !== localId) requests.set(request.uid, request);
        }
        pageToken = response.data.nextPageToken;
        if (pageToken && seenTokens.has(pageToken)) throw new Error("Repeated pagination token");
        if (pageToken) seenTokens.add(pageToken);
      } while (pageToken);
      return [...requests.values()];
    } catch (cause) {
      throw Object.assign(new Error("Chưa tải được yêu cầu kết bạn từ Locket. Vui lòng thử lại."), {
        status: 502, code: "FRIEND_REQUESTS_UNAVAILABLE",
        data: { direction, upstreamStatus: cause.response?.status || null },
      });
    }
  };
}
module.exports = { createRequestReader, normalizeRequest };
