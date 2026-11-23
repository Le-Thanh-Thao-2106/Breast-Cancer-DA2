
const adminStatus = document.getElementById("adminStatus");
const adminContent = document.getElementById("adminContent");
const adminDrawer = document.getElementById("adminDrawer");
const userRows = document.getElementById("adminUserRows");
const historyRows = document.getElementById("adminHistoryRows");
const pageSize = 15;
const formatNumber = new Intl.NumberFormat("vi-VN");
const formatTime = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
});
const formatDate = new Intl.DateTimeFormat("vi-VN");

let search = "";
let userRequest = 0;
let historyRequest = 0;
let drawerRequest = 0;
let historyView = "users";

async function adminRequest(path, params = {}) {
    const query = new URLSearchParams(params);
    const response = await fetchBreastCare("/admin/" + path + (query.size ? "?" + query : ""));
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof result.detail === "string" ? result.detail : "Không thể tải dữ liệu quản trị.");
    }
    return result;
}

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function row(values) {
    const tr = element("tr");
    for (const item of values) {
        const cell = element("td");
        cell.append(item);
        tr.append(cell);
    }
    return tr;
}

function emptyRow(container, columns, message) {
    const tr = row([message]);
    tr.firstChild.colSpan = columns;
    container.replaceChildren(tr);
}

function userButton(id, name) {
    const button = element("button", name, "workspace-user-link");
    button.type = "button";
    button.addEventListener("click", () => openActivity(id, name));
    return button;
}

function displayDate(value, formatter = formatTime) {
    const date = new Date(value);
    return value && !Number.isNaN(date.getTime()) ? formatter.format(date) : "—";
}

function sessionKind(session) {
    if (session.kind === "single") return "Phân tích một mẫu";
    return session.has_labels ? "File đã có nhãn" : "Phân tích file";
}

function kernelNames(kernels) {
    return kernels?.join(", ") || "—";
}

function drawPaging(container, total, offset, limit, load) {
    const info = total
        ? `${formatNumber.format(offset + 1)}–${formatNumber.format(Math.min(offset + limit, total))} / ${formatNumber.format(total)}`
        : "0 kết quả";
    const buttons = element("div", undefined, "workspace-actions");
    for (const [caption, target, disabled] of [
        ["Trước", offset - limit, offset === 0],
        ["Sau", offset + limit, offset + limit >= total],
    ]) {
        const button = element("button", caption, "workspace-secondary");
        button.type = "button";
        button.disabled = disabled;
        button.addEventListener("click", () => load(target));
        buttons.append(button);
    }
    container.replaceChildren(element("span", info, "workspace-note"), buttons);
}

async function loadUsers(offset = 0) {
    const request = ++userRequest;
    const paging = document.getElementById("adminUserPaging");
    paging.replaceChildren();
    emptyRow(userRows, 4, "Đang tải người dùng…");
    try {
        const data = await adminRequest("users", { q: search, limit: pageSize, offset });
        if (request !== userRequest) return;
        if (data.total && offset >= data.total) {
            await loadUsers(Math.floor((data.total - 1) / pageSize) * pageSize);
            return;
        }
        if (!data.users.length) {
            emptyRow(userRows, 4, "Không tìm thấy người dùng.");
            return;
        }
        const rows = data.users.map((user) => {
            const name = user.full_name || user.email;
            const identity = element("div");
            identity.append(
                userButton(user.id, name),
                element("div", user.email, "workspace-note workspace-user-email")
            );
            return row([
                identity,
                element("span", user.is_admin ? "Quản trị viên" : "Người dùng", "workspace-badge"),
                displayDate(user.created_at, formatDate),
                formatNumber.format(user.session_count),
            ]);
        });
        userRows.replaceChildren(...rows);
        drawPaging(paging, data.total, offset, pageSize, loadUsers);
    } catch (error) {
        if (request === userRequest) emptyRow(userRows, 4, error.message);
    }
}

async function loadHistory(offset = 0) {
    const request = ++historyRequest;
    const limit = historyView === "users" ? 4 : pageSize;
    const paging = document.getElementById("adminHistoryPaging");
    paging.replaceChildren();
    emptyRow(historyRows, 5, "Đang tải lịch sử…");
    try {
        const data = await adminRequest("activity/sessions", { limit, offset });
        if (request !== historyRequest) return;
        if (data.total && offset >= data.total) {
            await loadHistory(Math.floor((data.total - 1) / limit) * limit);
            return;
        }
        if (!data.sessions.length) {
            emptyRow(historyRows, 5, "Chưa có phiên phân tích đã lưu.");
            return;
        }
        historyRows.replaceChildren(...data.sessions.map((session) => row([
            displayDate(session.created_at),
            userButton(session.user_id, session.full_name || "Tài khoản cũ"),
            sessionKind(session),
            kernelNames(session.kernels),
            formatNumber.format(session.sample_count),
        ])));
        if (historyView === "activity") drawPaging(paging, data.total, offset, limit, loadHistory);
    } catch (error) {
        if (request === historyRequest) emptyRow(historyRows, 5, error.message);
    }
}

