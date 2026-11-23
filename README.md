# BreastCare SVM · Breast-Cancer-DA2

BreastCare là ứng dụng học tập và nghiên cứu dùng SVM để phân loại mẫu trong bộ dữ liệu
Wisconsin Diagnostic Breast Cancer (WDBC). Ứng dụng hỗ trợ phân tích một mẫu, phân tích
tệp nhiều mẫu, so sánh các kernel và xem lịch sử theo tài khoản.

| Thành phần | Vai trò | Địa chỉ |
| --- | --- | --- |
| BreastCare | Trang Tổng quan, phân tích và quản trị | [Mở BreastCare](https://breast-cancer-da2.onrender.com/) |
| Identity Center | Đăng ký, đăng nhập, danh sách ứng dụng và cấp quyền | [Mở Identity Center](https://identity-center.onrender.com/) |
| FastAPI | Xác thực, dự đoán, lịch sử và quản trị | [Tài liệu API](https://breast-cancer-da2-api.onrender.com/docs) |
| PostgreSQL trên Supabase | Lưu tài khoản, phiên, quyền ứng dụng và lịch sử | Kết nối qua biến môi trường `DATABASE_URL` của backend |

## Cấu trúc thư mục

Trong thư mục làm việc có ba phần. Repo `breast-cancer-svm/` chứa mã nguồn BreastCare
và backend dùng chung. Repo `identity-center/` được triển khai riêng. Thư mục
`identity-client-test/` là một ứng dụng thử OAuth.

```text
Breast-Cancer_DA2_CapNhat/
├── breast-cancer-svm/
│   ├── README.md
│   ├── render.yaml
│   ├── frontend/
│   │   ├── index.html, analysis.html, batch.html, history.html
│   │   ├── statistics.html, compare.html, model.html
│   │   ├── profile.html, admin.html, author.html
│   │   ├── login.html, register.html, launch.html
│   │   ├── js/
│   │   │   ├── pages/
│   │   │   │   ├── dashboard.js, analysis.js, research-samples.js
│   │   │   │   ├── batch.js, history.js, statistics.js
│   │   │   │   └── compare.js, profile.js, admin.js
│   │   │   ├── session/
│   │   │   │   └── auth.js, entry.js, launch.js, user-storage.js
│   │   │   └── shared/
│   │   │       ├── navigation.js, theme.js
│   │   │       └── batch-results.js, cloud-history.js, features-vi.js
│   │   ├── css/
│   │   │   ├── style.css, modern.css, studio.css, components.css
│   │   │   └── research-layout.css, workspace-layout.css, session-transition.css
│   │   └── assets/
│   │       ├── images/admin_avatar.jpg
│   │       └── samples/
│   │           ├── breast-cancer-mau-20-dong.csv
│   │           └── breast-cancer-mau-co-nhan.csv
│   └── backend/
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py
│       │   ├── accounts.py
│       │   └── admin_activity.py
│       ├── artifacts/
│       │   ├── breast_cancer_svm.joblib
│       │   └── metadata.json
│       ├── scripts/
│       │   ├── train.py
│       │   ├── check_predict.py
│       │   └── provision_admin.py
│       ├── tests/
│       │   └── test_api.py
│       ├── supabase_accounts.sql
│       ├── supabase_identity_portal.sql
│       ├── supabase_history.sql
│       ├── supabase_batch_600.sql
│       └── requirements.txt
├── identity-center/
│   ├── index.html, login.html, register.html
│   ├── js/
│   │   ├── auth.js, hub.js, portal-client.js
│   │   └── config.js, consent.js, security.js, supabase.js
│   ├── css/
│   │   └── auth-motion.css, portal.css, style.css
│   ├── consent.html, oauth/consent/index.html
│   ├── security.html, security.css, switch-account.html
│   ├── forgot-password.html, reset-password.html
│   └── supabase_profiles.sql, supabase_reset_users.sql
└── identity-client-test/
    ├── index.html
    ├── app.js
    ├── config.js
    └── style.css
```

### `breast-cancer-svm/frontend/`

Các trang HTML nằm ở gốc `frontend/` để giữ nguyên URL trên Render.
JavaScript được đặt theo vai trò trong `js/pages/`, `js/session/` và `js/shared/`.

| Trang hoặc thư mục | Tệp chính và vai trò |
| --- | --- |
| Tổng quan | `index.html` và `js/pages/dashboard.js` hiển thị thông tin mô hình và thống kê hoạt động. |
| Phân tích một mẫu | `analysis.html` và `js/pages/analysis.js` xử lý 30 đặc trưng theo ba tab Mean, Error, Worst. `js/pages/research-samples.js` cung cấp 10 mẫu, mỗi nhãn có 5 mẫu. |
| Phân tích tệp | `batch.html` và `js/pages/batch.js` đọc CSV, TXT, XLSX hoặc XLS tối đa 600 mẫu. Tệp có nhãn hỗ trợ đối chiếu kết quả và xuất CSV. |
| Lịch sử và thống kê | `history.html`, `statistics.html`, `js/pages/history.js` và `js/pages/statistics.js` hiển thị dữ liệu theo tài khoản. |
| So sánh mô hình | `compare.html`, `model.html` và `js/pages/compare.js` trình bày WDBC và so sánh Linear, RBF, Polynomial, Sigmoid. |
| Hồ sơ và quản trị | `profile.html`, `admin.html`, `js/pages/profile.js` và `js/pages/admin.js` xử lý hồ sơ, đổi mật khẩu, danh sách tài khoản và lịch sử hệ thống. |
| Phiên đăng nhập | `login.html`, `register.html`, `launch.html` và `js/session/` chuyển sang Identity Center, thực hiện PKCE và quản lý phiên BreastCare theo tab. |
| Mã dùng chung | `js/shared/navigation.js` tạo menu dùng chung và đánh dấu trang hiện tại. `theme.js` quản lý chế độ sáng/tối. `features-vi.js`, `batch-results.js` và `cloud-history.js` dùng chung cho các trang nghiên cứu. |
| Giao diện | `css/` chứa lớp nền, bố cục và kiểu cho thành phần giao diện. `components.css` gom kiểu bảng, thẻ, nút, các điều khiển và quy tắc giao diện dùng chung. |
| Ảnh và dữ liệu mẫu | `assets/images/` có ảnh dùng ở trang tác giả. `assets/samples/` chứa tệp CSV mẫu cho hai chế độ phân tích. |

Trong WDBC, **nhãn 0 là ác tính (malignant)** và **nhãn 1 là lành tính (benign)**.
Chế độ tệp có nhãn dùng nhãn gốc để tính số đúng, sai, tỷ lệ khớp và số sai theo từng nhãn.

### `breast-cancer-svm/backend/`

| Đường dẫn | Nội dung |
| --- | --- |
| [`app/main.py`](backend/app/main.py) | Khởi tạo FastAPI và CORS, nạp mô hình, xử lý dự đoán, benchmark SVM, lịch sử phân tích và thống kê tổng hợp. |
| [`app/accounts.py`](backend/app/accounts.py) | Đăng ký, đăng nhập, kiểm tra mật khẩu Argon2id, giới hạn số lần thử, phiên Identity Center, cấp quyền ứng dụng, đổi mật khẩu và đăng xuất. |
| [`app/admin_activity.py`](backend/app/admin_activity.py) | API quản trị dành cho UUID được cấu hình, hỗ trợ tìm tài khoản, phân trang và xem lịch sử theo người dùng. |
| [`artifacts/`](backend/artifacts/) | Tệp mô hình đã huấn luyện và metadata, gồm danh sách đặc trưng, phiên bản và thông tin mô hình. |
| [`scripts/train.py`](backend/scripts/train.py) | Huấn luyện mô hình từ WDBC của scikit-learn và ghi mô hình cùng metadata vào `artifacts/`. |
| [`scripts/check_predict.py`](backend/scripts/check_predict.py) | Gửi một mẫu WDBC đến endpoint dự đoán trên Render và in phản hồi. |
| [`scripts/provision_admin.py`](backend/scripts/provision_admin.py) | Tạo hoặc cập nhật tài khoản quản trị theo `DA2_ADMIN_USER_ID`, nhập mật khẩu qua terminal và lưu bản băm. |
| [`tests/test_api.py`](backend/tests/test_api.py) | Kiểm thử API, gồm dữ liệu đầu vào, giới hạn 600 mẫu, kiểm tra nhãn và yêu cầu xác thực. |
| [`requirements.txt`](backend/requirements.txt) | Thư viện Python cho API, mô hình, kết nối PostgreSQL và kiểm thử. |

### `identity-center/` và `identity-client-test/`

- Trong [repo Identity Center](https://github.com/Le-Thanh-Thao-2106/identity-center),
  `login.html` và `register.html` chứa hai form chuyển đổi trong cùng một trang.
  `index.html` là danh mục ứng dụng và hộp xin quyền truy cập BreastCare.
- `js/auth.js` xử lý form và trạng thái chờ. `js/hub.js` hiển thị danh mục và gửi yêu cầu mở BreastCare.
  `js/portal-client.js` dùng chung cho các yêu cầu API, quản lý phiên và thông tin hồ sơ tạm trong tab.
  `css/portal.css` tạo giao diện chính và `css/auth-motion.css` điều khiển hiệu ứng chuyển form.
- `oauth/consent/`, `consent.html`, `js/consent.js`, `js/supabase.js`, các trang bảo mật cũ
  và các tệp SQL đi kèm thuộc phần tích hợp Supabase OAuth trước đây.
  Luồng BreastCare hiện tại xác thực qua FastAPI và PostgreSQL. `supabase_profiles.sql` tạo hoặc đồng bộ hồ sơ Supabase Auth cũ.
  `supabase_reset_users.sql` xóa tài khoản Supabase Auth và thuộc quy trình đặt lại dữ liệu cũ.
- `identity-client-test/` là ứng dụng thử luồng OAuth Supabase, gồm giao diện, mã gọi API và cấu hình thử.
  BreastCare và Identity Center triển khai trực tiếp từ hai repo của chúng.

## Luồng sử dụng và dữ liệu

1. Mở URL gốc BreastCare để thấy form Identity Center. Đăng ký thành công sẽ đưa người dùng về form đăng nhập.
2. Đăng nhập bằng email và mật khẩu. FastAPI kiểm tra bản băm trong PostgreSQL và cấp phiên Identity Center.
3. Chọn **Mở BreastCare** trong danh mục. Lần đầu cần **Cho phép** hoặc **Từ chối**. Quyền được lưu theo tài khoản.
4. Nếu được phép, BreastCare đổi mã PKCE dùng một lần lấy phiên riêng rồi mở Tổng quan.
   Mã dùng một lần hết hạn sau 90 giây. Khi chuyển mục, ứng dụng tận dụng phiên hiện tại trong tab.
5. Dùng **Mở Identity Center** trong Hồ sơ để quay về danh mục ứng dụng. Mở lại URL gốc BreastCare sẽ yêu cầu đăng nhập lại.

### Các tệp SQL của backend

| Tệp | Dùng khi nào |
| --- | --- |
| [`supabase_accounts.sql`](backend/supabase_accounts.sql) | Thiết lập cơ sở dữ liệu BreastCare. Tạo schema riêng và các bảng tài khoản, phiên BreastCare, mã một lần, giới hạn thử đăng nhập và lịch sử. |
| [`supabase_identity_portal.sql`](backend/supabase_identity_portal.sql) | Bổ sung phiên Identity Center, quyền ứng dụng và liên kết giữa hai loại phiên. API có thể áp dụng khi khởi tạo phiên. Chạy trong SQL Editor nếu tài khoản kết nối backend thiếu quyền sửa schema. |
| [`supabase_history.sql`](backend/supabase_history.sql) | Tạo riêng bảng lưu lịch sử `public.bc_analysis_sessions` và các chỉ mục. File thiết lập chính ở trên cũng tạo bảng này. |
| [`supabase_batch_600.sql`](backend/supabase_batch_600.sql) | Nâng giới hạn lưu lịch sử tệp từ 200 lên 600 mẫu cho cơ sở dữ liệu cũ. Backend có thể áp dụng khi lưu tệp trên 200 mẫu nếu có quyền sửa bảng. |

Với cơ sở dữ liệu mới, chạy `supabase_accounts.sql` trước, sau đó chạy
`supabase_identity_portal.sql`. Các bước trên dùng lại dữ liệu đang có.
Tài khoản BreastCare nằm trong `breastcare_private.accounts`. Có thể xem những cột cần thiết
trong SQL Editor bằng câu lệnh sau:

```sql
select id, email, full_name, created_at
from breastcare_private.accounts
order by created_at desc;
```

### Các nhóm API chính

| Endpoint | Chức năng |
| --- | --- |
| `GET /health`, `GET /metadata` | Kiểm tra API và thông tin mô hình. |
| `POST /predict`, `POST /predict/batch` | Dự đoán bằng mô hình mặc định. |
| `POST /predict/compare`, `POST /predict/batch/compare`, `GET /benchmark` | Dự đoán theo kernel được chọn và xem chỉ số so sánh. |
| `/account/register`, `/account/login`, `/account/portal/*`, `/account/exchange` | Đăng ký, đăng nhập, cấp quyền và chuyển phiên giữa hai website. |
| `/account/profile`, `/account/password`, `/account/logout` | Hồ sơ, đổi mật khẩu và đăng xuất BreastCare. |
| `/history/sessions`, `/history/sessions/{id}` | Lưu, xem danh sách, xem chi tiết và xóa phiên phân tích của tài khoản. |
| `/admin/users`, `/admin/activity/*`, `/admin/overview`, `/admin/statistics` | Danh sách người dùng, hoạt động và thống kê dành cho quản trị viên. |

## Chạy và triển khai

### Chạy backend và kiểm thử

Từ thư mục `breast-cancer-svm/`, chạy:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m pytest -q
python -m uvicorn app.main:app --reload
```

API cục bộ có tài liệu tại `http://127.0.0.1:8000/docs`. Để gọi các API tài khoản và lịch sử
có dữ liệu, đặt `DATABASE_URL` trong môi trường chạy backend. Frontend hiện cấu hình URL Render.
Kiểm thử toàn bộ luồng bằng hai frontend cục bộ cần cấu hình đồng bộ URL dịch vụ và origin được phép
ở hai frontend và backend.

### Triển khai trên Render

| Dịch vụ | Repo | Cấu hình |
| --- | --- | --- |
| BreastCare Static Site | `Breast-Cancer-DA2` | Nhánh `main`, Publish Directory `frontend/`. |
| BreastCare API Web Service | `Breast-Cancer-DA2` | Root Directory `backend`, Build Command `pip install -r requirements.txt`, Start Command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, Health Check Path `/health`. |
| Identity Center Static Site | `identity-center` | Nhánh `main`, Publish Directory là thư mục gốc repo chứa `index.html`, `login.html` và `register.html`. |

- Đặt `DATABASE_URL` trong **Environment** của API Web Service. Trên Supabase, vào **Connect → Session pooler** để sao chép URI PostgreSQL dùng SSL.
- Đặt `DA2_ADMIN_USER_ID` bằng UUID quản trị viên trong Environment của API. Để tạo hoặc cập nhật tài khoản đó,
  đặt hai biến môi trường trên máy đang chạy script, vào `backend/` và chạy
  `python -X utf8 -m scripts.provision_admin`. Dùng lại UUID cũ nếu cần giữ liên kết với lịch sử hiện có.
- [`render.yaml`](render.yaml) mô tả cấu hình Web Service API. Sau khi triển khai, mở
  [`/health`](https://breast-cancer-da2-api.onrender.com/health) để kiểm tra API đã nạp mô hình,
  rồi thử đăng nhập và mở BreastCare để xác minh luồng qua PostgreSQL.
