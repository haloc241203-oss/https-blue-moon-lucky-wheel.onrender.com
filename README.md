# BLUE MOON — Vòng quay may mắn 20/10

Ứng dụng Node.js + Express + SQLite, sử dụng **hình vòng quay chính xác từ ảnh khách hàng cung cấp**. Vòng quay tách ảnh và quay thật; kết quả được lựa chọn bảo mật trên server.

## Cài đặt
1. Cài Node.js >=20 (phù hợp better-sqlite3).
2. `npm install`
3. Sao chép `.env.example` thành `.env`, thay `HASH_SECRET` và `ADMIN_KEY` bằng 2 chuỗi ngẫu nhiên khác nhau, dài ít nhất 24 ký tự. Ví dụ `openssl rand -hex 32`.
4. `npm start`
5. Trang khách: `http://localhost:3000`, quản trị: `http://localhost:3000/admin.html`.

## Cấu hình và hình ảnh
- 10 ô theo ảnh từ đỉnh, theo chiều kim đồng hồ: bánh sừng bò, hồng trà sữa, kem Aice, voucher 10%, voucher 100K, bánh sừng bò, hồng trà sữa, kem Aice, voucher 10%, voucher 100K.
- Tỷ lệ mặc định tương ứng: `0,0,10,30,10,0,0,10,30,10` (tổng 100%). **Các ô 0% vẫn hiện nhưng sẽ không bao giờ trúng.** Cần làm rõ điều này trong thể lệ công khai hoặc thay tỷ lệ.
- Đăng nhập quản trị bằng ADMIN_KEY để sửa xác suất (10 ô tổng 100%), xuất CSV, xem thống kê và đối soát đổi quà.
- Mỗi Gmail HOẶC số điện thoại chỉ được dùng một lần. Kiểm tra tại cơ sở dữ liệu bằng UNIQUE và transaction; cùng một cặp nhập lại vẫn bị chặn.
- Ảnh đã dùng là file poster người dùng cung cấp; không xác minh được chi tiết mới nhất của fanpage Facebook do quyền truy cập. Brand header link trực tiếp đến fanpage.

## Quan trọng trước khi đưa lên Internet
- Website đang ở mức **bản triển khai thử nghiệm nâng cao**, không phải hệ thống production đã kiểm thử tải/bảo mật độc lập.
- Cần HTTPS, reverse proxy, backup SQLite, rate limit chia sẻ giữa instances, giám sát, firewall/WAF, CAPTCHA/OTP nếu cần ngăn một người đăng ký nhiều Gmail/SĐT.
- Chỉ kiểm tra đúng cú pháp Gmail/SĐT, **chưa xác minh quyền sở hữu**. Không đảm bảo 1 người = 1 lượt.
- Có thể nhấn quay nhiều lần khác trình duyệt với thông tin mới. Dữ liệu khách hàng là dữ liệu cá nhân: công bố chính sách sử dụng, thời hạn lưu/xóa, điều kiện đổi quà và bảo vệ ADMIN_KEY.
- Thao tác quay được ghi nhận trước khi hoạt ảnh hoàn tất. Khách bị mất mạng sau khi server ghi vẫn không thể quay lại bằng cùng thông tin: cần quy trình CSKH đối chiếu trong quản trị.
- Tỷ lệ cần công khai nếu thể lệ khuyến mãi yêu cầu. Bốn ô 0% không được quảng bá là giải có cơ hội trúng.
- Cần kiểm tra thể lệ khuyến mãi với quy định pháp luật phù hợp trước khi triển khai.


## Cập nhật cơ cấu quà ban đầu (10 ô)

Vòng quay sử dụng `public/wheel-original-10.svg`, giữ tông hồng – vàng của poster 20/10. Các ô đi theo chiều kim đồng hồ từ 12 giờ: chúc may mắn (0%), 500.000đ tiền mặt (0%), bánh ngọt (0%), voucher 10% (30%), voucher 100k (10%), kem Aice (10%), bánh ngọt (0%), voucher 10% (30%), voucher 100k (10%), kem Aice (10%).

**Quan trọng:** Những ô 0% chỉ mang tính hiển thị và không thể trúng. Nên công khai rõ xác suất hoặc điều chỉnh trước khi phát hành chương trình thực tế.

Nếu dùng lại database từ bản website trước, bảng `wheel_config` có thể giữ các trọng số đã thiết lập trước đó. Vào trang quản trị đặt lại các trọng số theo thứ tự: `0, 0, 0, 30, 10, 10, 0, 30, 10, 10`. Không xóa dữ liệu lượt quay cũ vì có thể cần đối soát khách.


## Giao diện cập nhật
Khách nhập Gmail và điện thoại, chọn xác nhận: website chuyển thẳng sang màn hình vòng quay với nút quay lớn. Server cấp lượt và kết quả ngay khi xác nhận; khách bấm quay để xem hiệu ứng và mã đổi quà. Nếu tải lại trang trước khi bấm quay trên cùng tab, phiên làm việc sẽ khôi phục lượt chưa hiển thị; không dùng được trên tab/thiết bị khác. Bản DEMO-CHAY-THU.html chạy độc lập nhưng không lưu thông tin và không có giá trị đổi quà.


## Font Phudu và dữ liệu khách hàng

Trang web dùng **Phudu** qua Google Fonts CDN; không đóng gói hoặc chuyển tiếp file font gốc do người dùng cung cấp. Khi mở website offline font sẽ tự thay bằng Arial.

Trang quản trị `/admin.html` có bảng Gmail, điện thoại, quà trúng, tình trạng đổi quà và nút xuất CSV. Thiết lập `ADMIN_KEY` đủ mạnh, KHÔNG cho người lạ biết khóa này. Chỉ sử dụng HTTPS khi lên Internet.

**Lưu ý triển khai:** SQLite cần thư mục ổ đĩa lưu trữ BỀN VỮNG. Không triển khai bản này nguyên trạng lên dịch vụ serverless có ổ đĩa tạm. Render/Railway/VPS có persistent disk là lựa chọn phù hợp; bảo đảm có lịch sao lưu `data/spins.sqlite`, tường lửa, HTTPS và giới hạn truy cập quản trị. Hãy đánh giá lại thể lệ hiển thị các giải 0% trước khi mời khách.
