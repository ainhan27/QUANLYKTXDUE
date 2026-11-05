# DỰ ÁN HỌC PHẦN MIS3047: QUẢN LÝ QUY TRÌNH KINH DOANH (BPM)
## ĐẠI HỌC KINH TẾ – ĐẠI HỌC ĐÀ NẴNG (DUE) | NHÓM 4
### ĐỀ TÀI: HỆ THỐNG XÉT DUYỆT HỒ SƠ ĐĂNG KÝ NỘI TRÚ KÝ TÚC XÁ (KTX)
---
## 1. GIỚI THIỆU TỔNG QUAN & KHUNG PHƯƠNG PHÁP LUẬN IDEA

Hệ thống được xây dựng nhằm hiện thực hóa mô hình nghiệp vụ To-Be đã mô hình hóa bằng chuẩn **BPMN 2.0** (`MohinhTo_be_Nhom4.bpmn`), phục vụ toàn thể sinh viên **mọi khóa (K47, K48, K49, K50, K51+)** với quy mô thực tế lên đến **350 sinh viên xét tuyển / đợt**:
1. **Thời gian chờ gom mẻ hồ sơ (7 ngày)** $\rightarrow$ Số hóa nộp đơn trực tuyến và tính điểm ưu tiên Real-time cho 350 sinh viên với phân trang mượt mà.
2. **Nộp bản cứng & đối chiếu giấy tờ (3-6 ngày)** $\rightarrow$ Tự động thẩm định ảnh minh chứng bằng **Gemini 1.5 Flash Vision API** (bắt ảnh lạ/meme, trích xuất CCCD và phân ngưỡng tự động) kết hợp cơ chế rà soát side-by-side của Cán bộ QLSV.
3. **Phê duyệt thủ công nhiều tầng & nguy cơ trả lời chậm** $\rightarrow$ Dashboard **1-Click Approve** dành cho Trưởng ban KTX và phát hành hợp đồng điện tử xác thực qua **mã OTP trong 72 giờ**.

---

## 2. NGĂN XẾP CÔNG NGHỆ (TECH STACK)

* **Giao diện & API Server:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS.
* **Cơ sở dữ liệu & Xác thực:** Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS) cho 4 Roles.
* **Lưu trữ bảo mật:** Supabase Private Storage (`evidences` bucket) với chính sách Storage RLS & Signed URLs.
* **Trí tuệ nhân tạo (AI Vision):** Google Gemini 1.5 Flash API (Structured JSON Schema & Exponential Retry Boundary Event).
* **Truyền thông Real-time:** Supabase Realtime Channels (WebSocket) trên bảng `rankings`.
* **Gửi Email tự động:** Resend API / Nodemailer với mẫu HTML chuẩn thương hiệu DUE.

---

## 3. DANH SÁCH TÀI KHOẢN THỬ NGHIỆM ĐỂ CHẤM BÀI

> [!NOTE]
> **Mật khẩu dùng chung cho tất cả các tài khoản thử nghiệm:** `MatKhau123@`

| Vai trò (Role) | Họ và Tên | Email Đăng Nhập | Mục Đích Kiểm Thử |
| :--- | :--- | :--- | :--- |
| **Tân Sinh Viên (SV)** | Lê Hoàng Nam | `nam.le@due.edu.vn` | Xem HĐ trúng tuyển & Ký OTP (`888888`) |
| **Tân Sinh Viên (SV)** | Nguyễn Văn An | `an.nguyen@due.edu.vn` | Hồ sơ được AI duyệt đạt (`THAM_DINH_DAT`) |
| **Tân Sinh Viên (SV)** | Trần Văn Thành | `thanh.tran@due.edu.vn` | Hồ sơ bị từ chối ở XOR 1 (Hộ khẩu Đà Nẵng) |
| **Tân Sinh Viên (SV)** | Phạm Thùy Linh | `linh.pham@due.edu.vn` | Hồ sơ nghi vấn đang chờ QLSV rà soát |
| **Cán bộ QLSV (`QLSV`)** | Trần Văn Bình | `qlsv.ktx@due.edu.vn` | Rà soát minh chứng đối chiếu side-by-side |
| **Cán bộ HC (`HC`)** | Nguyễn Thị Mai | `hanhchinh.ktx@due.edu.vn` | Quản lý danh sách & Giám sát hủy suất |
| **Trưởng ban KTX (`TB`)** | TS. Lê Đình Trọng | `truongban.ktx@due.edu.vn` | Dashboard duyệt 1-click & Quản lý chỉ tiêu |

