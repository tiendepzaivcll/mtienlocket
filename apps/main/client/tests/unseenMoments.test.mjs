import test from "node:test";
import assert from "node:assert/strict";
import {
  getPhotoSenderId,
  getPhotoTimestamp,
  getUserLastSeenHistoryTime,
  hasUserSeenPhotoInArray,
  isPhotoUnseen,
  countUnseenPhotos,
} from "../src/utils/moment/unseenMoments.js";

test("Quy tắc 1: Tuyệt đối không đếm ảnh do chính user hiện tại chụp/đăng", () => {
  const currentUserId = "my-user-uid";

  // Ảnh do chính user gửi (qua các trường khác nhau: senderId, user, userUid, owner)
  const myPhoto1 = { id: "p1", senderId: "my-user-uid", createdAt: 2000 };
  const myPhoto2 = { id: "p2", user: "my-user-uid", createdAt: 2000 };
  const myPhoto3 = { id: "p3", userUid: "my-user-uid", createdAt: 2000 };
  const myPhoto4 = { id: "p4", owner: { uid: "my-user-uid" }, createdAt: 2000 };
  const myPhoto5 = { id: "p5", user: { uid: "my-user-uid" }, createdAt: 2000 };

  assert.equal(isPhotoUnseen(myPhoto1, currentUserId), false);
  assert.equal(isPhotoUnseen(myPhoto2, currentUserId), false);
  assert.equal(isPhotoUnseen(myPhoto3, currentUserId), false);
  assert.equal(isPhotoUnseen(myPhoto4, currentUserId), false);
  assert.equal(isPhotoUnseen(myPhoto5, currentUserId), false);

  assert.equal(
    countUnseenPhotos(
      [myPhoto1, myPhoto2, myPhoto3, myPhoto4, myPhoto5],
      currentUserId,
    ),
    0,
  );
});

test("Quy tắc 1: Chỉ đếm ảnh do người khác gửi khi chưa xem", () => {
  const currentUserId = "my-user-uid";
  const friendPhoto = {
    id: "p-friend",
    senderId: "friend-uid",
    createdAt: 2000,
    seenBy: [],
  };

  assert.equal(isPhotoUnseen(friendPhoto, currentUserId), true);
  assert.equal(countUnseenPhotos([friendPhoto], currentUserId), 1);
});

test("Quy tắc 1b: Ảnh không có sender hợp lệ thì không tính", () => {
  const currentUserId = "my-user-uid";
  const invalidPhoto = { id: "p-no-sender", createdAt: 2000 };
  assert.equal(isPhotoUnseen(invalidPhoto, currentUserId), false);
});

test("Quy tắc 2: Không đếm ảnh đã nằm trong photo.seenBy của người khác gửi", () => {
  const currentUserId = "my-user-uid";

  // Mảng seenBy chứa string UID
  const seenPhoto1 = {
    id: "p1",
    senderId: "friend-uid",
    seenBy: ["other-user", "my-user-uid"],
    createdAt: 2000,
  };
  assert.equal(isPhotoUnseen(seenPhoto1, currentUserId), false);

  // Mảng seenBy chứa objects { uid }
  const seenPhoto2 = {
    id: "p2",
    senderId: "friend-uid",
    seenBy: [{ uid: "other-user" }, { uid: "my-user-uid" }],
    createdAt: 2000,
  };
  assert.equal(isPhotoUnseen(seenPhoto2, currentUserId), false);

  // Mảng views chứa objects { user }
  const seenPhoto3 = {
    id: "p3",
    senderId: "friend-uid",
    views: [{ user: "my-user-uid" }],
    createdAt: 2000,
  };
  assert.equal(isPhotoUnseen(seenPhoto3, currentUserId), false);

  // Ảnh chưa có trong seenBy
  const unseenPhoto = {
    id: "p4",
    senderId: "friend-uid",
    seenBy: ["other-user"],
    createdAt: 2000,
  };
  assert.equal(isPhotoUnseen(unseenPhoto, currentUserId), true);
});

