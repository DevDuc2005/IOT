# Cập nhật Tổng quan gọn một màn hình — 30/10/2026

Nếu đang dùng bản sửa hồ sơ và lỗi next trước đó, chỉ thay hai file:
1. frontend/src/App.tsx
2. frontend/src/style.css

Giữ nguyên Features.tsx, backend, database, .env và firmware đang chạy. Sau khi lưu, khởi động lại frontend hoặc tải lại trang (Ctrl+F5). Không cần chạy cập nhật cơ sở dữ liệu cho thay đổi này.

Đã bỏ các trang/menu Điều khiển thiết bị, MQTT Terminal và Cài đặt hệ thống. Menu còn Tổng quan, Giám sát cảm biến, Lịch sử hoạt động, Hồ sơ cá nhân. MQTT vẫn chạy trong backend để nhận cảm biến và điều khiển LED.

Tổng quan chỉ có ba thẻ Nhiệt độ/Độ ẩm/Ánh sáng, biểu đồ ba tab và Điều khiển nhanh (ba công tắc, bật/tắt tất cả). Đã bỏ Hoạt động gần đây, tiêu đề lớn và footer riêng của Tổng quan. Thanh điều hướng trên và menu bên trái vẫn còn.

Bố cục desktop (chiều rộng trên 900 px) dùng chiều cao cửa sổ 100dvh, chia hàng và cột co giãn để vừa một màn hình. Không dùng overflow:hidden để che mất nội dung. Trên điện thoại/màn hình hẹp, các khối xếp dọc và vẫn cho cuộn để thao tác được.

Kiểm tra đã đạt: parse/transpile TSX, bốn mục menu, ba thẻ cảm biến, ba điều khiển LED, không còn khối lịch sử/tiêu đề/footer trên Tổng quan; năm thao tác điều khiển vẫn gọi đúng lệnh. Chưa chạy được kiểm thử trình duyệt/đo kích thước thực tế vì môi trường không có Chromium; chưa xác minh build TypeScript/Vite đầy đủ.

Các ghi chú bên dưới là lịch sử các bản cập nhật trước; phần thay đổi giao diện nêu trên thay thế mô tả cũ về menu Terminal/Điều khiển/Cài đặt.

---

# Sửa lỗi `next is not a function`

Nếu đã dùng bản cập nhật hồ sơ trước đó, chỉ cần thay file `backend/src/accounts.js` bằng file trong ZIP này, dừng backend và chạy lại. Không cần đổi database, .env hay firmware cho bản vá này. Sau đó tải lại trang web.

Nguyên nhân: hàm wrap gọi fn(req,res) mà không truyền next cho middleware xác thực. Bản sửa truyền đủ req,res,next và chuyển cả lỗi đồng bộ/bất đồng bộ tới bộ xử lý lỗi. Đã chạy đạt 5 kiểm thử hồi quy, bao gồm tái hiện lỗi cũ, xác thực thành công, trả 401 khi chưa đăng nhập và chuyển tiếp lỗi.

---

# Bổ sung Hồ sơ cá nhân — ảnh đại diện và mật khẩu

Bản này bổ sung chọn/xóa ảnh đại diện, họ tên, tên tài khoản đăng nhập và đổi mật khẩu. Đăng nhập, tạo tài khoản và cả ba ô đổi mật khẩu đều có nút con mắt hiện/ẩn riêng.

