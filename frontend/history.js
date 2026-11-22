
/* =====================================
   BREASTCARE SVM - HISTORY MANAGEMENT
===================================== */


// DOM elements
const tableBody = document.getElementById("historyTableBody");

const totalElement = document.getElementById("historyTotal");
const malignantElement = document.getElementById("historyMalignant");
const benignElement = document.getElementById("historyBenign");
const versionElement = document.getElementById("historyModelVersion");

const countElement = document.getElementById("historyCount");

const searchInput = document.getElementById("historySearch");
const filterSelect = document.getElementById("historyFilter");

const clearButton = document.getElementById("clearHistoryButton");

const detailSection = document.getElementById("historyDetail");
const detailTime = document.getElementById("detailTime");
const detailResult = document.getElementById("detailResult");
const detailFeatures = document.getElementById("detailFeatures");
const closeDetailButton = document.getElementById("closeDetailButton");


// =====================================
// 1. READ LOCAL STORAGE
// =====================================

function getHistory() {
    try {
        const history = JSON.parse(
            localStorage.getItem(getUserHistoryKey()) || "[]"
        );

        return Array.isArray(history) ? history : [];

    } catch (error) {
        console.error("Cannot read history:", error);
        return [];
    }
}

function normalizeCloudSession(session) {
    const summary = session.summary || {};
    const details = session.details || {};

    if (session.kind === "batch") {
        return {
            id: session.id,
            type: "batch",
            analyzedAt: details.analyzedAt || session.created_at,
            filename: session.filename || "",
            sampleCount: session.sample_count,
            kernels: session.kernels || [],
            summary: summary,
            results: details.results || []
        };
    }

    const results = details.results || {};

    return {
        id: session.id,
        type: "single",
        analyzedAt: details.analyzedAt || session.created_at,

        predictedClass: summary.predicted_class,
        predictedLabel: summary.predicted_label || "",

        probabilityMalignant: summary.probability_malignant,
        probabilityBenign: summary.probability_benign,

        modelVersion: (session.kernels || []).join(", "),
        kernels: session.kernels || [],

        features: results.features || {}
    };
}



// =====================================
// 2. SAVE HISTORY
// =====================================

function saveHistory(history) {
    localStorage.setItem(
        getUserHistoryKey(),
        JSON.stringify(history)
    );
}


// =====================================
// 3. FORMAT DATA
// =====================================

function formatDate(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "Không xác định";
    }

    return date.toLocaleString("vi-VN");
}


function formatPercent(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "--";
    }

    return (number * 100).toFixed(2) + "%";
}

function normalizeLabel(label) {
    return String(label || "").trim().toLowerCase();
}

// =====================================
// 4. UPDATE STATISTICS
// =====================================

function updateStatistics(history) {

    const malignantCount = history.filter(
        item => normalizeLabel(item.predictedLabel) === "malignant"
    ).length;

    const benignCount = history.filter(
        item => normalizeLabel(item.predictedLabel) === "benign"
    ).length;

    totalElement.textContent = history.length;
    malignantElement.textContent = malignantCount;
    benignElement.textContent = benignCount;

    const latestVersion = history.length
        ? history[0].modelVersion || "--"
        : "--";

    versionElement.textContent = latestVersion;
}


// =====================================
// 5. RENDER HISTORY TABLE
// =====================================

