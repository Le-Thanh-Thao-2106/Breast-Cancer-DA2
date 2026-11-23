if (location.pathname === "/" || document.documentElement.dataset.identityEntry) {
    const page = document.documentElement.dataset.identityEntry || "login";
    sessionStorage.removeItem("bc_session_token");
    sessionStorage.removeItem("bc_user");
    sessionStorage.removeItem("bc_sign_in_attempt");
    sessionStorage.removeItem("bc_launch_attempt");
    location.replace("https://identity-center.onrender.com/" + page + ".html");
}