- Vào Hồ sơ cá nhân → Chỉnh sửa hồ sơ để chọn ảnh, sửa họ tên/tài khoản/email rồi bấm Lưu thay đổi. Hủy sẽ bỏ các thay đổi chưa lưu.
- Ảnh JPG/PNG/WebP tối đa 5 MB được cắt vuông ở giữa và thu về 256×256 trước khi lưu. Ảnh hiển thị ở hồ sơ và góc trên giao diện.
- Tên tài khoản gồm 3–40 ký tự không dấu: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang; được lưu bằng chữ thường. Có thể đăng nhập bằng tên tài khoản hoặc email. Tài khoản cũ vẫn dùng email; tên tài khoản mới là tùy chọn.
- Đổi mật khẩu cần mật khẩu hiện tại, mật khẩu mới và xác nhận khớp nhau. Mật khẩu mới 8–128 ký tự, khác mật khẩu cũ. Sau khi đổi thành công, các phiên của tài khoản được đăng xuất, bao gồm kết nối cập nhật thời gian thực; đăng nhập lại bằng mật khẩu mới.
- Chép các file mã nguồn cập nhật và schema.prisma theo hướng dẫn bên dưới, giữ database/.env cũ. Chạy lại CHAY_BACKEND.bat để thêm username và avatar vào bảng User, rồi CHAY_WEB.bat.

Kiểm tra bổ sung: cú pháp backend và transpile TSX đạt; kiểm tra băm mật khẩu/định dạng ảnh đạt; nút con mắt chuyển ẩn → hiện → ẩn và giữ giá trị; luồng đổi mật khẩu đã được kiểm tra với dữ liệu lưu trữ giả lập (mật khẩu cũ sai, xác nhận sai, cập nhật thành công và thu hồi phiên). Chưa chạy build TypeScript/Vite đầy đủ hoặc kiểm thử tích hợp Prisma/trình duyệt do thiếu thư viện npm trong môi trường này.

---

# IoT Light Blue — bản cập nhật giao diện

Giao diện nền xanh rất nhạt, thẻ trắng, viền xanh nhạt và điểm nhấn cyan theo ảnh tham khảo.

## Cập nhật dự án đang chạy

1. Dừng backend và frontend cũ; sao lưu thư mục dự án cũ trước khi chép bản mới.
2. Chép `frontend/src`, `backend/src`, `backend/prisma/schema.prisma`, hai file package.json và hai file CHAY_*.bat từ bản mới vào dự án cũ. Giữ nguyên `backend/.env`, cơ sở dữ liệu SQLite, cấu hình Wi-Fi và firmware bạn đã chỉnh riêng. Không chép đè toàn bộ thư mục prisma làm mất file database.
3. Chạy `CHAY_BACKEND.bat`. Script cài thư viện, sao lưu database theo DATABASE_URL, tạo Prisma Client và bổ sung bảng User, cột user cùng các chỉ mục. Không dùng --accept-data-loss. Nếu Prisma báo thay đổi mất dữ liệu, dừng và xem lại cấu hình thay vì xóa database.
4. Chạy `CHAY_WEB.bat`, mở http://localhost:5173. Script chạy kiểm tra build trước khi mở web.
5. Lần đầu tạo tài khoản quản trị bằng tên/email/mật khẩu của bạn. Thông tin Profile và liên kết dự án được lưu vào database.

Cài mới: giải nén và chạy hai file BAT. `.env.example` dùng chế độ REAL, MQTT `192.168.38.226:1884`; điều chỉnh địa chỉ theo máy broker thực tế. Để thử giao diện không cần ESP32, đổi `DEMO_MODE=true` trong backend/.env rồi khởi động lại backend.

## Những phần đã thay đổi

