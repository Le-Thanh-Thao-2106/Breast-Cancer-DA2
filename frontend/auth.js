const BREASTCARE_API = "https://breast-cancer-da2-api.onrender.com";
const BREASTCARE_SESSION_KEY = "bc_session_token";
const IDENTITY_CENTER = "https://identity-center.onrender.com";
const SIGN_IN_ATTEMPT_KEY = "bc_sign_in_attempt";
const SIGN_IN_VALUE = /^[A-Za-z0-9_-]{43}$/;

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

function encodeSignInValue(bytes) {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function openIdentityCenter(page) {
    const state = encodeSignInValue(crypto.getRandomValues(new Uint8Array(32)));
    const verifier = encodeSignInValue(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    sessionStorage.setItem(SIGN_IN_ATTEMPT_KEY, JSON.stringify({ state, verifier }));
    const params = new URLSearchParams({ from: "breastcare", state, code_challenge: encodeSignInValue(new Uint8Array(digest)) });
    location.replace(`${IDENTITY_CENTER}/${page}.html?${params}`);
}

async function finishIdentitySignIn(params) {
    const code = params.get("code");
    const state = params.get("state");
    history.replaceState(null, "", location.pathname);
    const attempt = JSON.parse(sessionStorage.getItem(SIGN_IN_ATTEMPT_KEY) || "null");
    if (!SIGN_IN_VALUE.test(code) || !SIGN_IN_VALUE.test(state) || attempt?.state !== state) {
        throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
    }
    sessionStorage.removeItem(SIGN_IN_ATTEMPT_KEY);
    await accountRequest("exchange", { code, verifier: attempt.verifier });
    location.replace("index.html");
}

async function initBreastCare() {
    const entry = document.body.dataset.accountEntry;
    const passwordForm = document.getElementById("passwordForm");
    const message = document.getElementById("ssoMessage");
    const value = (id) => document.getElementById(id).value;

    if (entry) {
        const start = async () => {
            try {
                message.textContent = "Đang mở Identity Center…";
                await openIdentityCenter(entry);
            } catch (error) {
                message.textContent = error.message;
            }
        };
        document.getElementById("startIdentity").addEventListener("click", start);
        const callback = new URLSearchParams(location.hash.slice(1));
        if (callback.has("code") || callback.has("state")) {
            try {
                message.textContent = "Đang xác nhận đăng nhập…";
                await finishIdentitySignIn(callback);
            } catch (error) {
                message.textContent = error.message;
            }
        } else {
            await start();
        }
        return;
    }

    bindAccountForm(passwordForm, document.getElementById("passwordMessage"), async () => {
        await accountRequest("password", {
            current_password: value("currentPassword"), password: value("newPassword")
        });
        passwordForm.reset();
        document.getElementById("passwordMessage").textContent = "Đã đổi mật khẩu.";
    });

    document.getElementById("ssoLogoutBtn")?.addEventListener("click", logoutBreastCare);
    if (!sessionStorage.getItem(BREASTCARE_SESSION_KEY)) {
        clearBreastCareSession();
        location.replace("login.html");
        return;
    }
    try {
        const user = await accountRequest("profile");
        showBreastCareAccount(user);
    } catch (error) {
        if (error.status === 401) {
            clearBreastCareSession();
            location.replace("login.html");
        } else if (message) {
            message.textContent = error.message;
        }
    }
}

document.addEventListener("DOMContentLoaded", initBreastCare);
