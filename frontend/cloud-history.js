const BC_HISTORY_API = "/history/sessions";

window.bcSaveCloudSession = async function (session) {

    const res = await fetch(BC_HISTORY_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(session)
    });

    const responseText = await res.text();

    let data;

    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(
            "API trả về dữ liệu không phải JSON. HTTP " + res.status
        );
    }

    if (!res.ok) {
        console.error("Lỗi lưu lịch sử:", {
            status: res.status,
            detail: data.detail
        });

        throw new Error(
            typeof data.detail === "string"
                ? data.detail
                : "Lỗi HTTP " + res.status
        );
    }

    console.log("Lưu lịch sử thành công:", data);

    return data;
};


// =====================================
// 3. TẢI LỊCH SỬ TỪ SUPABASE
// =====================================

window.bcLoadCloudSessions = async function () {

    const res = await fetch(BC_HISTORY_API);

    if (!res.ok) {
        throw new Error(
            "Không tải được lịch sử. HTTP " + res.status
        );
    }

    const data = await res.json();

    console.log("Lịch sử tải từ Supabase:", data);

    return data;
};


// =====================================
// 4. XÓA MỘT BẢN GHI TRÊN SUPABASE
// =====================================

window.bcDeleteCloudSession = async function (sessionId) {

    if (!sessionId) {
        throw new Error("ID phiên phân tích không hợp lệ");
    }

    const url =
        BC_HISTORY_API + "/" + encodeURIComponent(sessionId);

    const res = await fetch(url, {
        method: "DELETE"
    });

    if (!res.ok) {
        const errorText = await res.text();

        console.error("Lỗi xóa lịch sử:", {
            status: res.status,
            detail: errorText
        });

        throw new Error(
            "Không xóa được lịch sử. HTTP "
            + res.status + ": " + errorText
        );
    }

    const data = await res.json();

    console.log("Yêu cầu xóa lịch sử thành công:", data);

    return data;
};
