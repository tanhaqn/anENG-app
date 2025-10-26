import sqlite3
from flask import Blueprint, jsonify, current_app, request
# Import đúng lớp GoogleTranslator từ thư viện deep_translator
from deep_translator import GoogleTranslator
from datetime import datetime, timedelta

# Create a Blueprint for the API routes
bp = Blueprint('api', __name__, url_prefix='/api')

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    db_path = current_app.instance_path + '/vocabulary.db'
    conn = sqlite3.connect(db_path)
    # Set the row factory to access columns by name
    conn.row_factory = sqlite3.Row
    return conn

@bp.route('/data')
def get_all_data():
    """
    API endpoint to fetch all visible data (collections, topics, words).
    This is the single source of data for the front-end application.
    """
    conn = get_db_connection()
    
    # Fetch all collections that are marked as visible
    collections = conn.execute(
        'SELECT * FROM collections WHERE is_visible = 1 ORDER BY name'
    ).fetchall()
    
    # Fetch all topics belonging to visible collections
    topics = conn.execute('''
        SELECT t.* FROM topics t
        JOIN collections c ON t.collection_id = c.id
        WHERE c.is_visible = 1
        ORDER BY t.collection_id, t.position, t.id
    ''').fetchall()
    
    # Fetch all words belonging to topics in visible collections
    words = conn.execute('''
        SELECT w.* FROM words w
        JOIN topics t ON w.topic_id = t.id
        JOIN collections c ON t.collection_id = c.id
        WHERE c.is_visible = 1
        ORDER BY t.id, w.position, w.id
    ''').fetchall()
    
    # Lấy thêm dữ liệu tiến độ của người dùng
    user_data = conn.execute('SELECT * FROM user_word_data').fetchall()

    conn.close()
    
    # Return all data in a single JSON response
    return jsonify({
            'collections': [dict(ix) for ix in collections],
            'topics': [dict(ix) for ix in topics],
            'words': [dict(ix) for ix in words],
            'user_data': [dict(ix) for ix in user_data]
        })

@bp.route('/translate', methods=['POST'])
def translate_text():
    """
    API endpoint để dịch một đoạn văn bản từ tiếng Anh sang tiếng Việt.
    """
    # Lấy dữ liệu text từ request gửi lên
    data = request.get_json()
    text_to_translate = data.get('text', '')

    # Kiểm tra xem có text để dịch không
    if not text_to_translate:
        return jsonify({'error': 'No text provided'}), 400

    try:
        # SỬA LẠI CÁCH DÙNG CHO ĐÚNG VỚI THƯ VIỆN deep-translator
        translated_text = GoogleTranslator(source='en', target='vi').translate(text_to_translate)
        
        # Trả về kết quả dịch dưới dạng JSON
        return jsonify({'translatedText': translated_text})
    except Exception as e:
        # Bắt lỗi nếu có sự cố trong quá trình dịch
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

    conn = get_db_connection()

    # Lấy thông tin hiện tại của từ, hoặc tạo mới nếu chưa có
    progress = conn.execute(
        'SELECT * FROM user_word_data WHERE word_id = ?', (word_id,)
    ).fetchone()

    srs_level = progress['srs_level'] if progress else 0

    if is_correct:
        # Tăng cấp độ nếu trả lời đúng
        srs_level = min(srs_level + 1, len(SRS_INTERVALS_HOURS))
    else:
        # Giảm 2 cấp độ nếu trả lời sai (nhưng không thấp hơn 0)
        srs_level = max(0, srs_level - 2)

    # Tính toán ngày ôn tập tiếp theo
    interval_hours = SRS_INTERVALS_HOURS[srs_level - 1] if srs_level > 0 else 1 # Ôn lại sau 1h nếu sai ở level 0/1
    next_review_at = datetime.now() + timedelta(hours=interval_hours)

    # Cập nhật hoặc chèn dữ liệu mới vào DB
    conn.execute('''
        INSERT INTO user_word_data (word_id, srs_level, next_review_at) VALUES (?, ?, ?)
        ON CONFLICT(word_id) DO UPDATE SET
        srs_level = excluded.srs_level,
        next_review_at = excluded.next_review_at
    ''', (word_id, srs_level, next_review_at.isoformat()))

    conn.commit()
    conn.close()

    return jsonify({'status': 'success', 'word_id': word_id, 'new_level': srs_level})