function renderHistory() {

    const history = getHistory();

    updateStatistics(history);

    const keyword = searchInput.value
        .trim()
        .toLowerCase();

    const filter = filterSelect.value;

    const filteredHistory = history.filter(item => {

        const label = item.type === "batch" ? "batch" : normalizeLabel(item.predictedLabel);

        const matchesFilter =
            filter === "all" || label === "batch" || label === normalizeLabel(filter);

        const matchesSearch =
            label.includes(keyword) || (item.filename || "").toLowerCase().includes(keyword);

        return matchesFilter && matchesSearch;

    });

    tableBody.replaceChildren();

    if (filteredHistory.length === 0) {

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.className = "history-empty";

        cell.textContent = history.length === 0
            ? "Chưa có dữ liệu lịch sử."
            : "Không tìm thấy kết quả phù hợp.";

        row.appendChild(cell);
        tableBody.appendChild(row);

    } else {

        filteredHistory.forEach((item, index) => {

            const row = document.createElement("tr");

            // STT
            const numberCell = document.createElement("td");
            numberCell.textContent = index + 1;

            // Date
            const dateCell = document.createElement("td");
            dateCell.textContent = formatDate(item.analyzedAt);

            // Label
            const labelCell = document.createElement("td");
            const badge = document.createElement("span");

            badge.className = normalizeLabel(item.predictedLabel) === "malignant"
                ? "history-badge malignant"
                : "history-badge benign";
            badge.textContent = item.type === "batch" ? `CSV · ${item.sampleCount} mẫu` : (item.predictedLabel || "--");

            labelCell.appendChild(badge);

            // Probabilities
            const malignantCell = document.createElement("td");
            malignantCell.textContent =
                formatPercent(item.probabilityMalignant);

            const benignCell = document.createElement("td");
            benignCell.textContent =
                formatPercent(item.probabilityBenign);

            // Model version
            const versionCell = document.createElement("td");
            versionCell.textContent = item.type === "batch" ? (item.kernels || []).join(", ") : (item.modelVersion || "--");

            // Actions
            const actionCell = document.createElement("td");

            const detailButton = document.createElement("button");
            detailButton.type = "button";
            detailButton.className = "history-action-button";
            detailButton.textContent = "Chi tiết";
            detailButton.dataset.action = "detail";
            detailButton.dataset.id = String(item.id);

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "history-delete-button";
            deleteButton.textContent = "Xóa";
            deleteButton.dataset.action = "delete";
            deleteButton.dataset.id = String(item.id);

            actionCell.append(detailButton, deleteButton);

            row.append(
                numberCell,
                dateCell,
                labelCell,
                malignantCell,
                benignCell,
                versionCell,
                actionCell
            );

            tableBody.appendChild(row);

        });

    }

    countElement.textContent =
        `Hiển thị ${filteredHistory.length} / ${history.length} bản ghi`;
}


// =====================================
// 6. SHOW HISTORY DETAIL
// =====================================

