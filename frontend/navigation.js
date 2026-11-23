const sidebar = document.querySelector(".sidebar");
const sidebarPreference = "bc_sidebar_collapsed";

if (sidebar) {
    const brand = sidebar.querySelector(".brand");
    const menu = sidebar.querySelector(".sidebar-menu");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "brand-icon sidebar-toggle";
    toggle.textContent = "✚";
    menu.id = "workspaceMenu";
    menu.setAttribute("aria-label", "Điều hướng BreastCare");
    toggle.setAttribute("aria-controls", menu.id);
    brand.querySelector(".brand-icon").replaceWith(toggle);
    brand.querySelector("h2").textContent = "BreastCare SVM";
    brand.querySelector("span")?.remove();

    const activePath = location.pathname.split("/").pop() || "index.html";
    menu.querySelectorAll("a").forEach((link) => {
        const [icon, ...words] = link.textContent.trim().split(/\s+/);
        const label = words.join(" ");
        const symbol = document.createElement("span");
        symbol.className = "sidebar-symbol";
        symbol.setAttribute("aria-hidden", "true");
        symbol.textContent = icon;
        const caption = document.createElement("span");
        caption.className = "sidebar-caption";
        caption.textContent = label;
        link.replaceChildren(symbol, caption);
        link.title = label;
        link.setAttribute("aria-label", label);
        const active = link.getAttribute("href") === activePath;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
    });

    const media = matchMedia("(max-width: 750px)");
    let collapsed;
    try {
        const saved = localStorage.getItem(sidebarPreference);
        if (saved !== null) collapsed = saved === "true";
    } catch {
        // The menu still works when browser storage is disabled.
    }

    const arrow = document.createElement("button");
    arrow.type = "button";
    arrow.className = "sidebar-arrow";
    arrow.textContent = "‹";
    arrow.setAttribute("aria-controls", menu.id);
    brand.append(arrow);

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

    const logout = document.getElementById("ssoLogoutBtn");
    logout.dataset.icon = "↪";
    logout.title = logout.textContent.trim();
    logout.setAttribute("aria-label", logout.title);
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
