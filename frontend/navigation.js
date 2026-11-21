document.addEventListener('DOMContentLoaded',()=>{const path=location.pathname.split('/').pop();document.querySelectorAll('.sidebar-menu a').forEach(a=>{a.classList.toggle('active',a.getAttribute('href')===path)});});
// Đồng bộ avatar hiển thị trên thanh điều hướng, nếu đã lưu trong trình duyệt.
try{const u=JSON.parse(sessionStorage.getItem('bc_user')||'null');const uid=u&&(u.sub||u.id||u.email);const data=uid&&localStorage.getItem('bc_avatar_'+uid);if(data){document.querySelectorAll('.sidebar .avatar,.top-avatar').forEach(el=>{const img=document.createElement('img');img.src=data;img.alt='Avatar';el.replaceChildren(img)})}}catch{}

try{const u=JSON.parse(sessionStorage.getItem('bc_user')||'{}');if(String(u.email||'').toLowerCase()==='lethao8130@gmail.com'){document.getElementById('adminNavLink')?.removeAttribute('hidden')}}catch(e){}
