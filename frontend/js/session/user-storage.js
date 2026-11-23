
/* Quản lý lịch sử riêng theo UUID do phiên BreastCare trả về. */

function getCurrentUserId() {
    const userId = breastCareUser?.sub;
    if (!userId) {
        throw new Error("Không xác định được tài khoản BreastCare. Vui lòng đăng nhập lại.");
    }
    return userId;
}

function getUserHistoryKey() {
    return "breastCancerHistory_" + getCurrentUserId();
}
