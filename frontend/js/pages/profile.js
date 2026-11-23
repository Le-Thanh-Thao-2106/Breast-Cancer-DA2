
const profilePasswordForm = document.getElementById("passwordForm");

function setPasswordVisible(button, visible) {
    const field = document.getElementById(button.dataset.passwordToggle);
    const label = field.labels[0].textContent.toLowerCase();
    field.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", (visible ? "Ẩn " : "Hiển thị ") + label);
}

profilePasswordForm.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => setPasswordVisible(
        button, button.getAttribute("aria-pressed") !== "true"
    ));
});

bindAccountForm(profilePasswordForm, document.getElementById("passwordMessage"), async () => {
    const password = document.getElementById("newPassword").value;
    if (password !== document.getElementById("confirmNewPassword").value) {
        throw new Error("Mật khẩu mới và mật khẩu nhập lại không khớp.");
    }

    await accountRequest("password", {
        current_password: document.getElementById("currentPassword").value,
        password,
    });
    profilePasswordForm.reset();
    profilePasswordForm.querySelectorAll("[data-password-toggle]").forEach(
        (button) => setPasswordVisible(button, false)
    );
    document.getElementById("passwordMessage").textContent = "Đã đổi mật khẩu.";
});

document.getElementById("switchAccount").addEventListener("click", logoutBreastCare);

document.addEventListener("bc:account-ready", ({ detail: user }) => {
    const name = user.full_name || user.email || "Người dùng";
    document.getElementById("profileName").textContent = name;
    document.getElementById("profileEmail").textContent = user.email || "";

    const state = document.getElementById("profileSessionState");
    state.textContent = "Đang hoạt động";
    state.dataset.active = "true";

    try {
        const items = JSON.parse(localStorage.getItem(getUserHistoryKey()) || "[]");
        if (Array.isArray(items)) {
            document.getElementById("profileAnalysisCount").textContent =
                items.length + " lần đã lưu trên trình duyệt này";
        }
    } catch {
        // The history link remains available without local storage.
    }

    const key = "bc_avatar_" + user.sub;
    const avatar = document.getElementById("profileAvatar");
    const input = document.getElementById("avatarUpload");
    const message = document.getElementById("avatarMessage");
    const remove = document.getElementById("removeAvatar");

    function renderAvatar() {
        const data = localStorage.getItem(key);
        remove.disabled = !data;
        if (data) {
            const image = document.createElement("img");
            image.src = data;
            image.alt = "Ảnh đại diện";
            avatar.replaceChildren(image);
        } else {
            avatar.textContent = name[0].toUpperCase();
        }
    }

    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        input.value = "";
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1024 * 1024) {
            message.textContent = "Chỉ nhận JPG, PNG, WebP tối đa 1 MB.";
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                localStorage.setItem(key, reader.result);
                renderAvatar();
                showBreastCareAccountAvatar(reader.result);
                message.textContent = "Đã lưu ảnh đại diện trên trình duyệt này.";
            } catch {
                message.textContent = "Không thể lưu ảnh đại diện trên trình duyệt này.";
            }
        };
        reader.onerror = () => {
            message.textContent = "Không đọc được ảnh đã chọn.";
        };
        reader.readAsDataURL(file);
    });

    remove.addEventListener("click", () => {
        try {
            localStorage.removeItem(key);
            renderAvatar();
            showBreastCareAccountAvatar(null);
            message.textContent = "Đã xóa ảnh đại diện.";
        } catch {
            message.textContent = "Không thể xóa ảnh đại diện.";
        }
    });

    try {
        renderAvatar();
    } catch {
        avatar.textContent = name[0].toUpperCase();
        remove.disabled = true;
    }
});