test("Quy tắc 2b: Kiểm tra createdAt > user.lastSeenHistoryAt", () => {
  const currentUserId = "my-user-uid";
  const user = {
    uid: currentUserId,
    lastSeenHistoryAt: 1000,
  };

  // Ảnh đăng trước mốc lastSeenHistoryAt (đã xem)
  const oldPhoto = {
    id: "p-old",
    senderId: "friend-uid",
    createdAt: 900,
  };
  assert.equal(isPhotoUnseen(oldPhoto, currentUserId, null, user), false);

  // Ảnh đăng ngay tại mốc lastSeenHistoryAt (đã xem)
  const exactPhoto = {
    id: "p-exact",
    senderId: "friend-uid",
    createdAt: 1000,
  };
  assert.equal(isPhotoUnseen(exactPhoto, currentUserId, null, user), false);

  // Ảnh đăng sau mốc lastSeenHistoryAt (chưa xem)
  const newPhoto = {
    id: "p-new",
    senderId: "friend-uid",
    createdAt: 1100,
  };
  assert.equal(isPhotoUnseen(newPhoto, currentUserId, null, user), true);
});

test("Quy tắc 2c: Không đếm ảnh đã có trong viewedIds (bộ nhớ tạm / IndexedDB)", () => {
  const currentUserId = "my-user-uid";
  const viewedIds = new Set(["p-seen-local"]);

  const photoLocalSeen = {
    id: "p-seen-local",
    senderId: "friend-uid",
    createdAt: 5000,
  };
  const photoUnseen = {
    id: "p-unseen",
    senderId: "friend-uid",
    createdAt: 5000,
  };

  assert.equal(isPhotoUnseen(photoLocalSeen, currentUserId, viewedIds), false);
  assert.equal(isPhotoUnseen(photoUnseen, currentUserId, viewedIds), true);
});

test("Tổng hợp unseenCount với danh sách hỗn hợp cả ảnh của mình và bạn bè", () => {
  const currentUserId = "me";
  const user = { uid: "me", lastSeenHistoryAt: 1000 };
  const viewedIds = new Set(["p4"]);

  const photos = [
    { id: "p1", senderId: "me", createdAt: 2000 }, // Của mình -> Bỏ qua
    { id: "p2", senderId: "friend1", createdAt: 500 }, // Trước lastSeen -> Bỏ qua
    { id: "p3", senderId: "friend1", createdAt: 1500, seenBy: ["me"] }, // Đã xem trong seenBy -> Bỏ qua
    { id: "p4", senderId: "friend2", createdAt: 1500 }, // Đã trong viewedIds -> Bỏ qua
    { id: "p5", senderId: "friend2", createdAt: 1200 }, // CHƯA XEM -> Đếm 1
    { id: "p6", senderId: "friend3", createdAt: 1600 }, // CHƯA XEM -> Đếm 2
  ];

  const count = countUnseenPhotos(photos, currentUserId, viewedIds, user);
  assert.equal(count, 2);
});

test("Xử lý đúng các định dạng Firestore Timestamp", () => {
  const currentUserId = "me";
  const userWithFirestoreTime = {
    uid: "me",
    lastSeenHistoryAt: { _seconds: 100, _nanoseconds: 0 }, // 100,000 ms
  };

  const oldPhoto = {
    id: "p-old",
    senderId: "friend",
    createdAt: { seconds: 90, nanoseconds: 0 }, // 90,000 ms
  };

  const newPhoto = {
    id: "p-new",
    senderId: "friend",
    createdAt: { _seconds: 110, _nanoseconds: 0 }, // 110,000 ms
  };

  assert.equal(
    isPhotoUnseen(oldPhoto, currentUserId, null, userWithFirestoreTime),
    false,
  );
  assert.equal(
    isPhotoUnseen(newPhoto, currentUserId, null, userWithFirestoreTime),
    true,
  );
});
