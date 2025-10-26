# Sử dụng một image Python chính thức làm base image
FROM python:3.9-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép file requirements và cài đặt các thư viện
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

# Sao chép toàn bộ code của bạn vào thư mục làm việc
COPY . .

# Dùng Gunicorn để chạy ứng dụng web, trỏ đúng vào file run.py
# Cổng (port) sẽ được Cloud Run tự động cung cấp qua biến môi trường $PORT
CMD ["gunicorn", "--bind", "0.0.0.0:$PORT", "run:app"]