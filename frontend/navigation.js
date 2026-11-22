document.addEventListener('DOMContentLoaded',()=>{const path=location.pathname.split('/').pop();document.querySelectorAll('.sidebar-menu a').forEach(a=>{a.classList.toggle('active',a.getAttribute('href')===path)});});
// Đồng bộ avatar hiển thị trên thanh điều hướng, nếu đã lưu trong trình duyệt.
document.addEventListener('bc:account-ready', ({ detail: user }) => {
    try {
        const data = localStorage.getItem('bc_avatar_' + user.sub);
        if (!data) return;
        document.querySelectorAll('.sidebar .avatar,.top-avatar').forEach(element => {
            const image = document.createElement('img');
            image.src = data;
            image.alt = 'Ảnh đại diện';
            element.replaceChildren(image);
        });
    } catch {}
});
