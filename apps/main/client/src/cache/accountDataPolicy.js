// Wait for every account store to finish, including when one cleanup fails.
export async function clearAccountStores(clearers) {
  const results = await Promise.allSettled(
    clearers.map((clear) => Promise.resolve().then(clear)),
  );
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("Chưa xóa hết dữ liệu tài khoản trên thiết bị. Hãy đóng các tab LOCKET-PRO khác rồi thử lại.");
  }
}
