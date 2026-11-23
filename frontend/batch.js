const batchLimit = 600;
const batchFeatureNames = window.WDBC_FEATURE_NAMES;
const labelHeaders = new Set(["label", "target", "target label", "diagnosis", "nhan", "loai"]);
const labelValues = new Map([
    ["0", 0], ["m", 0], ["malignant", 0], ["ac tinh", 0],
    ["1", 1], ["b", 1], ["benign", 1], ["lanh tinh", 1]
]);
const getBatchElement = id => document.getElementById(id);
const fileInput = getBatchElement("csvFile");
const runButton = getBatchElement("runBatch");
const labeledMode = getBatchElement("labeledMode");
const unlabeledMode = getBatchElement("unlabeledMode");
const kernelInputs = [...document.querySelectorAll("#batchKernelOptions input")];
let labeled = false;
let readRevision = 0;
let batchFile;
let batchSession;
let requestElapsed = 0;

function batchMessage(text) {
    getBatchElement("batchMessage").textContent = text;
}

function parseDelimited(text, separator) {
    const rows = [];
    let row = [], field = "", quoted = false;
    const finishRow = () => {
        row.push(field);
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
        field = "";
    };
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === '"') {
            if (quoted && text[index + 1] === '"') {
                field += '"';
                index++;
            } else quoted = !quoted;
        } else if (!quoted && char === separator) {
            row.push(field);
            field = "";
        } else if (!quoted && (char === "\n" || char === "\r")) {
            if (char === "\r" && text[index + 1] === "\n") index++;
            finishRow();
        } else field += char;
    }
    if (quoted) throw new Error("Dấu ngoặc kép chưa đóng.");
    finishRow();
    return rows;
}

async function readBatchFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv" || ext === "txt") {
        const text = (await file.text()).replace(/^\uFEFF/, "");
        const first = text.split(/\r?\n/).find(line => line.trim()) || "";
        const separators = [",", ";", "\t"];
        const separator = separators.reduce((best, candidate) =>
            parseDelimited(first, candidate)[0]?.length > parseDelimited(first, best)[0]?.length ? candidate : best
        );
        return parseDelimited(text, separator);
    }
    if (ext === "xlsx" || ext === "xls") {
        if (!window.XLSX) throw new Error("Chưa tải được thư viện đọc Excel. Vui lòng thử lại hoặc dùng CSV.");
        const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new Error("Không tìm thấy trang tính.");
        return window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false, raw: true });
    }
    throw new Error("Định dạng hỗ trợ: CSV, TXT, XLSX và XLS.");
}

function normalizeBatchName(value) {
    return String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "")
        .trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function readBatchLabel(row, columns, line) {
    let label;
    let source;
    for (const { name, index } of columns) {
        const value = String(row[index] ?? "").trim();
        if (!value) continue;
        const numeric = /^[01](?:[.,]0+)?$/.test(value) ? Number(value[0]) : undefined;
        const next = numeric ?? labelValues.get(normalizeBatchName(value));
        if (next === undefined) {
            throw new Error(`Dòng ${line}, cột ${name}: dùng 0/1 hoặc malignant/benign.`);
        }
        if (label !== undefined && label !== next) {
            throw new Error(`Dòng ${line}: nhãn ở cột ${source} và ${name} không khớp.`);
        }
        label = next;
        source = name;
    }
    if (label === undefined) throw new Error(`Dòng ${line}: thiếu nhãn thật.`);
    return label;
}

