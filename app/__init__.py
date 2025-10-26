import os
from flask import Flask

def create_app():
    # Tạo và cấu hình ứng dụng
    app = Flask(__name__, instance_relative_config=True)
    
    # Cấu hình secret key để sử dụng flash messages
    # Sửa lỗi: Thêm dòng cấu hình SECRET_KEY
    app.config.from_mapping(
        SECRET_KEY='dev', # Cần thay đổi key này bằng một chuỗi ngẫu nhiên khi triển khai thực tế
    )

    # Đảm bảo thư mục instance tồn tại
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Đăng ký các Blueprints
    from .main import routes as main_routes
    app.register_blueprint(main_routes.bp)

    from .api import routes as api_routes
    app.register_blueprint(api_routes.bp, url_prefix='/api')

    # Đăng ký blueprint cho trang admin
    from .admin import routes as admin_routes
    app.register_blueprint(admin_routes.bp, url_prefix='/admin')

    return app
