const BREASTCARE_API = "https://breast-cancer-da2-api.onrender.com";
const BREASTCARE_SESSION_KEY = "bc_session_token";

function fetchBreastCare(path, options = {}) {
    const token = sessionStorage.getItem(BREASTCARE_SESSION_KEY);
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(BREASTCARE_API + path, { ...options, headers, cache: "no-store" });
}

function clearBreastCareSession() {
    sessionStorage.removeItem(BREASTCARE_SESSION_KEY);
    sessionStorage.removeItem("bc_user");
}

async function accountRequest(path, body) {
    const options = body === undefined ? {} : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
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
    try {
        await accountRequest("logout", {});
        clearBreastCareSession();
        location.replace("login.html");
    } catch (error) {
        const message = document.getElementById("ssoMessage");
        if (message) message.textContent = error.message;
    }
}

function showBreastCareAccount(user) {
    sessionStorage.setItem("bc_user", JSON.stringify(user));
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
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const passwordForm = document.getElementById("passwordForm");
    const message = document.getElementById("ssoMessage");
    const value = (id) => document.getElementById(id).value;

    bindAccountForm(loginForm, message, async () => {
        await accountRequest("login", { email: value("loginEmail"), password: value("loginPassword") });
        location.replace("index.html");
    });
    bindAccountForm(registerForm, document.getElementById("registerMessage"), async () => {
        const password = value("registerPassword");
        if (password !== value("confirmPassword")) throw new Error("Mật khẩu xác nhận không khớp.");
        await accountRequest("register", {
            email: value("registerEmail"), password, full_name: value("fullName")
        });
        location.replace("index.html");
    });
    bindAccountForm(passwordForm, document.getElementById("passwordMessage"), async () => {
        await accountRequest("password", {
            current_password: value("currentPassword"), password: value("newPassword")
        });
        passwordForm.reset();
        document.getElementById("passwordMessage").textContent = "Đã đổi mật khẩu.";
    });

    document.getElementById("ssoLogoutBtn")?.addEventListener("click", logoutBreastCare);
    const publicPage = Boolean(loginForm || registerForm);
    if (!sessionStorage.getItem(BREASTCARE_SESSION_KEY)) {
        clearBreastCareSession();
        if (!publicPage) location.replace("login.html");
        return;
    }
    try {
        const user = await accountRequest("profile");
        if (publicPage) {
            location.replace("index.html");
            return;
        }
        showBreastCareAccount(user);
    } catch (error) {
        if (error.status === 401) {
            clearBreastCareSession();
            if (!publicPage) location.replace("login.html");
        } else if (message) {
            message.textContent = error.message;
        }
    }
}

document.addEventListener("DOMContentLoaded", initBreastCare);