- Dashboard: ba thẻ cảm biến, ba tab biểu đồ (10 điểm cuối), công tắc riêng từng LED, số đèn đang bật. Vị trí Phòng khách / Phòng ngủ / Nhà bếp là nhãn mẫu có thể đổi trong App.tsx.
- Data Sensor: bộ lọc loại cảm biến, giá trị, thời gian; bảng mỗi loại cảm biến là một dòng; phân trang trên toàn bộ database. Mỗi lần lấy mẫu tạo ba giá trị nên tổng hiển thị là số giá trị, không phải số gói MQTT. ID kết hợp ID lần đo và loại cảm biến để không trùng nhau.
- History: lọc LED, hành động, trạng thái và thời gian; ID, người thao tác, nguồn, phân trang, CSV trang hiện tại.
- Tìm thời gian: `dd/mm/yyyy hh/mm/ss`, ví dụ `28/10/2026 16/40/38`; đúng giờ Việt Nam UTC+7. Tìm một giây bao gồm mili giây 000–999. Bỏ trống là không lọc thời gian. Không chấp nhận ngày thiếu hoặc ngày không tồn tại.
- Thời gian trong bảng, sao chép và CSV đều dùng cùng định dạng. Trong mạng LAN HTTP, trình duyệt có thể không cho sao chép bằng nút; khi đó chọn văn bản và sao chép thủ công.
- Profile: xem/sửa họ tên, email, điện thoại, GitHub, Figma, sơ đồ hệ thống. Không sử dụng thông tin cá nhân giả từ ảnh mẫu. Vai trò quản trị không sửa từ giao diện.
- Đăng nhập/đăng xuất: mật khẩu băm scrypt, cookie HttpOnly, phiên 24 giờ trong bộ nhớ; backend khởi động lại sẽ yêu cầu đăng nhập lại. Phiên bản này tạo một tài khoản quản trị đầu tiên, chưa có quản lý nhiều tài khoản hoặc quên mật khẩu.
- Giữ MQTT Terminal, trang điều khiển riêng, bật/tắt tất cả và cài đặt.
- GPIO hiển thị/firmware mẫu: DHT11=7, ánh sáng=4, LED1=10, LED2=1, LED3=12. Firmware mẫu kèm theo dùng MQTT cổng 1884.

## Dữ liệu thiết bị và lịch sử

Cảm biến ánh sáng hiện tại chỉ gửi DO (SÁNG/TỐI), chưa đo lux. Tab ánh sáng thể hiện SÁNG=1 / TỐI=0, không phải lux. Muốn hiển thị lux cần bổ sung cảm biến/dữ liệu đo và sửa firmware/backend tương ứng.

Lệnh MQTT cũ không có mã yêu cầu (request ID). Vì vậy lịch sử phân biệt:
- WEB: yêu cầu của tài khoản đăng nhập, từ PENDING chuyển sang STATE_CONFIRMED (đã nhận trạng thái), TIMEOUT hoặc ERROR. STATE_CONFIRMED không chứng minh riêng lệnh đó đã được thực thi.
- ESP32: sự kiện do thiết bị gửi, có thể không xác định người thao tác. Một lệnh WEB và một báo cáo ESP32 là hai bản ghi có nguồn khác nhau, không gán người dùng suy đoán cho bản ghi ESP32.
- DEMO: sự kiện mô phỏng kèm người thao tác.

Trạng thái phản hồi MQTT retained không được dùng để hoàn tất lệnh đang chờ. Hệ thống hiện không có cảm biến xác nhận LED có phát sáng vật lý.

## Kiểm tra

Đã chạy đạt 4 nhóm kiểm thử Node cho múi giờ UTC+7, khoảng một giây, ranh giới ngày/năm, ngày nhuận, đầu vào sai và phân trang. Các file backend đã qua `node --check`. Ba file TSX đã qua kiểm tra parse/transpile bằng Babel; hàm định dạng thời gian frontend đạt kiểm tra. Đã chạy 8 tình huống truy vấn của route dữ liệu cảm biến trên SQLite, gồm lọc kết hợp loại/giá trị/thời gian, phân trang, nhập sai và xử lý dữ liệu lux chưa hỗ trợ. Đây chưa phải kiểm thử tích hợp Express/Prisma đầy đủ.

Môi trường tạo bản này không tải được các gói npm (registry trả HTTP 403), nên chưa chạy được TypeScript/Vite build, Prisma integration hoặc kiểm tra giao diện trên trình duyệt và thiết bị thực. `CHAY_WEB.bat` sẽ chạy build trên máy bạn; nếu có lỗi, giữ nguyên thông báo để đối chiếu.

Lệnh kiểm tra riêng: `cd backend` rồi `node --test src/time.test.js`.
