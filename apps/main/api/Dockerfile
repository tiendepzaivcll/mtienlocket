# Locket.io.vn main API
FROM node:20-slim

# Tạo thư mục làm việc trong container
WORKDIR /app

# Cài đặt dependencies (chỉ production)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy toàn bộ source code vào container
COPY . .

# Biến môi trường mặc định, có thể override từ docker-compose
ENV NODE_ENV=production

# API mặc định dùng cổng 5000; Railway có thể ghi đè qua biến PORT.
EXPOSE 5000

# Chạy ứng dụng Express
CMD ["node", "app.js"]
