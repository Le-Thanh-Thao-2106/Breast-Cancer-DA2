const sidebar = document.querySelector(".sidebar");
const sidebarPreference = "bc_sidebar_collapsed";

if (sidebar) {
    sidebar.innerHTML = `
        <div class="brand">
            <button type="button" class="brand-icon sidebar-toggle" aria-controls="workspaceMenu">
                ✚
            </button>
            <div><h2>BreastCare SVM</h2></div>
            <button type="button" class="sidebar-arrow" aria-controls="workspaceMenu">‹</button>
        </div>
        <div class="menu-label" data-menu-label>KHÔNG GIAN LÀM VIỆC</div>
        <nav class="sidebar-menu" id="workspaceMenu" aria-label="Điều hướng BreastCare">
            <a href="index.html" class="menu-item">
                <span class="sidebar-symbol" aria-hidden="true">◫</span>
                <span class="sidebar-caption">Tổng quan</span>
            </a>
            <a href="analysis.html" class="menu-item">
                <span class="sidebar-symbol" aria-hidden="true">⌕</span>
                <span class="sidebar-caption">Phân tích một mẫu</span>
            </a>
            <a href="batch.html" class="menu-item">
                <span class="sidebar-symbol" aria-hidden="true">▦</span>
                <span class="sidebar-caption">Phân tích file</span>
            </a>
            <a href="history.html" class="menu-item">
                <span class="sidebar-symbol" aria-hidden="true">▤</span>
                <span class="sidebar-caption">Lịch sử phân tích</span>
            </a>
            <a href="statistics.html" class="menu-item">
                <span class="sidebar-symbol" aria-hidden="true">◴</span>
                <span class="sidebar-caption">Thống kê cá nhân</span>
            </a>
            <div class="menu-label">THÔNG TIN</div>
            <a href="compare.html" class="menu-item">
                <span class="sidebar-symbol" aria-hidden="true">▥</span>
                <span class="sidebar-caption">So sánh 4 kernel SVM</span>
            </a>
            <a href="admin.html" class="menu-item" id="adminNavLink" hidden>
                <span class="sidebar-symbol" aria-hidden="true">♛</span>
                <span class="sidebar-caption">Quản trị hệ thống</span>
            </a>
            <a href="model.html" class="menu-item">
                <span class="sidebar-symbol" aria-hidden="true">◇</span>
                <span class="sidebar-caption">Mô hình SVM</span>
            </a>
            <a href="profile.html" class="menu-item">
                <span class="sidebar-symbol" aria-hidden="true">♙</span>
                <span class="sidebar-caption">Tài khoản của tôi</span>
            </a>
            <a href="author.html" class="menu-item">
                <span class="sidebar-symbol" aria-hidden="true">✧</span>
                <span class="sidebar-caption">Tác giả &amp; Hướng dẫn</span>
            </a>
        </nav>
        <div class="sidebar-bottom">
            <div class="user-profile">
                <div class="avatar">ID</div>
                <div class="user-info">
                    <strong id="ssoUserName">Người dùng</strong>
                    <span id="ssoUserEmail">BreastCare</span>
                </div>
            </div>
            <button class="sidebar-logout" id="ssoLogoutBtn" type="button"
                data-icon="↪" title="Đăng xuất" aria-label="Đăng xuất">
                Đăng xuất
            </button>
        </div>
    `;
    if (sidebar.dataset.menuTitle) {
        sidebar.querySelector("[data-menu-label]").textContent = sidebar.dataset.menuTitle;
    }

    const toggle = sidebar.querySelector(".sidebar-toggle");
    const arrow = sidebar.querySelector(".sidebar-arrow");
    const activePath = location.pathname.split("/").pop() || "index.html";

    sidebar.querySelectorAll(".menu-item").forEach((link) => {
        const label = link.querySelector(".sidebar-caption").textContent;
        link.title = label;
        link.setAttribute("aria-label", label);
        if (link.getAttribute("href") === activePath) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
    });

    const media = matchMedia("(max-width: 750px)");
    let collapsed;
    try {
        const saved = localStorage.getItem(sidebarPreference);
        if (saved !== null) collapsed = saved === "true";
    } catch {
        // The menu still works when browser storage is disabled.
    }

    function renderMenu() {
        const compact = collapsed ?? media.matches;
        sidebar.classList.toggle("sidebar-collapsed", compact);
        const label = compact ? "Mở rộng menu" : "Thu gọn menu";
        for (const button of [toggle, arrow]) {
            button.setAttribute("aria-expanded", String(!compact));
            button.setAttribute("aria-label", label);
            button.title = label;
        }
    }

    function toggleMenu(event) {
        collapsed = !sidebar.classList.contains("sidebar-collapsed");
        try {
            localStorage.setItem(sidebarPreference, String(collapsed));
        } catch {
            // Keep the preference for the current page.
        }
        renderMenu();
        if (collapsed && event.currentTarget === arrow) toggle.focus();
    }

    toggle.addEventListener("click", toggleMenu);
    arrow.addEventListener("click", toggleMenu);
    media.addEventListener("change", renderMenu);
    renderMenu();
}

function showBreastCareAccountAvatar(data) {
    document.querySelectorAll(".sidebar .avatar, .top-avatar").forEach((element) => {
        if (!element.dataset.initials) element.dataset.initials = element.textContent.trim();
        if (data) {
            const image = document.createElement("img");
            image.src = data;
            image.alt = "Ảnh đại diện";
            element.replaceChildren(image);
        } else {
            element.textContent = element.dataset.initials;
        }
    });
}

document.addEventListener("bc:account-ready", ({ detail: user }) => {
    try {
        showBreastCareAccountAvatar(localStorage.getItem("bc_avatar_" + user.sub));
    } catch {
        // Avatar storage is optional.
    }
});
