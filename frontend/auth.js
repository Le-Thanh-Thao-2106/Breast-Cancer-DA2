const oldBreastCareHost = "breast-cancer-da2.onrender.com";
const breastCareOrigin = "https://breast-cancer-da2-api.onrender.com";

async function accountRequest(path, body) {
    const options = body === undefined ? {} : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    };
    const response = await fetch(`/account/${path}`, options);
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.detail || "Yêu cầu thất bại.");
        error.status = response.status;
        throw error;
    }
    return data;
}

async function logoutBreastCare() {
    try {
        await accountRequest("logout", {});
        sessionStorage.removeItem("bc_user");
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
    if (location.hostname === oldBreastCareHost) {
        const path = location.pathname === "/" ? "/index.html" : location.pathname;
        const target = new URL(breastCareOrigin);
        target.pathname = path;
        location.replace(target.href);
        return;
    }

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const passwordForm = document.getElementById("passwordForm");
    const message = document.getElementById("ssoMessage");
    const value = (id) => document.getElementById(id).value;

    bindAccountForm(loginForm, message, async () => {
        await accountRequest("login", { email: value("loginEmail"), password: value("loginPassword") });
        location.replace("profile.html");
    });
    bindAccountForm(registerForm, document.getElementById("registerMessage"), async () => {
        const password = value("registerPassword");
        if (password !== value("confirmPassword")) throw new Error("Mật khẩu xác nhận không khớp.");
        await accountRequest("register", {
            email: value("registerEmail"), password, full_name: value("fullName")
        });
        location.replace("profile.html");
    });
    bindAccountForm(passwordForm, document.getElementById("passwordMessage"), async () => {
        await accountRequest("password", {
            current_password: value("currentPassword"), password: value("newPassword")
        });
        passwordForm.reset();
        document.getElementById("passwordMessage").textContent = "Đã đổi mật khẩu.";
    });

    document.getElementById("ssoLogoutBtn")?.addEventListener("click", logoutBreastCare);
    try {
        const user = await accountRequest("profile");
        if (loginForm || registerForm) {
            location.replace("profile.html");
            return;
        }
        showBreastCareAccount(user);
    } catch (error) {
        sessionStorage.removeItem("bc_user");
        if (error.status === 401) {
            if (!loginForm && !registerForm) location.replace("login.html");
        } else if (message) {
            message.textContent = error.message;
        }
    }
}

document.addEventListener("DOMContentLoaded", initBreastCare);
