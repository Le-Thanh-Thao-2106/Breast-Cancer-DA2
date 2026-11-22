document.addEventListener('DOMContentLoaded',()=>{
 document.getElementById('profileLogout').addEventListener('click',logoutSSO);
 document.getElementById('switchAccount')?.addEventListener('click',()=>{
  sessionStorage.removeItem('bc_access_token');sessionStorage.removeItem('bc_user');
  sessionStorage.removeItem('bc_code_verifier');sessionStorage.removeItem('bc_oauth_state');
  window.location.assign('https://identity-center.onrender.com/switch-account.html');
 });
});

// Ảnh đại diện: lưu riêng theo ID tài khoản trong localStorage của trình duyệt.
document.addEventListener('bc:account-ready', ({ detail: user }) => {
 const uid = user.sub;
 const name = user.full_name || user.email || 'Người dùng';
 document.getElementById('profileName').textContent = name;
 document.getElementById('profileEmail').textContent = user.email || '';
 document.getElementById('profileId').textContent = 'User ID: ' + uid;
 try{const items=JSON.parse(localStorage.getItem(getUserHistoryKey())||'[]');document.getElementById('profileAnalysisCount').textContent=Array.isArray(items)?items.length:0}catch{}
 const key='bc_avatar_'+uid, el=document.getElementById('profileAvatar'), input=document.getElementById('avatarUpload'),msg=document.getElementById('avatarMessage');
 const render=()=>{const data=localStorage.getItem(key);if(data){el.replaceChildren();const img=document.createElement('img');img.src=data;img.alt='Ảnh đại diện';el.append(img)}else{el.textContent=name.charAt(0).toUpperCase()}};
 input?.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1024*1024){msg.textContent='Chỉ nhận JPG, PNG, WebP tối đa 1 MB.';return}const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem(key,reader.result);render();msg.textContent='Đã lưu ảnh đại diện trên trình duyệt này.'}catch{msg.textContent='Bộ nhớ trình duyệt không đủ để lưu ảnh.'}};reader.readAsDataURL(file)});
 document.getElementById('removeAvatar')?.addEventListener('click',()=>{localStorage.removeItem(key);render();msg.textContent='Đã xóa ảnh đại diện.'});render();
});
