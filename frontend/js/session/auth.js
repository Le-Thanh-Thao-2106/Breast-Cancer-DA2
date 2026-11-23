const BREASTCARE_API = "https://breast-cancer-da2-api.onrender.com";
const BREASTCARE_SESSION_KEY = "bc_session_token";
const BREASTCARE_PROFILE_KEY = "bc_verified_profile";
const PROFILE_REFRESH_MS = 5 * 60 * 1000;
const IDENTITY_CENTER = "https://identity-center.onrender.com";
let breastCareUser = null;
let pageSessionToken = null;
let profileRefresh = null;

async function fetchBreastCare(path, options = {}) {
    const token = activeSessionToken();
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(BREASTCARE_API + path, { ...options, headers, cache: "no-store" });
    const needsActiveSession = path === "/account/profile" || !path.startsWith("/account/");
    if (response.status === 401 && needsActiveSession && token === activeSessionToken()) {
        returnToSignIn();
    }
    return response;
}

function clearBreastCareSession() {
    sessionStorage.removeItem(BREASTCARE_SESSION_KEY);
    sessionStorage.removeItem(BREASTCARE_PROFILE_KEY);
    sessionStorage.removeItem("bc_user");
    sessionStorage.removeItem("bc_launch_attempt");
    breastCareUser = null;
    pageSessionToken = null;
}

function activeSessionToken() {
    return sessionStorage.getItem(BREASTCARE_SESSION_KEY);
}

function readVerifiedProfile(token) {
    try {
        const cached = JSON.parse(sessionStorage.getItem(BREASTCARE_PROFILE_KEY));
        if (cached?.token === token && cached.user?.sub && Number.isFinite(cached.checkedAt)) {
            return cached;
        }
    } catch {
        // A missing or invalid cache is rebuilt after a successful profile request.
    }
    return null;
}

function storeVerifiedProfile(token, user, checkedAt = Date.now()) {
    sessionStorage.setItem(BREASTCARE_PROFILE_KEY, JSON.stringify({ token, user, checkedAt }));
}

function returnToSignIn() {
    clearBreastCareSession();
    document.body.classList.remove("account-ready");
    location.replace(IDENTITY_CENTER + "/login.html");
}

async function accountRequest(path, body) {
    const requestToken = activeSessionToken();
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
    if (data.session_token && activeSessionToken() === requestToken) {
        const cached = readVerifiedProfile(requestToken);
        sessionStorage.setItem(BREASTCARE_SESSION_KEY, data.session_token);
        pageSessionToken = data.session_token;
        sessionStorage.removeItem(BREASTCARE_PROFILE_KEY);
        if (path === "password" && (breastCareUser || cached)) {
            storeVerifiedProfile(data.session_token, breastCareUser || cached.user);
        }
    }
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

function refreshBreastCareProfile(token) {
    if (profileRefresh) return profileRefresh;

    profileRefresh = accountRequest("profile")
        .then((user) => {
            if (token !== activeSessionToken()) return;
            storeVerifiedProfile(token, user);
            if (!breastCareUser) {
                showBreastCareAccount(user);
                return;
            }

            if (
                breastCareUser.sub !== user.sub ||
                breastCareUser.email !== user.email ||
                breastCareUser.full_name !== user.full_name ||
                breastCareUser.is_admin !== user.is_admin
            ) {
                location.reload();
            }
        })
        .catch((error) => {
            if (token !== activeSessionToken() || breastCareUser) return;
            const message = document.getElementById("accountLoading");
            message.hidden = false;
            message.textContent = error.message || "Không thể tải thông tin tài khoản.";
        })
        .finally(() => {
            profileRefresh = null;
        });
    return profileRefresh;
}

function refreshProfileIfNeeded(token, cached) {
    const age = cached ? Date.now() - cached.checkedAt : Infinity;
    if (age < 0 || age >= PROFILE_REFRESH_MS) {
        refreshBreastCareProfile(token);
    }
}

function initBreastCare() {
    if (document.body.hasAttribute("data-account-launch") || location.pathname === "/") return;
    const token = activeSessionToken();
    if (!token) {
        returnToSignIn();
        return;
    }

    pageSessionToken = token;
    document.body.classList.add("account-ready");
    document.getElementById("ssoLogoutBtn")?.addEventListener("click", logoutBreastCare);
    const cached = readVerifiedProfile(token);
    if (cached) showBreastCareAccount(cached.user);
    refreshProfileIfNeeded(token, cached);
}

window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    if (document.body.hasAttribute("data-account-launch")) {
        location.replace(IDENTITY_CENTER + "/");
        return;
    }
    const token = activeSessionToken();
    if (!token) {
        returnToSignIn();
    } else if (token !== pageSessionToken) {
        document.body.classList.remove("account-ready");
        location.reload();
    } else {
        refreshProfileIfNeeded(token, readVerifiedProfile(token));
    }
});
document.addEventListener("DOMContentLoaded", initBreastCare);
