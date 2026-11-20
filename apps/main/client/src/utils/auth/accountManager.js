import { saveToken } from "@/utils/storage/storage";
import { clearUserCache } from "@/utils";
import { clearAccountDBs } from "@/cache/configDB";

const SAVED_ACCOUNTS_KEY = "locket_saved_accounts";

export function getSavedAccounts() {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCurrentAccountToPool(user, tokens) {
  if (!user && !tokens?.localId) return;
  const accounts = getSavedAccounts();
  const uid = user?.uid || user?.localId || tokens?.localId;
  if (!uid) return;

  const username = user?.username || "locket";
  const displayName =
    user?.displayName ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    username;
  const avatar = user?.profilePictureUrl || user?.avatarUrl || user?.photoUrl || "";

  const existingIndex = accounts.findIndex(
    (a) => a.uid === uid || (a.username && a.username === username)
  );

  const accountData = {
    uid,
    localId: tokens?.localId || user?.localId || uid,
    username,
    displayName,
    avatar,
    idToken: tokens?.idToken || (existingIndex >= 0 ? accounts[existingIndex].idToken : null),
    refreshToken: tokens?.refreshToken || (existingIndex >= 0 ? accounts[existingIndex].refreshToken : null),
    lastUsed: Date.now(),
  };

  if (existingIndex >= 0) {
    accounts[existingIndex] = {
      ...accounts[existingIndex],
      ...accountData,
      // Retain tokens if new one is missing
      idToken: accountData.idToken || accounts[existingIndex].idToken,
      refreshToken: accountData.refreshToken || accounts[existingIndex].refreshToken,
    };
  } else {
    accounts.push(accountData);
  }

  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts.slice(-8)));
  } catch (e) {
    console.error("Failed to save accounts pool", e);
  }
}

export function removeAccountFromPool(uidOrUsername) {
  const accounts = getSavedAccounts().filter(
    (a) => a.uid !== uidOrUsername && a.username !== uidOrUsername && a.localId !== uidOrUsername
  );
  try {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error("Failed to update accounts pool", e);
  }
  return accounts;
}

export async function switchToAccount(targetAccount) {
  if (!targetAccount?.idToken || !targetAccount?.localId) {
    throw new Error("Tài khoản chưa có phiên đăng nhập hợp lệ.");
  }

  // Cập nhật token đang hoạt động
  saveToken(
    {
      idToken: targetAccount.idToken,
      localId: targetAccount.localId,
      refreshToken: targetAccount.refreshToken,
    },
    true
  );

  clearUserCache();
  try {
    await clearAccountDBs();
  } catch (e) {
    console.warn("DB clear on switch error", e);
  }

  // Tải lại trang để đồng bộ toàn bộ store, friends và chat
  window.location.reload();
}
