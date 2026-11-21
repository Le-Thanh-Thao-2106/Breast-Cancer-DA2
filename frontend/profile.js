document.addEventListener('DOMContentLoaded',()=>{try{const u=JSON.parse(sessionStorage.getItem('bc_user')||'null');if(!u)return;const name=u.full_name||u.user_metadata?.full_name||u.name||u.email||'Người dùng';document.getElementById('profileName').textContent=name;document.getElementById('profileEmail').textContent=u.email||'';document.getElementById('profileId').textContent='User ID: '+(u.sub||u.id||'Không xác định');document.getElementById('profileAvatar').textContent=name.slice(0,1).toUpperCase()}catch{}document.getElementById('profileLogout').addEventListener('click',logoutSSO)});
document.addEventListener('DOMContentLoaded',()=>{
 try{const items=JSON.parse(localStorage.getItem(getUserHistoryKey())||'[]');document.getElementById('profileAnalysisCount').textContent=Array.isArray(items)?items.length:0}catch{}
 document.getElementById('switchAccount')?.addEventListener('click',()=>{
  sessionStorage.removeItem('bc_access_token');sessionStorage.removeItem('bc_user');
  sessionStorage.removeItem('bc_code_verifier');sessionStorage.removeItem('bc_oauth_state');
  window.location.assign('http://https://identity-center.onrender.com/switch-account.html');
 });
});

// Ảnh đại diện: lưu riêng theo ID tài khoản trong localStorage của trình duyệt.
document.addEventListener('DOMContentLoaded',()=>{
 const raw=sessionStorage.getItem('bc_user');if(!raw)return;
 let user;try{user=JSON.parse(raw)}catch{return}
 const uid=user.sub||user.id||user.email;if(!uid)return;
 const key='bc_avatar_'+uid, el=document.getElementById('profileAvatar'), input=document.getElementById('avatarUpload'),msg=document.getElementById('avatarMessage');
 const render=()=>{const data=localStorage.getItem(key);if(data){el.replaceChildren();const img=document.createElement('img');img.src=data;img.alt='Ảnh đại diện';el.append(img)}else{el.textContent=(user.full_name||user.user_metadata?.full_name||user.email||'U').charAt(0).toUpperCase()}};
 input?.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1024*1024){msg.textContent='Chỉ nhận JPG, PNG, WebP tối đa 1 MB.';return}const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem(key,reader.result);render();msg.textContent='Đã lưu ảnh đại diện trên trình duyệt này.'}catch{msg.textContent='Bộ nhớ trình duyệt không đủ để lưu ảnh.'}};reader.readAsDataURL(file)});
 document.getElementById('removeAvatar')?.addEventListener('click',()=>{localStorage.removeItem(key);render();msg.textContent='Đã xóa ảnh đại diện.'});render();
});