async function openActivity(userId, name) {
    document.getElementById("adminDrawerTitle").textContent = "Hoạt động của " + name;
    if (!adminDrawer.open) adminDrawer.showModal();
    await loadUserActivity(userId, 0);
}

async function loadUserActivity(userId, offset) {
    const request = ++drawerRequest;
    const summary = document.getElementById("adminDrawerSummary");
    const items = document.getElementById("adminDrawerItems");
    const paging = document.getElementById("adminDrawerPaging");
    summary.textContent = "Đang tải hoạt động…";
    items.replaceChildren();
    paging.replaceChildren();

    try {
        const data = await adminRequest("activity/sessions", { user_id: userId, limit: pageSize, offset });
        if (request !== drawerRequest) return;
        if (data.total && offset >= data.total) {
            await loadUserActivity(userId, Math.floor((data.total - 1) / pageSize) * pageSize);
            return;
        }
        summary.textContent = data.total ? formatNumber.format(data.total) + " phiên đã lưu" : "Chưa có phiên phân tích đã lưu.";
        items.replaceChildren(...data.sessions.map((session) => {
            const card = element("li");
            const details = element("div");
            const caption = session.kind === "batch"
                ? sessionKind(session) + " · " + formatNumber.format(session.sample_count) + " mẫu"
                : sessionKind(session);
            details.append(
                element("strong", caption),
                element("div", displayDate(session.created_at), "workspace-note"),
            );
            if (session.filename) details.append(element("div", session.filename, "workspace-note"));
            card.append(details, element("span", kernelNames(session.kernels), "workspace-badge"));
            return card;
        }));
        if (data.total) drawPaging(paging, data.total, offset, pageSize, (next) => loadUserActivity(userId, next));
    } catch (error) {
        if (request === drawerRequest) summary.textContent = error.message;
    }
}

adminDrawer.addEventListener("close", () => drawerRequest++);
document.getElementById("adminSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    search = document.getElementById("adminSearch").value.trim();
    loadUsers();
});

document.querySelectorAll("[data-admin-view]").forEach((tab) => {
    tab.addEventListener("click", () => {
        historyView = tab.dataset.adminView;
        document.querySelectorAll("[data-admin-view]").forEach((item) => {
            item.setAttribute("aria-pressed", String(item === tab));
        });
        document.getElementById("adminUsers").hidden = historyView === "activity";
        document.getElementById("adminHistoryHeading").textContent =
            historyView === "activity" ? "Lịch sử toàn hệ thống" : "Hoạt động gần đây toàn hệ thống";
        loadHistory();
    });
});

document.getElementById("adminDetails").parentElement.addEventListener("toggle", async (event) => {
    const details = document.getElementById("adminDetails");
    if (!event.currentTarget.open || details.dataset.loading || details.dataset.loaded) return;
    details.dataset.loading = "true";
    details.textContent = "Đang tải mô hình…";
    try {
        const [data, usage] = await Promise.all([
            adminRequest("overview"),
            adminRequest("statistics"),
        ]);
        const table = element("table");
        const head = table.createTHead();
        const headers = head.insertRow();
        for (const label of ["Kernel", "Accuracy", "F1", "Huấn luyện (ms)", "Số phiên sử dụng"]) {
            headers.append(element("th", label));
        }
        const body = table.createTBody();
        for (const item of data.benchmark.results) {
            body.append(row([
                item.kernel,
                (item.accuracy * 100).toFixed(2) + "%",
                (item.f1 * 100).toFixed(2) + "%",
                item.training_ms,
                formatNumber.format(usage.kernel_usage[item.kernel] ?? 0),
            ]));
        }
        details.replaceChildren(element("p", "Phiên bản mô hình " + data.model_version), table);
        details.dataset.loaded = "true";
    } catch (error) {
        details.textContent = error.message;
    } finally {
        delete details.dataset.loading;
    }
});

document.addEventListener("bc:account-ready", async ({ detail: user }) => {
    if (!user.is_admin) {
        adminStatus.textContent = "Tài khoản này không có quyền quản trị.";
        return;
    }
    try {
        const totals = await adminRequest("activity/overview");
        document.getElementById("adminUsersTotal").textContent = formatNumber.format(totals.total_users);
        document.getElementById("adminSessionsTotal").textContent = formatNumber.format(totals.total_sessions);
        document.getElementById("adminSamplesTotal").textContent = formatNumber.format(totals.total_samples);
        adminStatus.hidden = true;
        adminContent.hidden = false;
        await Promise.all([loadUsers(), loadHistory()]);
    } catch (error) {
        adminStatus.textContent = error.message;
    }
}, { once: true });
