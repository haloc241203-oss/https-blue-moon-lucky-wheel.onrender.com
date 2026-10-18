# BLUE MOON — Triển khai Render Cloud

## 1. Đăng mã nguồn lên GitHub
- Tạo repository **Private** mới trên https://github.com/new
- Giải nén dự án, upload toàn bộ nội dung trong thư mục (bao gồm `render.yaml`, thư mục `public`, `server.js`, `package.json`) vào gốc repo.
- Tuyệt đối **không upload `.env`, `node_modules` hay dữ liệu SQLite**.

## 2. Tạo máy chủ Render
- Đăng nhập https://dashboard.render.com
- Chọn **New > Blueprint**, kết nối GitHub, chọn repository trên.
- Xem các tài nguyên Render sẽ tạo: **Web Service gói có phí** + **persistent disk**. Kiểm tra giá hiển thị trước khi chấp thuận.
- Render sẽ dùng `render.yaml`, tạo `ADMIN_KEY`, `HASH_SECRET` ngẫu nhiên, đặt DB_PATH=/var/data/spins.sqlite.
- Chờ trạng thái Live. Kiểm tra `https://<service>.onrender.com/healthz` trả về `{"ok":true}`.

## 3. Sử dụng
- Khách: `https://<service>.onrender.com/`
- Quản trị: `https://<service>.onrender.com/admin.html`
- Lấy `ADMIN_KEY` từ Render Dashboard > service > Environment (không chia sẻ key này).
- Lưu mã quản trị ở trình quản lý mật khẩu; đừng đưa vào poster/QR khách.
- Test quay thử và xuất CSV, sau đó xóa kết quả test bằng thao tác quản trị CÓ KIỂM SOÁT trước khi mở cho khách (dự án chưa có chức năng xóa an toàn tự phục vụ).

## 4. Cần hoàn thiện trước khi dùng thật
- Backup SQLite ngoài Render thường xuyên; không chỉ dựa snapshot của ổ đĩa.
- Thêm OTP/CAPTCHA nếu muốn chống việc tạo nhiều Gmail và số điện thoại.
- Cơ chế khôi phục lượt quay khi mất mạng; chính sách bảo vệ dữ liệu và thời hạn lưu.
- Tăng cường xác thực quản trị; ADMIN_KEY hiện là shared secret, chưa có tài khoản riêng/2FA.
- Giải 500k, bánh, chúc may mắn hiện 0%: phải thông tin minh bạch/thay đổi cơ cấu trước khi quảng bá.
- Kiểm tra pháp lý thể lệ khuyến mãi, chạy thử nhiều máy trước khi phát QR.

## Chỉnh tên miền
Settings > Custom Domains > Add, tạo DNS record đúng theo hướng dẫn Render. Chờ Verified/Issued; chứng chỉ TLS tự cấp.
