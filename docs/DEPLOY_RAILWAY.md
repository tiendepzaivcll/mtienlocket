# Đưa dự án lên mạng

GitHub lưu source. Để dùng được đăng nhập và tải ảnh/video, cần triển khai giao diện,
API và dịch vụ storage, sau đó kết nối chúng bằng biến môi trường.

## 1. Chuẩn bị Cloudflare R2

1. Mở Cloudflare Dashboard → R2 Object Storage → Overview. Nếu tài khoản chưa bật R2,
   hoàn tất bước kích hoạt trên Cloudflare trước.
2. Create bucket, ví dụ đặt tên `mtienlocket-media`.
3. Trong Settings của bucket, bật Public Development URL để thử nghiệm hoặc kết nối
   custom domain cho môi trường chính thức. URL này sẽ là `MEDIA_API_URL`.
4. Tạo R2 API token với quyền **Object Read & Write**, giới hạn vào bucket vừa tạo.
   Lưu Access Key ID, Secret Access Key và S3 API endpoint do Cloudflare cung cấp.
5. Cấu hình CORS của bucket sau khi có domain giao diện:

```json
[
  {
    "AllowedOrigins": ["https://TEN-WEB.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Thay `https://TEN-WEB.vercel.app` bằng origin giao diện thực tế. CORS trên bucket R2
và `CORS_ORIGINS` trên các service là hai cấu hình riêng, cần đặt cả hai.

## 2. Storage trên Railway

Tạo service từ repository, đặt **Root Directory** là `/apps/main/storage`.
Start command là `npm start`; Railway cấp `PORT`.

Điền vào tab Variables của **service storage**:

| Biến | Giá trị |
| --- | --- |
| `R2_ENDPOINT` | S3 API endpoint do Cloudflare cung cấp |
| `R2_ACCESS_KEY` | Access Key ID của R2 token |
| `R2_SECRET_KEY` | Secret Access Key của R2 token |
| `R2_BUCKET` | Tên bucket, ví dụ `mtienlocket-media` |
| `MEDIA_API_URL` | URL HTTPS công khai của bucket/custom domain, không phải S3 endpoint |
| `CORS_ORIGINS` | Origin giao diện, ví dụ `https://TEN-WEB.vercel.app` |
| `FIREBASE_AUTH_PROJECT_ID` | Firebase project phát hành ID token đăng nhập thực tế |
| `STORAGE_INTERNAL_TOKEN` | Chuỗi bí mật ngẫu nhiên dài, dùng chung với service API |

Không đặt khóa R2 hay `STORAGE_INTERNAL_TOKEN` vào biến `VITE_*`, GitHub hoặc file mẫu.
`CLEANER_KEY_ID` chỉ cần nếu bật endpoint tự dọn tệp theo lịch.

Sau khi service chạy, Settings → Networking → Generate Domain. Lưu URL HTTPS của
service storage; API và frontend sẽ dùng URL này.

## 3. API trên Railway

Tạo service riêng từ cùng repository, **Root Directory** là `/apps/main/api`.
Dockerfile đã có sẵn; start command là `node app.js`. Railway cấp `PORT`.

Nhóm biến để API khởi động ở production:

- `NODE_ENV=production`
- `FIREBASE_API_KEY`: API key của Firebase project mà luồng đăng nhập thực tế sử dụng.
- `FIREBASE_AUTH_API_BASE=https://www.googleapis.com/identitytoolkit/v3/relyingparty`
- `FIREBASE_SECURETOKEN_API_BASE=https://securetoken.googleapis.com/v1`
- `LOCKET_API_BASE`: base URL thật của API upstream, lấy từ cấu hình hợp lệ của hệ thống.

Các biến để quản trị và kết nối dịch vụ:

- `ADMIN_PASSWORD`: mật khẩu quản trị riêng.
- `ADMIN_JWT_SECRET`: bí mật ngẫu nhiên riêng cho phiên quản trị.
- `CORS_ORIGINS`: origin giao diện.
- `STORAGE_API_URL`: URL HTTPS service storage.
- `STORAGE_INTERNAL_TOKEN`: cùng giá trị đã đặt ở service storage.
- `API_BASE_URL`: URL HTTPS của chính service API sau khi Generate Domain.

Xem `apps/main/api/.env.example` cho các cấu hình bổ sung. Nếu dùng lưu cấu hình
quản trị/App Check bằng Firestore, cần cấu hình tài khoản dịch vụ Firebase tương ứng.
Giá trị App Check hợp lệ có thể được bổ sung qua trang quản trị sau khi khởi động.

**Không tự tạo Firebase project khác rồi cho rằng tài khoản Locket cũ sẽ đăng nhập
được.** API key, project phát hành ID token, API upstream và App Check phải khớp với
luồng đăng nhập đang sử dụng. Nếu source được bàn giao thiếu các cấu hình này,
cần lấy thông tin từ bên cung cấp source.

## 4. Giao diện trên Vercel

Import cùng repository vào Vercel, chọn framework Vite và **Root Directory** là
`apps/main/client`. Build command: `npm run build`; output: `dist`.

Đặt các biến sau trước khi build:

- `VITE_BASE_API_URL`, `VITE_BETA_API_URL`, `VITE_AUTH_API_URL`,
  `VITE_DATA_API_URL`, `VITE_PAYMENT_API_URL`: URL HTTPS service API của bạn.
- `VITE_STORAGE_API_URL`: URL HTTPS service storage của bạn.
- Các biến Firebase trình duyệt và dịch vụ bổ sung theo `.env.production.example`,
  chỉ dùng thông tin công khai dành cho frontend.

Biến `VITE_*` được đóng vào bản build; đổi giá trị cần build/deploy lại frontend.
Sau khi có domain frontend, cập nhật `CORS_ORIGINS` ở API/storage và CORS của bucket.

## 5. Kiểm tra thực tế

`Online` chỉ cho biết tiến trình đang chạy. Sau khi cấu hình đủ, kiểm tra:

1. API `/health` và nhật ký không báo thiếu cấu hình.
2. Đăng nhập bằng tài khoản thử nghiệm của bạn.
3. Upload ảnh nhỏ: lấy presigned URL, PUT lên R2, rồi đọc được URL ảnh công khai.
4. Các request không có quyền tới endpoint xóa tệp bị từ chối.

Không dùng nguyên giá trị `change-me`, `your-*` hoặc domain `example.com` trong production.