function showDetail(id) {

    const history = getHistory();

    const item = history.find(
        record => String(record.id) === String(id)
    );

    if (!item) {
        return;
    }

    if(item.type === 'batch') {
        detailTime.textContent='Thời gian: '+formatDate(item.analyzedAt);
        detailResult.replaceChildren(); detailFeatures.replaceChildren();
        const heading=document.createElement('h3');heading.textContent=`Phiên CSV: ${item.filename || 'Không tên'} (${item.sampleCount} mẫu)`;detailResult.append(heading);
        const table=document.createElement('table');table.className='bc-compare-table';
        const row=document.createElement('tr');['Kernel','Ác tính','Lành tính','Suy luận (ms)'].forEach(x=>{const th=document.createElement('th');th.textContent=x;row.append(th)});table.append(row);
        (item.summary||[]).forEach(r=>{const tr=document.createElement('tr');[r.kernel,r.malignant,r.benign,r.elapsed_ms].forEach(x=>{const td=document.createElement('td');td.textContent=x;tr.append(td)});table.append(tr)});detailResult.append(table);
        detailSection.hidden=false;detailSection.scrollIntoView({behavior:'smooth',block:'start'});return;
    }
    detailTime.textContent =
        "Thời gian: " + formatDate(item.analyzedAt);

    detailResult.replaceChildren();

    const resultBox = document.createElement("div");
    resultBox.className = "result-success";

    const title = document.createElement("h3");
    title.textContent = "Kết quả: " + item.predictedLabel;

    const info = document.createElement("div");
    info.className = "result-info";

    const details = [
        ["Lớp dự đoán", item.predictedClass],
        ["Malignant", formatPercent(item.probabilityMalignant)],
        ["Benign", formatPercent(item.probabilityBenign)],
        ["Model version", item.modelVersion]
    ];

    details.forEach(([label, value]) => {

        const box = document.createElement("div");
        box.className = "result-item";

        const strong = document.createElement("strong");
        strong.textContent = label;

        const content = document.createElement("span");
        content.textContent = value ?? "--";

        box.append(strong, content);
        info.appendChild(box);

    });

    resultBox.append(title, info);
    detailResult.appendChild(resultBox);


    // Display 30 input features
    detailFeatures.replaceChildren();

    if (item.features && typeof item.features === "object") {

        Object.entries(item.features).forEach(([name, value]) => {

            const group = document.createElement("div");
            group.className = "feature-group";

            const label = document.createElement("label");
            label.textContent = name;

            const input = document.createElement("input");
            input.type = "text";
            input.value = String(value);
            input.readOnly = true;

            group.append(label, input);
            detailFeatures.appendChild(group);

        });

    }

    detailSection.style.display = "block";

    detailSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// =====================================
// 7. DELETE ONE RECORD
// =====================================

async function deleteRecord(id) {
    const confirmed = confirm(
        "Bạn có chắc chắn muốn xóa lần phân tích này?"
    );

    if (!confirmed) {
        return;
    }

    try {
        if (typeof window.bcDeleteCloudSession !== "function") {
            throw new Error("Chưa kết nối chức năng xóa Supabase");
        }

        // Xóa trên Supabase trước
        await window.bcDeleteCloudSession(id);

        // Chỉ cập nhật Local Storage khi API thành công
        const history = getHistory();

        const updatedHistory = history.filter(
            item => String(item.id) !== String(id)
        );

        saveHistory(updatedHistory);

        // Đóng phần chi tiết
        detailSection.style.display = "none";

        // Cập nhật bảng lịch sử
        renderHistory();

        alert("Đã xóa lịch sử phân tích thành công.");

    } catch (error) {
        console.error("Lỗi xóa lịch sử:", error);

        alert(
            "Không thể xóa lịch sử trên Supabase: "
            + error.message
        );
    }
}


// =====================================
// 8. TABLE ACTION EVENTS
// =====================================

tableBody.addEventListener("click", event => {

    const button = event.target.closest("button[data-action]");

    if (!button) {
        return;
    }

    const id = button.dataset.id;

    if (button.dataset.action === "detail") {
        showDetail(id);
    }

    if (button.dataset.action === "delete") {
        deleteRecord(id);
    }

});


// =====================================
// 9. CLEAR ALL HISTORY
// =====================================


clearButton.addEventListener("click", async () => {
    const history = getHistory();

    if (history.length === 0) {
        alert("Chưa có dữ liệu lịch sử để xóa.");
        return;
    }

    const confirmed = confirm(
        "Bạn có chắc chắn muốn xóa toàn bộ lịch sử phân tích? " +
        "Dữ liệu đã xóa trên Supabase sẽ không thể khôi phục."
    );

    if (!confirmed) {
        return;
    }

    if (typeof window.bcDeleteCloudSession !== "function" ||
        typeof window.bcLoadCloudSessions !== "function") {
        alert("Chưa kết nối chức năng xóa lịch sử Supabase.");
        return;
    }

    clearButton.disabled = true;

    try {
        // Tải danh sách mới nhất của tài khoản từ Supabase
        const data = await window.bcLoadCloudSessions();
        const sessions = data.sessions || [];

        let deletedCount = 0;

        // Xóa lần lượt từng bản ghi trên Supabase
        for (const session of sessions) {
            await window.bcDeleteCloudSession(session.id);
            deletedCount++;
        }

        // Chỉ xóa Local Storage khi tất cả yêu cầu thành công
        saveHistory([]);

        detailSection.style.display = "none";
        renderHistory();

        alert(
            "Đã xóa thành công " +
            deletedCount +
            " bản ghi lịch sử."
        );

    } catch (error) {
        console.error("Lỗi xóa toàn bộ lịch sử:", error);

        // Tải lại các bản ghi còn lại nếu quá trình xóa bị gián đoạn
        try {
            const data = await window.bcLoadCloudSessions();

            saveHistory(
                (data.sessions || []).map(normalizeCloudSession)
            );

            renderHistory();
        } catch (reloadError) {
            console.error("Không thể tải lại lịch sử:", reloadError);
        }

        alert(
            "Chưa thể xóa toàn bộ lịch sử: " +
            error.message
        );

    } finally {
        clearButton.disabled = false;
    }
});



// =====================================
// 10. SEARCH AND FILTER
// =====================================

searchInput.addEventListener("input", renderHistory);

filterSelect.addEventListener("change", renderHistory);


closeDetailButton.addEventListener("click", () => {
    detailSection.style.display = "none";
});



// =====================================
// 11. INITIALIZE
// =====================================

async function initializeHistory() {
    // Hiển thị lịch sử đang có trên trình duyệt
    renderHistory();

    try {
        if (typeof window.bcLoadCloudSessions !== "function") {
            console.warn("Chưa tải cloud-history.js");
            return;
        }

        // Lấy lịch sử từ Supabase
        const data = await window.bcLoadCloudSessions();

        const cloudHistory = (data.sessions || [])
            .map(normalizeCloudSession);

        // Cập nhật bộ nhớ trình duyệt
        saveHistory(cloudHistory);

        // Hiển thị lại bảng lịch sử
        renderHistory();

        console.log(
            "Đã đồng bộ",
            cloudHistory.length,
            "bản ghi từ Supabase"
        );

    } catch (error) {
        console.error(
            "Không tải được lịch sử Supabase:",
            error
        );
    }
}

document.addEventListener("bc:account-ready", initializeHistory);