function parseBatchRows(raw, needLabels) {
    if (raw.length < 2) throw new Error("File cần có tiêu đề và ít nhất một mẫu.");
    if (raw.length - 1 > batchLimit) throw new Error(`Tối đa ${batchLimit} mẫu mỗi lần.`);
    const headers = raw[0].map(normalizeBatchName);
    if (new Set(headers).size !== headers.length) throw new Error("File có tên cột trùng nhau.");
    const positions = batchFeatureNames.map(name => headers.indexOf(name));
    const missing = batchFeatureNames.filter((_, index) => positions[index] < 0);
    if (missing.length) throw new Error("Thiếu cột: " + missing.join(", "));
    const labelColumns = needLabels ? headers.flatMap((name, index) =>
        labelHeaders.has(name) ? [{ name: String(raw[0][index]).trim(), index }] : []
    ) : [];
    if (needLabels && !labelColumns.length) {
        throw new Error("Không tìm thấy cột nhãn. Hỗ trợ label, target, target_label, diagnosis, nhãn hoặc loại.");
    }

    const labels = needLabels ? [] : null;
    const samples = raw.slice(1).map((row, index) => {
        const line = index + 2;
        if (row.length !== headers.length) throw new Error(`Dòng ${line} sai số cột.`);
        const entries = positions.map((position, featureIndex) => {
            const value = String(row[position] ?? "").trim();
            const number = Number(value);
            const feature = batchFeatureNames[featureIndex];
            if (!value || !Number.isFinite(number)) throw new Error(`Dòng ${line}, cột ${feature} phải là số.`);
            return [feature, number];
        });
        if (labels) labels.push(readBatchLabel(row, labelColumns, line));
        return Object.fromEntries(entries);
    });
    return { samples, labels, labelColumns: labelColumns.map(column => column.name) };
}

async function updateBatchInput() {
    const revision = ++readRevision;
    batchFile = batchSession = undefined;
    runButton.disabled = true;
    getBatchElement("batchResults").hidden = true;
    const file = fileInput.files[0];
    getBatchElement("batchFileName").textContent = file?.name || "Chọn file";
    if (!file) { batchMessage("Chưa chọn file."); return; }
    batchMessage("Đang đọc file…");
    try {
        if (file.size > 2_000_000) throw new Error("File vượt quá 2 MB.");
        const raw = await readBatchFile(file);
        if (revision !== readRevision) return;
        batchFile = { ...parseBatchRows(raw, labeled), filename: file.name };
        const labelMessage = labeled ? ` Cột nhãn: ${batchFile.labelColumns.join(", ")}.` : "";
        batchMessage(`Đã đọc ${batchFile.samples.length} mẫu.${labelMessage}`);
        runButton.disabled = false;
    } catch (error) {
        if (revision === readRevision) batchMessage(error.message);
    }
}

function setBatchMode(nextMode) {
    if (labeled === nextMode) return;
    labeled = nextMode;
    labeledMode.setAttribute("aria-pressed", String(labeled));
    unlabeledMode.setAttribute("aria-pressed", String(!labeled));
    getBatchElement("batchModeHelp").textContent = labeled
        ? "File cần 30 đặc trưng WDBC. Nhận cột label, target, target_label, diagnosis, nhãn hoặc loại. Nhãn 0 là ác tính, 1 là lành tính."
        : "File cần đủ 30 cột đặc trưng WDBC.";
    getBatchElement("downloadTemplate").href = labeled ? "breast-cancer-mau-co-nhan.csv" : "breast-cancer-mau-20-dong.csv";
    updateBatchInput();
}

function renderBatchMetrics(kernel) {
    const run = batchSession.results.find(result => result.kernel === kernel);
    const summary = BatchResults.summarize(run, batchSession.labels);
    const metrics = summary.evaluation
        ? [["Tổng số mẫu", batchSession.sampleCount], ["Đúng", summary.evaluation.correct],
           ["Sai", summary.evaluation.incorrect], ["Tỷ lệ khớp", BatchResults.percent(summary.evaluation.accuracy)]]
        : [["Tổng số mẫu", batchSession.sampleCount], ["Ác tính", summary.malignant],
           ["Lành tính", summary.benign], ["Thời gian yêu cầu", `${requestElapsed.toFixed(1)} ms`]];
    getBatchElement("batchMetrics").replaceChildren(...metrics.map(([text, value], index) => {
        const card = BatchResults.element("div", undefined, `research-metric research-metric-${index + 1}`);
        card.append(BatchResults.element("span", text), BatchResults.element("strong", value));
        return card;
    }));
    BatchResults.renderComparison(getBatchElement("batchComparison"), batchSession, kernel);
}

