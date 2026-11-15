function messageText(message) {
  return String(message?.text || message?.body || message?.msg || "").trim();
}

function messageTimeSeconds(message) {
  const raw = Number(message?.create_time || message?.update_time || 0);
  if (!Number.isFinite(raw)) return 0;
  return raw > 100_000_000_000 ? Math.floor(raw / 1000) : Math.floor(raw);
}

function isMatchingClientPlaceholder(clientMessage, confirmedMessage) {
  if (!clientMessage?.id || clientMessage?.uid) return false;
  if (!Object.prototype.hasOwnProperty.call(clientMessage, "body")) return false;
  if (!confirmedMessage?.id || clientMessage.id === confirmedMessage.id) return false;
  if (!clientMessage.sender || clientMessage.sender !== confirmedMessage.sender) {
    return false;
  }
  if (!messageText(clientMessage) || messageText(clientMessage) !== messageText(confirmedMessage)) {
    return false;
  }

  const clientTime = messageTimeSeconds(clientMessage);
  const confirmedTime = messageTimeSeconds(confirmedMessage);
  return Boolean(
    clientTime && confirmedTime && Math.abs(clientTime - confirmedTime) <= 30,
  );
}

export function reconcileMessages(currentMessages = [], incomingMessages = []) {
  const uniqueIncoming = [
    ...new Map(
      incomingMessages.filter((message) => message?.id).map((message) => [message.id, message]),
    ).values(),
  ];
  const replacedClientIds = currentMessages
    .filter((current) =>
      uniqueIncoming.some((incoming) =>
        isMatchingClientPlaceholder(current, incoming),
      ),
    )
    .map((message) => message.id);
  const replacedSet = new Set(replacedClientIds);
  const byId = new Map();

  for (const message of currentMessages) {
    if (message?.id && !replacedSet.has(message.id)) byId.set(message.id, message);
  }
  for (const message of uniqueIncoming) byId.set(message.id, message);

  return {
    messages: [...byId.values()].sort(
      (a, b) => Number(b.update_time || 0) - Number(a.update_time || 0),
    ),
    incoming: uniqueIncoming,
    replacedClientIds,
  };
}
