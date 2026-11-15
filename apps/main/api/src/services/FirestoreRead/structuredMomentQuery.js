const { instanceFirestore } = require("../../libs");

const CURSOR_PREFIX = "fsq1.";

const encodeCursor = ({ date, name }) =>
  `${CURSOR_PREFIX}${Buffer.from(JSON.stringify({ date, name }))
    .toString("base64url")}`;

function decodeCursor(cursor) {
  if (typeof cursor !== "string" || !cursor.startsWith(CURSOR_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor.slice(CURSOR_PREFIX.length), "base64url").toString(
        "utf8",
      ),
    );
    if (!parsed?.date || !parsed?.name) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

const isStructuredMomentCursor = (cursor) => Boolean(decodeCursor(cursor));

function buildMomentStructuredQuery({ friendId, limit = 60, cursor = null }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 60, 1), 100);
  const structuredQuery = {
    from: [{ collectionId: "entries" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "user" },
        op: "EQUAL",
        value: { stringValue: friendId },
      },
    },
    orderBy: [
      { field: { fieldPath: "date" }, direction: "DESCENDING" },
      { field: { fieldPath: "__name__" }, direction: "DESCENDING" },
    ],
    limit: safeLimit,
  };

  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    structuredQuery.startAt = {
      before: false,
      values: [
        { timestampValue: decodedCursor.date },
        { referenceValue: decodedCursor.name },
      ],
    };
  }

  return { structuredQuery };
}

async function queryMomentsByFriend({
  idToken,
  userId,
  friendId,
  limit = 60,
  cursor = null,
}) {
  const body = buildMomentStructuredQuery({ friendId, limit, cursor });
  const response = await instanceFirestore.post(
    `/locket/documents/history/${encodeURIComponent(userId)}:runQuery`,
    body,
    {
      timeout: 10000,
      meta: { idToken },
    },
  );

  const documents = (response.data || [])
    .map((row) => row.document)
    .filter(Boolean);
  const safeLimit = body.structuredQuery.limit;
  const lastDocument = documents.at(-1);
  const date = lastDocument?.fields?.date?.timestampValue;
  const nextPageToken =
    documents.length === safeLimit && date && lastDocument?.name
      ? encodeCursor({ date, name: lastDocument.name })
      : null;

  return { documents, nextPageToken };
}

module.exports = {
  buildMomentStructuredQuery,
  decodeCursor,
  encodeCursor,
  isStructuredMomentCursor,
  queryMomentsByFriend,
};
