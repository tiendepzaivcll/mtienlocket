import test from "node:test";
import assert from "node:assert/strict";
import { reconcileMessages } from "../src/stores/MessageStores/messageDedupe.js";

test("replaces a client-only placeholder with the confirmed Locket message", () => {
  const placeholder = {
    id: "CLIENT-UUID",
    sender: "me",
    text: "xin chào",
    body: "xin chào",
    create_time: 1000,
    update_time: 1_000_000,
  };
  const confirmed = {
    id: "LOCKET-ID",
    uid: "friend",
    sender: "me",
    text: "xin chào",
    create_time: 1002,
    update_time: 1_002_000,
  };

  const result = reconcileMessages([placeholder], [confirmed]);
  assert.deepEqual(result.messages.map((message) => message.id), ["LOCKET-ID"]);
  assert.deepEqual(result.replacedClientIds, ["CLIENT-UUID"]);
});

test("deduplicates repeated socket payloads by confirmed message id", () => {
  const confirmed = { id: "LOCKET-ID", uid: "friend", update_time: 1000 };
  const result = reconcileMessages([confirmed], [confirmed, confirmed]);
  assert.equal(result.messages.length, 1);
  assert.equal(result.incoming.length, 1);
});

test("keeps intentional repeated text when both messages are confirmed", () => {
  const first = {
    id: "ONE",
    sender: "me",
    text: "ok",
    create_time: 1000,
  };
  const second = {
    id: "TWO",
    sender: "me",
    text: "ok",
    create_time: 1001,
  };
  assert.equal(reconcileMessages([first], [second]).messages.length, 2);
});
