/**
 * Version check để force re-authentication của user cũ
 * Data (moments, messages) sẽ được giữ lại
 */
export const AUTH_VERSION = "1.0.0";

/**
 * Kiểm tra version authentication
 * Nếu version cũ → xóa token (force logout) nhưng giữ data
 */
export const checkAuthVersion = () => {
  const storedVersion = localStorage.getItem("authVersion");

  if (!storedVersion || storedVersion !== AUTH_VERSION) {
    console.info(
      `🔄 Auth version mismatch (stored: ${storedVersion}, required: ${AUTH_VERSION})`
    );
    console.info("🔄 Forcing user to re-authenticate...");

    // Xóa token → force logout
    localStorage.removeItem("idToken");
    localStorage.removeItem("idToken_decodedPayload");

    // Cập nhật version mới
    localStorage.setItem("authVersion", AUTH_VERSION);

    // Giữ lại data:
    // - userData cache (getDisplayName, avatar...)
    // - moments cache
    // - messages cache
    // - friends list
    // Tất cả đều ở localStorage với tên bắt đầu từ "db_" hoặc "userData"

    return false; // Return false để signal force logout
  }

  return true; // Version OK
};
