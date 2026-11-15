# Main applications

Thư mục này chứa các thành phần chạy độc lập:

- `client`: giao diện React/Vite đang được dùng bởi các lệnh ở repository gốc.
- `api`: API Node.js, Socket.IO và các tác vụ nền.
- `storage`: dịch vụ lưu trữ và tạo URL tải lên.
- `web`: giao diện cũ để tham khảo trong quá trình chuyển đổi.

Mỗi thành phần có `package.json` và `.env.example` riêng. Hãy sao chép file mẫu thành file `.env` cục bộ, thay placeholder bằng cấu hình của môi trường, sau đó chạy lệnh npm trong đúng thư mục.

Không đưa token, private key, mật khẩu, log hoặc file `.env` thật vào source control.
