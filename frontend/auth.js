const BREASTCARE_API = "https://breast-cancer-da2-api.onrender.com";
const BREASTCARE_SESSION_KEY = "bc_session_token";
const IDENTITY_CENTER = "https://identity-center.onrender.com";
let breastCareUser = null;

function fetchBreastCare(path, options = {}) {
    const token = sessionStorage.getItem(BREASTCARE_SESSION_KEY);
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(BREASTCARE_API + path, { ...options, headers, cache: "no-store" });
}

function clearBreastCareSession() {
    sessionStorage.removeItem(BREASTCARE_SESSION_KEY);
    sessionStorage.removeItem("bc_user");
    sessionStorage.removeItem("bc_launch_attempt");
    breastCareUser = null;
}

async function accountRequest(path, body) {
    const options =
        body === undefined
            ? {}
            : {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
              };
    const response = await fetchBreastCare(`/account/${path}`, options);
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.detail || "Yêu cầu thất bại.");
        error.status = response.status;
        throw error;
    }
    if (data.session_token) sessionStorage.setItem(BREASTCARE_SESSION_KEY, data.session_token);
    return data;
}

async function logoutBreastCare() {
    const request = fetchBreastCare("/account/logout", {
        method: "POST",
        signal: AbortSignal.timeout(5000),
    });
    clearBreastCareSession();
    document.body.classList.remove("account-ready");
    const message = document.getElementById("accountLoading");
    message.hidden = false;
    message.textContent = "Đang đăng xuất…";
    try {
        await request;
    } catch {
        // The Identity Center login page also ends its previous portal session.
    }
    location.replace(IDENTITY_CENTER + "/login.html");
}

function showBreastCareAccount(user) {
    breastCareUser = user;
    const name = document.getElementById("ssoUserName");
    const email = document.getElementById("ssoUserEmail");
    const adminLink = document.getElementById("adminNavLink");
    if (name) name.textContent = user.full_name || user.email;
    if (email) email.textContent = user.email;
    if (adminLink) adminLink.hidden = user.is_admin !== true;
    document.dispatchEvent(new CustomEvent("bc:account-ready", { detail: user }));
}

function bindAccountForm(form, message, submit) {
    if (!form) return;
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type=submit]");
        button.disabled = true;
        message.textContent = "Đang xử lý…";
        try {
            await submit();
        } catch (error) {
            message.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
}

async function initBreastCare() {
    if (document.body.hasAttribute("data-account-launch") || location.pathname === "/") return;
    const message = document.getElementById("accountLoading");
    document.getElementById("ssoLogoutBtn")?.addEventListener("click", logoutBreastCare);
    if (!sessionStorage.getItem(BREASTCARE_SESSION_KEY)) {
        clearBreastCareSession();
        location.replace(IDENTITY_CENTER + "/login.html");
        return;
    }

    try {
        const user = await accountRequest("profile");
        document.body.classList.add("account-ready");
        message.hidden = true;
        showBreastCareAccount(user);
    } catch (error) {
        if (error.status === 401) {
            clearBreastCareSession();
            location.replace(IDENTITY_CENTER + "/login.html");
        } else {
            message.textContent = error.message || "Không thể xác minh phiên BreastCare.";
        }
    }
}

window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
});
document.addEventListener("DOMContentLoaded", initBreastCare);
