# Vip-15s

Ứng dụng web gồm giao diện React/Vite, API Node.js và dịch vụ lưu trữ riêng.

## Yêu cầu

- Node.js 20 trở lên
- npm
- Firebase project
- Dịch vụ object storage tương thích S3 (nếu dùng chức năng tải tệp)

## Cài đặt

```bash
npm install
npm --prefix apps/main/api install
npm --prefix apps/main/client install
npm --prefix apps/main/storage install
```

Tạo các file cấu hình cục bộ từ mẫu:

```bash
cp apps/main/api/.env.example apps/main/api/.env
cp apps/main/client/.env.example apps/main/client/.env.local
cp apps/main/storage/.env.example apps/main/storage/.env
```

Thay toàn bộ placeholder trong các file vừa tạo bằng thông tin của môi trường riêng. Không commit `.env`, token, private key hoặc log vận hành.

## Chạy dự án

Giao diện:

```bash
npm run dev
```

API:

```bash
npm --prefix apps/main/api run dev
```

Dịch vụ lưu trữ:

```bash
npm --prefix apps/main/storage start
```

## Kiểm tra

```bash
npm test
npm run lint
npm run build
```

## Cấu trúc chính

- `apps/main/client`: giao diện chính.
- `apps/main/api`: REST API và Socket.IO.
- `apps/main/storage`: dịch vụ tải tệp/object storage.
- `apps/main/web`: giao diện cũ, được giữ để tham khảo và chuyển đổi dần.

Xem từng file `.env.example` để biết các biến bắt buộc và tuỳ chọn.

## Triển khai

Xem [hướng dẫn Railway, Vercel và Cloudflare R2](./docs/DEPLOY_RAILWAY.md).

## Bảo mật khi bàn giao

- Tạo secret mới cho từng môi trường.
- Chỉ dùng biến `VITE_*` cho dữ liệu có thể công khai trên trình duyệt.
- Thu hồi token cũ nếu chúng từng xuất hiện trong repository hoặc log.
- Giới hạn `CORS_ORIGINS` bằng danh sách domain do bạn quản lý, phân cách bằng dấu phẩy.

## Giấy phép

Xem [LICENSE](./LICENSE).
