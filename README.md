# IoT Light Blue Dashboard

React + TypeScript + Vite, Node.js + Express + Prisma/SQLite, MQTT + ESP32-C6.

Đọc **HUONG_DAN_CAP_NHAT.md** trước khi cập nhật dự án hiện có. File này mô tả đầy đủ cách giữ cấu hình và dữ liệu, tạo tài khoản, chế độ REAL/DEMO, định dạng tìm kiếm thời gian và giới hạn kiểm thử.

Chạy `CHAY_BACKEND.bat` và `CHAY_WEB.bat`, mở http://localhost:5173.

Firmware mẫu: `firmware/esp32_c6_iot.ino`; các thư viện Arduino cần cài: PubSubClient và DHT sensor library (cùng Adafruit Unified Sensor). Điền Wi-Fi/broker đúng mạng đang sử dụng trước khi nạp.
