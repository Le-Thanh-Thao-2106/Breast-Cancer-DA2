

function getHistory() {
    try {
        const history = JSON.parse(
            localStorage.getItem(getUserHistoryKey()) || "[]"
        );

        return Array.isArray(history) ? history : [];
    } catch (error) {
        console.error("Không thể đọc lịch sử phân tích:", error);
        return [];
    }
}

function formatDate(dateString) {
    if (!dateString) return "Không xác định";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "Không xác định";
    }

    return date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function formatPercent(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return "0%";

    return (number * 100).toFixed(2) + "%";
}

function renderStatistics() {
    const history = getHistory();

    const total = history.length;

    const malignantRecords = history.filter(
        item => item.predictedLabel === "malignant"
    );

    const benignRecords = history.filter(
        item => item.predictedLabel === "benign"
    );

    const malignant = malignantRecords.length;
    const benign = benignRecords.length;

    const malignantRate = total > 0
        ? (malignant / total) * 100
        : 0;

    const benignRate = total > 0
        ? (benign / total) * 100
        : 0;

    // Cập nhật các thẻ thống kê
    document.getElementById("statTotal").textContent = total;
    document.getElementById("statMalignant").textContent = malignant;
    document.getElementById("statBenign").textContent = benign;

    document.getElementById("statMalignantRate").textContent =
        malignantRate.toFixed(2) + "%";

    // Cập nhật tỷ lệ phân bố
    document.getElementById("malignantPercent").textContent =
        malignantRate.toFixed(2) + "%";

    document.getElementById("benignPercent").textContent =
        benignRate.toFixed(2) + "%";

    document.getElementById("malignantBar").style.width =
        malignantRate + "%";

    document.getElementById("benignBar").style.width =
        benignRate + "%";

    // Lấy lần phân tích gần nhất
    if (total > 0) {
        document.getElementById("statLastAnalysis").textContent =
            formatDate(history[0].analyzedAt);

        document.getElementById("statModelVersion").textContent =
            history[0].modelVersion || "---";
    } else {
        document.getElementById("statLastAnalysis").textContent =
            "Chưa có dữ liệu";

        document.getElementById("statModelVersion").textContent = "---";
    }

    // Tính xác suất Malignant trung bình
    const probabilities = history
        .map(item => Number(item.probabilityMalignant))
        .filter(value => Number.isFinite(value));

    const averageProbability = probabilities.length > 0
        ? probabilities.reduce((sum, value) => sum + value, 0)
            / probabilities.length
        : 0;

    document.getElementById("statAverageProbability").textContent =
        formatPercent(averageProbability);
}

// Khởi chạy khi trang được tải
document.addEventListener("bc:account-ready", renderStatistics);
