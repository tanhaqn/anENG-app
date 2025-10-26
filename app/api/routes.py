import psycopg2 # Bỏ sqlite3
import psycopg2.extras # Thư viện quan trọng
from flask import Blueprint, jsonify, current_app, request
from deep_translator import GoogleTranslator
from datetime import datetime, timedelta
from app.db import get_db_connection

# Blueprint này vẫn đúng
bp = Blueprint('api', __name__, url_prefix='/api')

# XÓA hàm get_db_connection() cũ dùng sqlite3


@bp.route('/data')
def get_all_data():
    """
    API endpoint để lấy tất cả dữ liệu từ POSTGRESQL.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        # Dùng RealDictCursor để lấy kết quả dạng dictionary (giống JSON)
        # Đây là thay thế cho conn.row_factory = sqlite3.Row
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) 
        
        cursor.execute('SELECT * FROM collections WHERE is_visible = 1 ORDER BY name')
        collections = cursor.fetchall()
        
        cursor.execute('''
            SELECT t.* FROM topics t
            JOIN collections c ON t.collection_id = c.id
            WHERE c.is_visible = 1
            ORDER BY t.collection_id, t.position, t.id
        ''')
        topics = cursor.fetchall()
        
        cursor.execute('''
            SELECT w.* FROM words w
            JOIN topics t ON w.topic_id = t.id
            JOIN collections c ON t.collection_id = c.id
            WHERE c.is_visible = 1
            ORDER BY t.id, w.position, w.id
        ''')
        words = cursor.fetchall()
        
        cursor.execute('SELECT * FROM user_word_data')
        user_data = cursor.fetchall()
        
        # Vì đã dùng RealDictCursor, chúng ta không cần [dict(ix) for ix...] nữa
        return jsonify({
            'collections': collections,
            'topics': topics,
            'words': words,
            'user_data': user_data
        })
    except Exception as e:
        current_app.logger.error(f"Database error in /data: {e}")
        return jsonify({'error': 'Failed to fetch data'}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close() # Luôn đóng kết nối

@bp.route('/translate', methods=['POST'])
def translate_text():
    """
    API endpoint này không thay đổi vì nó không dùng database.
    """
    data = request.get_json()
    text_to_translate = data.get('text', '')

    if not text_to_translate:
        return jsonify({'error': 'No text provided'}), 400

    try:
        translated_text = GoogleTranslator(source='en', target='vi').translate(text_to_translate)
        return jsonify({'translatedText': translated_text})
    except Exception as e:
        current_app.logger.error(f"Translation error: {e}")
        return jsonify({'error': 'Translation failed'}), 500
    

SRS_INTERVALS_HOURS = [4, 8, 24, 72, 168, 336, 720] # 4h, 8h, 1d, 3d, 7d, 14d, 30d

@bp.route('/update_srs', methods=['POST'])
def update_srs():
    data = request.get_json()
    word_id = data.get('word_id')
    is_correct = data.get('is_correct')

    if not word_id:
        return jsonify({'status': 'error', 'message': 'Missing word_id'}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # LƯU Ý: PostgreSQL dùng %s thay vì ?
        cursor.execute(
            'SELECT * FROM user_word_data WHERE word_id = %s', (word_id,)
        )
        progress = cursor.fetchone()

        srs_level = progress['srs_level'] if progress else 0

        if is_correct:
            srs_level = min(srs_level + 1, len(SRS_INTERVALS_HOURS))
        else:
            srs_level = max(0, srs_level - 2)

        interval_hours = SRS_INTERVALS_HOURS[srs_level - 1] if srs_level > 0 else 1
        next_review_at = datetime.now() + timedelta(hours=interval_hours)

        # LƯU Ý: PostgreSQL dùng %s thay vì ?
        cursor.execute('''
            INSERT INTO user_word_data (word_id, srs_level, next_review_at) VALUES (%s, %s, %s)
            ON CONFLICT(word_id) DO UPDATE SET
            srs_level = excluded.srs_level,
            next_review_at = excluded.next_review_at
        ''', (word_id, srs_level, next_review_at.isoformat()))

        conn.commit() # Lưu thay đổi vào database

        return jsonify({'status': 'success', 'word_id': word_id, 'new_level': srs_level})

    except Exception as e:
        if conn:
            conn.rollback() # Hoàn tác nếu có lỗi
        current_app.logger.error(f"Database error in /update_srs: {e}")
        return jsonify({'error': 'Failed to update data'}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()