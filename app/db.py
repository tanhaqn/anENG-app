import psycopg2
import psycopg2.extras # Dùng để lấy data dạng dictionary
import os

def get_db_connection():
    """Hàm dùng chung để lấy kết nối database PostgreSQL từ Render."""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise Exception("DATABASE_URL không được tìm thấy trong biến môi trường.")
        
    conn = psycopg2.connect(db_url)
    return conn