---

## 4. HƯỚNG DẪN THIẾT LẬP CƠ SỞ DỮ LIỆU TRÊN SUPABASE (3 BƯỚC)

1. **Khởi tạo Schema & RLS Policies:**
   - Mở Supabase Dashboard $\rightarrow$ Chọn **SQL Editor** $\rightarrow$ Mở file [`supabase/schema.sql`](file:///C:/Users/Thanh%20Thao/QLQTKD/supabase/schema.sql) $\rightarrow$ Bấm **Run**.
2. **Cấu hình Storage Bucket bảo mật:**
   - Tạo Query mới trong SQL Editor $\rightarrow$ Mở file [`supabase/storage_setup.sql`](file:///C:/Users/Thanh%20Thao/QLQTKD/supabase/storage_setup.sql) $\rightarrow$ Bấm **Run**.
3. **Nạp Dữ liệu mẫu (Seed Data):**
   - Mở file [`supabase/seed.sql`](file:///C:/Users/Thanh%20Thao/QLQTKD/supabase/seed.sql) $\rightarrow$ Bấm **Run** để chèn toàn bộ tài khoản, phòng KTX và các ca kiểm thử.

---

## 5. KỊCH BẢN DEMO BẢO VỆ ĐỒ ÁN VỚI GIẢNG VIÊN (5 CA KIỂM THỬ)

### Ca 1: Cổng quyết định XOR 1 – Sàng lọc Hộ khẩu Đà Nẵng
* Vào Cổng Sinh viên (`/student`), nhập tỉnh thành là **"Đà Nẵng"**.
* **Kết quả quan sát:** Giao diện lập tức cảnh báo màu đỏ; khi bấm nộp, hệ thống trả về mã `TU_CHOI_BO_TRI` và kích hoạt gửi email thông báo từ chối tự động.

### Ca 2: Thẩm định AI Vision & Chặn ảnh lạ/meme
* Tải lên một ảnh phong cảnh hoặc ảnh meme không liên quan.
* **Kết quả quan sát:** Hệ thống nhận diện `is_valid_document = false`, gán điểm tin cậy $< 0.20$, tự động từ chối và yêu cầu sinh viên chụp lại giấy tờ hợp lệ trong 48h.

### Ca 3: Cán bộ QLSV rà soát ảnh nghi vấn (Side-by-side)
* Đăng nhập vai trò `QLSV` $\rightarrow$ Truy cập `/officer`.
* **Kết quả quan sát:** Ảnh gốc nằm bên trái, phân tích AI và cảnh báo con dấu mờ nằm bên phải. Cán bộ có thể bấm **"Duyệt Đạt"** hoặc **"Yêu Cầu Bổ Sung"**.

### Ca 4: Trưởng ban duyệt danh sách 1-Click (Cổng XOR 3)
* Đăng nhập vai trò `TB` $\rightarrow$ Truy cập `/director`.
* **Kết quả quan sát:** Thống kê 4 thẻ KPI; bấm **"✓ Phê Duyệt 1-Click (80%)"** để tự động khóa danh sách và kích hoạt gửi hàng loạt hợp đồng điện tử.

### Ca 5: Bảng xếp hạng Real-time WebSocket (F5-Free)
* Truy cập `/ranking`, bấm nút **"⚡ Test Đổi Điểm Realtime"**.
* **Kết quả quan sát:** Dòng dữ liệu tự động đổi vị trí thứ hạng và nhấp nháy màu xanh lá ngay lập tức mà không cần nhấn F5 tải lại trang.
