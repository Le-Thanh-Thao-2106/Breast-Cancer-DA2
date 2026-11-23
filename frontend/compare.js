const bMsg = document.getElementById("benchmarkMessage");
function number(v) {
    return (v * 100).toFixed(2) + "%";
}
async function loadBenchmark() {
    const btn = document.getElementById("loadBenchmark");
    if (btn.disabled) return;
    btn.disabled = true;
    bMsg.textContent = "Đang chạy benchmark, lần đầu có thể mất vài giây...";
    try {
        const t0 = performance.now();
        const res = await fetch(BREASTCARE_API + "/benchmark");
        const data = await res.json();
        if (!res.ok) throw Error(data.detail || res.statusText);
        const splitSize = `${data.train_samples} mẫu huấn luyện / ${data.test_samples} mẫu kiểm tra`;
        document.getElementById("benchmarkSetup").textContent =
            [data.dataset, splitSize, data.split, "Precision/Recall/F1 macro"].join(" · ");
        const table = document.createElement("table");
        table.className = "bc-compare-table";
        const head = document.createElement("tr");
        [
            "Kernel",
            "Accuracy",
            "Precision",
            "Recall",
            "F1-score",
            "ROC AUC",
            "Train (ms)",
            "Predict (ms)",
        ].forEach((t) => {
            const th = document.createElement("th");
            th.textContent = t;
            head.append(th);
        });
        table.append(head);
        const bars = document.getElementById("benchmarkBars"),
            conf = document.getElementById("benchmarkConfusion");
        bars.replaceChildren();
        conf.replaceChildren();
        data.results.forEach((r) => {
            const tr = document.createElement("tr");
            [
                r.kernel,
                number(r.accuracy),
                number(r.precision),
                number(r.recall),
                number(r.f1),
                r.auc.toFixed(3),
                r.training_ms.toFixed(2),
                r.prediction_ms.toFixed(2),
            ].forEach((v) => {
                const td = document.createElement("td");
                td.textContent = v;
                tr.append(td);
            });
            table.append(tr);
            const box = document.createElement("div");
            box.className = "workspace-accuracy-row";
            const name = document.createElement("strong");
            name.textContent = r.kernel;
            const score = document.createElement("span");
            score.textContent = number(r.accuracy);
            const track = document.createElement("div");
            track.className = "bc-bar";
            const bar = document.createElement("i");
            bar.style.width = r.accuracy * 100 + "%";
            track.append(bar);
            box.append(name, score, track);
            bars.append(box);
            const matrix = document.createElement("div");
            matrix.className = "matrix-panel";
            const title = document.createElement("h4");
            title.textContent = r.kernel;
            const grid = document.createElement("div");
            grid.className = "matrix-grid";
            r.confusion_matrix.flat().forEach((n, i) => {
                const cell = document.createElement("div");
                cell.className =
                    "matrix-cell " + (i === 0 || i === 3 ? "matrix-correct" : "matrix-wrong");
                const count = document.createElement("strong");
                count.textContent = n;
                const desc = document.createElement("small");
                desc.textContent = [
                    "Thực 0 · Dự đoán 0",
                    "Thực 0 · Dự đoán 1",
                    "Thực 1 · Dự đoán 0",
                    "Thực 1 · Dự đoán 1",
                ][i];
                cell.append(count, desc);
                grid.append(cell);
            });
            matrix.append(title, grid);
            conf.append(matrix);
        });
        document.getElementById("benchmarkTable").replaceChildren(table);
        const elapsed = (performance.now() - t0).toFixed(1);
        bMsg.textContent = `Đã nhận kết quả ${data.results.length} kernel trong ${elapsed} ms. ` +
            "Thời gian huấn luyện và dự đoán được đo tại máy chủ.";
    } catch (err) {
        bMsg.textContent =
            "Không tải được benchmark: " + err.message + " — hãy kiểm tra backend /health";
    } finally {
        btn.disabled = false;
    }
}
document.getElementById("loadBenchmark").addEventListener("click", loadBenchmark);

document.addEventListener("bc:account-ready", loadBenchmark, { once: true });
