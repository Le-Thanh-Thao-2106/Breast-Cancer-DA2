# Breast-Cancer-DA2

## Triển khai đăng nhập BreastCare với PostgreSQL

1. Trong project Supabase DA2, chạy bản mới nhất của `backend/supabase_accounts.sql` trong SQL Editor, kể cả khi đã chạy bản trước. File tạo bảng tài khoản, phiên và mã chuyển phiên một lần, đồng thời giữ tài khoản và lịch sử hiện có.
2. Trong **Connect → Session pooler**, sao chép chuỗi kết nối PostgreSQL dùng SSL. Lưu chuỗi kết nối trong biến bí mật `DATABASE_URL` trên Render và trong môi trường cục bộ dùng để tạo admin.
3. Đặt `DA2_ADMIN_USER_ID` bằng UUID admin cũ, ở cả môi trường cục bộ và Render. Từ thư mục `backend`, sau khi cài `requirements.txt`, chạy `python -X utf8 -m scripts.provision_admin` rồi nhập email, họ tên và mật khẩu mới. Lịch sử gắn với UUID admin tiếp tục truy cập được.
4. Trên Render, Static Site tiếp tục xuất bản thư mục `frontend/`. Với Web Service API, dùng **Root Directory** `backend`, Build Command `pip install -r requirements.txt` và Start Command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
5. Triển khai nhánh `main` của repo Identity Center lên dịch vụ Static Site hiện có. Publish Directory của repo này là thư mục gốc chứa `login.html` và `register.html`.
6. Mở `https://identity-center.onrender.com/login.html` để đăng nhập hoặc đăng ký. Form gửi dữ liệu đến FastAPI, dùng mã một lần để BreastCare nhận phiên, rồi mở `https://breast-cancer-da2.onrender.com/index.html`. Mã phiên được lưu trong `sessionStorage` của tab BreastCare.

Mật khẩu tài khoản được nhập qua terminal và băm bằng Argon2id. `DATABASE_URL` chỉ dùng ở backend. Người dùng thường tạo tài khoản BreastCare mới và nhận UUID mới. Dữ liệu trình duyệt tiếp tục nằm trên tên miền BreastCare cũ và được tra theo UUID của tài khoản đang đăng nhập.

Để kiểm tra tài khoản mới trong Supabase, mở SQL Editor và chạy:

```sql
select id, email, full_name, created_at
from breastcare_private.accounts
order by created_at desc;
```

Danh sách **Authentication → Users** chỉ hiển thị các tài khoản do Supabase Auth quản lý. Mở `https://breast-cancer-da2-api.onrender.com/health` để kiểm tra Web Service, rồi thử đăng ký và đăng nhập tại Static Site để kiểm tra kết nối PostgreSQL.