function cacheBatchSession(session, synced) {
    const key = getUserHistoryKey();
    const history = JSON.parse(localStorage.getItem(key) || "[]");
    const { samples, labels, results, ...summary } = session;
    const cached = synced ? { ...summary, cloudDetails: true } : session;
    const records = Array.isArray(history) ? history : [];
    localStorage.setItem(key, JSON.stringify([cached, ...records].slice(0, 200)));
}

async function saveBatchSession(session) {
    try {
        await window.bcSaveCloudSession(session);
    } catch (error) {
        try {
            cacheBatchSession(session, false);
            return `Đã phân tích ${session.sampleCount} mẫu và lưu trên trình duyệt. Chưa đồng bộ: ${error.message}`;
        } catch {
            return `Đã phân tích ${session.sampleCount} mẫu. Chưa lưu được lịch sử. Bạn có thể xuất kết quả CSV.`;
        }
    }
    try { cacheBatchSession(session, true); } catch { /* Lịch sử vẫn có trên máy chủ. */ }
    return `Đã phân tích ${session.sampleCount} mẫu và lưu vào lịch sử.`;
}

fileInput.onchange = updateBatchInput;
labeledMode.onclick = () => setBatchMode(true);
unlabeledMode.onclick = () => setBatchMode(false);
runButton.onclick = async () => {
    if (!batchFile) return;
    const kernels = kernelInputs.filter(input => input.checked).map(input => input.value);
    if (!kernels.length) { batchMessage("Chọn ít nhất một kernel."); return; }

    const controls = [fileInput, runButton, labeledMode, unlabeledMode, ...kernelInputs];
    controls.forEach(input => { input.disabled = true; });
    getBatchElement("batchResults").hidden = true;
    batchMessage("Đang phân tích…");
    const started = performance.now();
    try {
        const { samples, labels, filename } = batchFile;
        const response = await fetch(BREASTCARE_API + "/predict/batch/compare", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ samples, kernels, labels })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Yêu cầu thất bại (${response.status}).`);
        requestElapsed = performance.now() - started;
        batchSession = {
            id: `batch_${crypto.randomUUID()}`, type: "batch", analyzedAt: new Date().toISOString(),
            filename, sampleCount: samples.length, kernels, samples, labels, results: data.results,
            summary: data.results.map(run => BatchResults.summarize(run, labels))
        };
        const initialKernel = batchSession.results.some(run => run.kernel === "RBF") ? "RBF" : batchSession.results[0].kernel;
        BatchResults.renderDetails(getBatchElement("batchPreview"), batchSession, { activeKernel: initialKernel, onKernel: renderBatchMetrics });
        renderBatchMetrics(initialKernel);
        getBatchElement("batchResults").hidden = false;
        getBatchElement("batchComparison").hidden = batchSession.results.length < 2;
        batchMessage(await saveBatchSession(batchSession));
    } catch (error) {
        batchMessage(`Không thể phân tích: ${error.message}`);
    } finally {
        controls.forEach(input => { input.disabled = false; });
    }
};

function csvCell(value) {
    if (typeof value === "number") return String(value);
    const text = String(value ?? "");
    const safe = /^[\s]*[=+@-]/.test(text) ? "\t" + text : text;
    return /[",\n\r\t]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

getBatchElement("exportBatch").onclick = () => {
    if (!batchSession) return;
    const { samples, labels, results } = batchSession;
    const columns = results.flatMap(({ kernel }) => [
        `${kernel}_class`, `${kernel}_label`, `${kernel}_malignant`, `${kernel}_benign`, ...(labels ? [`${kernel}_match`] : [])
    ]);
    const rows = samples.map((sample, index) => [
        ...batchFeatureNames.map(name => sample[name]), ...(labels ? [labels[index]] : []),
        ...results.flatMap(run => {
            const row = run.predictions[index];
            return [row.predicted_class, row.predicted_label, row.probability_malignant, row.probability_benign,
                ...(labels ? [labels[index] === row.predicted_class ? "Đúng" : "Sai"] : [])];
        })
    ]);
    const header = [...batchFeatureNames, ...(labels ? ["label"] : []), ...columns];
    const csv = "\uFEFF" + [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "breastcare-ket-qua.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
