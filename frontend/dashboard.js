document.addEventListener("bc:account-ready", () => {
    let a = [];
    try {
        a = JSON.parse(localStorage.getItem(getUserHistoryKey()) || "[]");
    } catch {}
    if (!Array.isArray(a)) a = [];
    const put = (id, v) => {
        const e = document.getElementById(id);
        if (e) e.textContent = v;
    };
    put("totalAnalysis", a.length);
    put(
        "malignantCount",
        a.filter((x) => String(x.predictedLabel).toLowerCase() === "malignant").length,
    );
    put("benignCount", a.filter((x) => String(x.predictedLabel).toLowerCase() === "benign").length);
    put("lastAnalysis", a.length ? new Date(a[0].analyzedAt).toLocaleDateString("vi-VN") : "--");
});
document.addEventListener("bc:account-ready", () => {
    let items = [];
    try {
        items = JSON.parse(localStorage.getItem(getUserHistoryKey()) || "[]");
    } catch {}
    if (!Array.isArray(items)) items = [];
    const malignant = items.filter(
        (x) => String(x.predictedLabel || "").toLowerCase() === "malignant",
    ).length;
    const benign = items.filter(
        (x) => String(x.predictedLabel || "").toLowerCase() === "benign",
    ).length;
    const total = malignant + benign;
    const m = total ? (100 * malignant) / total : 0,
        b = total ? (100 * benign) / total : 0;
    const setText = (id, v) => {
        const e = document.getElementById(id);
        if (e) e.textContent = v;
    };
    const me = document.getElementById("distributionMalignant"),
        be = document.getElementById("distributionBenign");
    if (me) me.style.width = m + "%";
    if (be) be.style.width = b + "%";
    setText("distributionMalignantPct", m.toFixed(1) + "%");
    setText("distributionBenignPct", b.toFixed(1) + "%");
    setText(
        "distributionCaption",
        total
            ? `${total} kết quả được phân loại trong lịch sử cá nhân`
            : "Hãy phân tích mẫu đầu tiên để xem biểu đồ",
    );
});

document.addEventListener(
    "bc:account-ready",
    async () => {
        const metric = document.getElementById("workspaceBestAccuracy");
        try {
            const response = await fetch(BREASTCARE_API + "/benchmark");
            if (!response.ok) return;
            const benchmark = await response.json();
            if (!benchmark.results?.length) return;
            const best = Math.max(...benchmark.results.map((result) => result.accuracy));
            if (Number.isFinite(best)) {
                metric.textContent = new Intl.NumberFormat("vi-VN", {
                    style: "percent",
                    maximumFractionDigits: 2,
                }).format(best);
            }
        } catch {
            // Keep the rest of the dashboard usable when benchmark is unavailable.
        }
    },
    { once: true },
);
