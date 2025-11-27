# Sử dụng một image Python chính thức làm base image
FROM python:3.9-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép file requirements và cài đặt các thư viện
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

# Sao chép toàn bộ code của bạn vào thư mục làm việc
COPY . .

# ✅ ĐÚNG (Dùng shell sh để dịch biến)
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT run:app"]