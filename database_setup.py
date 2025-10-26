import psycopg2
import os
import sys

def get_db_connection():
    """Lấy kết nối đến database từ biến môi trường."""
    # Lấy URL database từ biến môi trường mà Render cung cấp
    db_url = os.environ.get('DATABASE_URL')
    
    if not db_url:
        print("Lỗi: Biến môi trường DATABASE_URL chưa được thiết lập.", file=sys.stderr)
        return None
    
    try:
        # Kết nối đến database PostgreSQL
        conn = psycopg2.connect(db_url)
        return conn
    except psycopg2.OperationalError as e:
        print(f"Lỗi khi kết nối đến PostgreSQL: {e}", file=sys.stderr)
        return None

def setup_database():
    """
    Tạo các bảng (collections, topics, words, user_word_data) 
    trên database PostgreSQL.
    """
    conn = get_db_connection()
    if conn is None:
        print("Không thể kết nối đến database. Hủy bỏ cài đặt.", file=sys.stderr)
        return

    cursor = None # Khởi tạo cursor bên ngoài để có thể đóng trong finally
    try:
        cursor = conn.cursor()
        print("Đang tạo bảng trên PostgreSQL...")
        
        # Xóa bảng cũ nếu tồn tại (để bạn có thể chạy lại file này nếu cần)
        cursor.execute('DROP TABLE IF EXISTS user_word_data;')
        cursor.execute('DROP TABLE IF EXISTS words;')
        cursor.execute('DROP TABLE IF EXISTS topics;')
        cursor.execute('DROP TABLE IF EXISTS collections;')

        # Bảng collections
        # SERIAL PRIMARY KEY là tương đương với AUTOINCREMENT trong PostgreSQL
        cursor.execute('''
        CREATE TABLE collections (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_visible INTEGER NOT NULL DEFAULT 1
        )
        ''')
        print("Tạo bảng 'collections' thành công.")

        # Bảng topics
        cursor.execute('''
        CREATE TABLE topics (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            position INTEGER,
            collection_id INTEGER NOT NULL,
            FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
        )
        ''')
        print("Tạo bảng 'topics' thành công.")

        # Bảng words
        cursor.execute('''
        CREATE TABLE words (
            id SERIAL PRIMARY KEY,
            topic_id INTEGER NOT NULL,
            word TEXT NOT NULL,
            ipa TEXT,
            type TEXT,
            meaning TEXT NOT NULL,
            example TEXT,
            position INTEGER,
            FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
        )
        ''')
        print("Tạo bảng 'words' thành công.")

        # Bảng user_word_data
        cursor.execute('''
        CREATE TABLE user_word_data (
            word_id INTEGER PRIMARY KEY,
            srs_level INTEGER NOT NULL DEFAULT 0,
            next_review_at TIMESTAMP,
            is_favorite INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (word_id) REFERENCES words (id) ON DELETE CASCADE
        )
        ''')
        print("Tạo bảng 'user_word_data' thành công.")
        
        # Commit tất cả thay đổi vào database
        conn.commit()
        print("Tất cả các bảng đã được tạo thành công trên PostgreSQL!")

    except (Exception, psycopg2.DatabaseError) as e:
        print(f"Đã xảy ra lỗi khi thiết lập cơ sở dữ liệu: {e}", file=sys.stderr)
        if conn:
            conn.rollback() # Hoàn tác nếu có lỗi
    finally:
        # Luôn đóng cursor và connection
        if cursor:
            cursor.close()
        if conn:
            conn.close()
            print("Đã đóng kết nối database.")

if __name__ == '__main__':
    print("Bắt đầu chạy setup_database...")
    setup_database()
    print("Kết thúc setup_database.")