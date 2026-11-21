
const AUTH_URL =
    `${SSO_CONFIG.supabaseUrl}/auth/v1/oauth/authorize`;

const TOKEN_URL =
    `${SSO_CONFIG.supabaseUrl}/auth/v1/oauth/token`;

const USERINFO_URL =
    `${SSO_CONFIG.supabaseUrl}/auth/v1/oauth/userinfo`;

function randomString(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);

    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function base64UrlEncode(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";

    bytes.forEach(b => {
        binary += String.fromCharCode(b);
    });

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function createCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(hash);
}

async function loginWithSSO() {
    const verifier = randomString(32);
    const state = randomString(16);
    const challenge = await createCodeChallenge(verifier);

    sessionStorage.setItem("bc_code_verifier", verifier);
    sessionStorage.setItem("bc_oauth_state", state);

    const params = new URLSearchParams({
        client_id: SSO_CONFIG.clientId,
        redirect_uri: SSO_CONFIG.redirectUri,
        response_type: "code",
        scope: SSO_CONFIG.scope,
        state: state,
        code_challenge: challenge,
        code_challenge_method: "S256"
    });

    window.location.assign(`${AUTH_URL}?${params.toString()}`);
}

async function getUser(accessToken) {
    const response = await fetch(USERINFO_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    const user = await response.json();

    if (!response.ok) {
        throw new Error("Không thể xác minh tài khoản.");
    }

    return user;
}

async function handleSSOCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
        throw new Error(
            params.get("error_description") || error
        );
    }

    if (!code) return;

    const state = sessionStorage.getItem("bc_oauth_state");
    const verifier = sessionStorage.getItem("bc_code_verifier");

    if (!state || !verifier || params.get("state") !== state) {
        throw new Error("Trạng thái xác thực không hợp lệ.");
    }

    // Tránh để authorization code tồn tại trên thanh địa chỉ.
    window.history.replaceState(
        {},
        document.title,
        SSO_CONFIG.redirectUri
    );

    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            client_id: SSO_CONFIG.clientId,
            redirect_uri: SSO_CONFIG.redirectUri,
            code_verifier: verifier
        })
    });

    const tokens = await response.json();

    if (!response.ok || !tokens.access_token) {
        throw new Error(
            tokens.error_description ||
            tokens.error ||
            "Không thể lấy access token."
        );
    }

    const user = await getUser(tokens.access_token);

    sessionStorage.setItem(
        "bc_access_token",
        tokens.access_token
    );

    sessionStorage.setItem(
        "bc_user",
        JSON.stringify(user)
    );

    sessionStorage.removeItem("bc_code_verifier");
    sessionStorage.removeItem("bc_oauth_state");
    window.location.replace("index.html");
}

function logoutSSO() {
    sessionStorage.removeItem("bc_access_token");
    sessionStorage.removeItem("bc_user");
    sessionStorage.removeItem("bc_code_verifier");
    sessionStorage.removeItem("bc_oauth_state");

    // Đăng xuất cả Identity Center để lần sau có thể chọn tài khoản khác.
    window.location.replace("http://https://identity-center.onrender.com/switch-account.html?from=breastcare");
}

function displaySSOUser(user) {
    const name =
        user.full_name ||
        user.user_metadata?.full_name ||
        user.name ||
        user.email ||
        "Người dùng";

    const email = user.email || "";

    const nameElement = document.getElementById("ssoUserName");
    const emailElement = document.getElementById("ssoUserEmail");

    if (nameElement) nameElement.textContent = name;
    if (emailElement) emailElement.textContent = email;
}

async function initSSOPage() {
    const loginButton = document.getElementById("ssoLoginBtn");

    if (loginButton) {
        loginButton.addEventListener("click", loginWithSSO);

        // Nếu đã đăng nhập, đi thẳng đến trang chủ.
        const token = sessionStorage.getItem("bc_access_token");

        if (token) {
            try {
                await getUser(token);
                window.location.replace("index.html");
            } catch {
                logoutSSO();
            }
        }
        return;
    }

    const message = document.getElementById("ssoMessage");

    try {
        await handleSSOCallback();

        const token = sessionStorage.getItem("bc_access_token");

        if (!token) {
            window.location.replace("login.html");
            return;
        }

        const user = await getUser(token);
        sessionStorage.setItem("bc_user", JSON.stringify(user));
        displaySSOUser(user);

        const logoutButton = document.getElementById("ssoLogoutBtn");

        if (logoutButton) {
            logoutButton.addEventListener("click", logoutSSO);
        }
    } catch (error) {
        sessionStorage.removeItem("bc_access_token");
        sessionStorage.removeItem("bc_user");

        if (message) {
            message.textContent = "Lỗi SSO: " + error.message;
        } else {
            alert("Lỗi SSO: " + error.message);
            window.location.replace("login.html");
        }
    }
}

document.addEventListener("DOMContentLoaded", initSSOPage);
