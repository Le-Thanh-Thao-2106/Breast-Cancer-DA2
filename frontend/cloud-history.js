
window.bcSaveCloudSession = async function (session) {
    const token = sessionStorage.getItem("bc_access_token");

    if (!token) {
        console.error("Không tìm thấy bc_access_token");
        throw new Error("Chưa có OAuth token");
    }

    const res = await fetch(
        "https://breast-cancer-da2-api.onrender.com/history/sessions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(session)
        }
    );

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


window.bcLoadCloudSessions = async function () {
    const token = sessionStorage.getItem("bc_access_token");

    if (!token) {
        throw new Error("Chưa có OAuth token");
    }

    const res = await fetch(
        "https://breast-cancer-da2-api.onrender.com/history/sessions",
        {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        }
    );

    if (!res.ok) {
        throw new Error("Không tải được lịch sử. HTTP " + res.status);
    }

    const data = await res.json();

    console.log("Lịch sử tải từ Supabase:", data);

    return data;
};
