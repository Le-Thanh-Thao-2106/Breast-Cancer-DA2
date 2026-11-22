# Breast-Cancer-DA2

## Triển khai đăng nhập BreastCare với PostgreSQL

1. Trong project Supabase DA2, chạy `backend/supabase_accounts.sql` trong SQL Editor. File tạo schema tài khoản riêng và giữ dữ liệu Supabase Auth, hồ sơ và lịch sử cũ.
2. Trong **Connect → Session pooler**, sao chép chuỗi kết nối PostgreSQL dùng SSL. Lưu chuỗi kết nối trong biến bí mật `DATABASE_URL` trên Render và trong môi trường cục bộ dùng để tạo admin.
3. Đặt `DA2_ADMIN_USER_ID` bằng UUID admin cũ, ở cả môi trường cục bộ và Render. Từ thư mục `backend`, sau khi cài `requirements.txt`, chạy `python -X utf8 -m scripts.provision_admin` rồi nhập email, họ tên và mật khẩu mới. Lịch sử gắn với UUID admin tiếp tục truy cập được.
4. Trên Render, đặt **Root Directory** của Web Service về gốc repo để FastAPI có thể phục vụ `frontend/`. Dùng Build Command `pip install -r backend/requirements.txt` và Start Command `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`.
5. Sau khi deploy, mở `https://breast-cancer-da2-api.onrender.com/login.html`. Thử đăng nhập admin, đăng ký một tài khoản thường và kiểm tra hồ sơ, lịch sử, đăng xuất. Khi static site cũ được cập nhật, các trang BreastCare cũ chuyển người dùng sang Web Service để cookie và API cùng origin.

Mật khẩu tài khoản được nhập qua terminal và băm bằng Argon2id. `DATABASE_URL` chỉ dùng ở backend. Người dùng thường tạo tài khoản BreastCare mới và nhận UUID mới. Lịch sử lưu riêng trong trình duyệt của tên miền cũ chưa được chuyển sang tên miền mới.
