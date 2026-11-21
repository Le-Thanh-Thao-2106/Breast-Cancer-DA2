
/* Quản lý lịch sử riêng theo tài khoản SSO */

function getCurrentUserId() {
    try {
        const user = JSON.parse(
            sessionStorage.getItem("bc_user") || "null"
        );

        // Supabase OAuth UserInfo thường cung cấp sub.
        const userId = user?.sub || user?.id;

        if (!userId || typeof userId !== "string") {
            throw new Error("Không tìm thấy User ID.");
        }

        return userId;
    } catch (error) {
        throw new Error(
            "Không xác định được tài khoản SSO. Vui lòng đăng nhập lại."
        );
    }
}

function getUserHistoryKey() {
    return "breastCancerHistory_" + getCurrentUserId();
}
