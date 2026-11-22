
/* Quản lý lịch sử riêng theo tài khoản BreastCare */

function getCurrentUserId() {
    try {
        const user = JSON.parse(
            sessionStorage.getItem("bc_user") || "null"
        );

        // API hồ sơ cung cấp UUID qua trường sub.
        const userId = user?.sub || user?.id;

        if (!userId || typeof userId !== "string") {
            throw new Error("Không tìm thấy User ID.");
        }

        return userId;
    } catch (error) {
        throw new Error(
            "Không xác định được tài khoản BreastCare. Vui lòng đăng nhập lại."
        );
    }
}

function getUserHistoryKey() {
    return "breastCancerHistory_" + getCurrentUserId();
}
