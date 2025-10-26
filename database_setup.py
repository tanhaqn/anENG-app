import sqlite3
import os

def setup_database():
    """
    Tạo cơ sở dữ liệu và các bảng cần thiết (collections, topics, words)
    với đầy đủ các cột, bao gồm cả cột is_visible cho collections.
    """
    instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
    if not os.path.exists(instance_path):
        print(f"Tạo thư mục instance tại: {instance_path}")
        os.makedirs(instance_path)

    db_name = 'instance/vocabulary.db'
    conn = None
    try:
        conn = sqlite3.connect(db_name)
        cursor = conn.cursor()

        print("Đang tạo bảng...")
        cursor.execute('DROP TABLE IF EXISTS words')
        cursor.execute('DROP TABLE IF EXISTS topics')
        cursor.execute('DROP TABLE IF EXISTS collections')

        # Bảng mới để quản lý các bộ sưu tập
        # is_visible: 1 = Hiển thị, 0 = Ẩn
        cursor.execute('''
        CREATE TABLE collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_visible INTEGER NOT NULL DEFAULT 1
        )
        ''')

        # Thêm collection_id làm khóa ngoại và ON DELETE CASCADE
        cursor.execute('''
        CREATE TABLE topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            position INTEGER,
            collection_id INTEGER NOT NULL,
            FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
        )
        ''')

        # Thêm ON DELETE CASCADE để tự động xóa các từ khi chủ đề bị xóa
        cursor.execute('''
        CREATE TABLE words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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

        cursor.execute('''
        CREATE TABLE user_word_data (
            word_id INTEGER PRIMARY KEY,
            srs_level INTEGER NOT NULL DEFAULT 0,
            next_review_at TIMESTAMP,
            is_favorite INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (word_id) REFERENCES words (id) ON DELETE CASCADE
        )
        ''')
        
        conn.commit()
        print("Các bảng 'collections', 'topics', và 'words', 'user_word_data' đã được tạo thành công.")
        print(f"Cơ sở dữ liệu '{db_name}' đã sẵn sàng.")

    except sqlite3.Error as e:
        print(f"Đã xảy ra lỗi khi thiết lập cơ sở dữ liệu: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    setup_database()
