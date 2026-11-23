const launchMessage = document.getElementById("launchMessage");
const launchKey = "bc_launch_attempt";
const handoffValue = /^[A-Za-z0-9_-]{43}$/;

function base64url(bytes) {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function prepareLaunch() {
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    sessionStorage.setItem(launchKey, JSON.stringify({ state, verifier }));
    const query = new URLSearchParams({
        app: "breastcare",
        state,
        code_challenge: base64url(new Uint8Array(digest)),
    });
    location.replace(`${IDENTITY_CENTER}/?${query}`);
}

async function completeLaunch() {
    const params = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, "", location.pathname);
    const attempt = JSON.parse(sessionStorage.getItem(launchKey) || "null");
    sessionStorage.removeItem(launchKey);
    const code = params.get("code");
    const state = params.get("state");

    if (!handoffValue.test(code) || !handoffValue.test(state) || attempt?.state !== state) {
        throw new Error("Yêu cầu mở BreastCare đã hết hiệu lực. Vui lòng chọn lại ứng dụng.");
    }

    await accountRequest("exchange", { code, verifier: attempt.verifier });
    location.replace("index.html");
}

const launch = location.hash ? completeLaunch : prepareLaunch;
launch().catch((error) => {
    launchMessage.textContent = error.message || "Không mở được BreastCare.";
    document.getElementById("launchReturn").hidden = false;
});
