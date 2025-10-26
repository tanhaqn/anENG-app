import psycopg2
import psycopg2.extras # Thêm thư viện này
import json
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, jsonify
from app.db import get_db_connection

bp = Blueprint('admin', __name__, url_prefix='/admin', template_folder='templates')

# --- Collection Management ---
@bp.route('/')
def manage_collections():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT * FROM collections ORDER BY created_at DESC')
        collections = cursor.fetchall()
    except (Exception, psycopg2.DatabaseError) as e:
        flash(f'Lỗi khi tải bộ sưu tập: {e}', 'error')
        collections = []
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        
    return render_template('admin/manage_collections.html', collections=collections)

@bp.route('/collections/delete/<int:id>', methods=['POST'])
def delete_collection(id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # %s là cú pháp của psycopg2 (thay cho ?)
        cursor.execute('DELETE FROM collections WHERE id = %s', (id,))
        conn.commit()
        flash('Bộ sưu tập và tất cả dữ liệu liên quan đã được xóa.', 'success')
    except (Exception, psycopg2.DatabaseError) as e:
        if conn: conn.rollback()
        flash(f'Lỗi khi xóa bộ sưu tập: {e}', 'error')
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        
    return redirect(url_for('admin.manage_collections'))

@bp.route('/collections/toggle-visibility/<int:id>', methods=['POST'])
def toggle_visibility(id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute('SELECT is_visible FROM collections WHERE id = %s', (id,))
        current_status_row = cursor.fetchone()
        
        if current_status_row is None:
            return jsonify({'status': 'error', 'message': 'Không tìm thấy bộ sưu tập.'}), 404
        
        new_status = 0 if current_status_row['is_visible'] == 1 else 1
        cursor.execute('UPDATE collections SET is_visible = %s WHERE id = %s', (new_status, id))
        conn.commit()
        return jsonify({'status': 'success', 'new_status': 'Hiển thị' if new_status == 1 else 'Đã ẩn', 'is_visible': new_status})
    except (Exception, psycopg2.DatabaseError) as e:
        if conn: conn.rollback()
        return jsonify({'status': 'error', 'message': f'Lỗi cơ sở dữ liệu: {e}'}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# --- Import Logic ---
@bp.route('/import-data', methods=['POST'])
def import_data():
    if 'json_file' not in request.files:
        flash('Không có file nào được chọn.', 'error')
        return redirect(url_for('admin.manage_collections'))

    file = request.files['json_file']
    collection_name = request.form.get('collection_name', '').strip()

    if file.filename == '' or not collection_name:
        flash('Tên bộ sưu tập và file không được để trống.', 'error')
        return redirect(url_for('admin.manage_collections'))

    if file and file.filename.endswith('.json'):
        conn = get_db_connection() # Bắt đầu kết nối
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) # Dùng cursor dict
        try:
            data = json.load(file.stream)
            topics_data = data.get('topics', [])
            vocabulary_data = data.get('vocabulary', [])
            
            # Bắt đầu Transaction (PostgreSQL tự xử lý, chỉ cần commit/rollback)
            
            # Sửa: Dùng RETURNING id để lấy ID vừa chèn
            cursor.execute('INSERT INTO collections (name) VALUES (%s) RETURNING id', (collection_name,))
            collection_id = cursor.fetchone()['id'] # Lấy ID
            
            old_id_to_new_id = {}
            for index, topic in enumerate(topics_data):
                old_topic_id = topic['id']
                cursor.execute(
                    'INSERT INTO topics (name, category, position, collection_id) VALUES (%s, %s, %s, %s) RETURNING id',
                    (topic['name'], topic['category'], index, collection_id)
                )
                new_topic_id = cursor.fetchone()['id'] # Lấy ID
                old_id_to_new_id[old_topic_id] = new_topic_id

            word_positions = {}
            for word in vocabulary_data:
                old_topic_id = word.get('topic_id')
                if old_topic_id in old_id_to_new_id:
                    new_topic_id = old_id_to_new_id[old_topic_id]
                    current_pos = word_positions.get(new_topic_id, 0)
                    cursor.execute(
                        'INSERT INTO words (topic_id, word, ipa, type, meaning, example, position) VALUES (%s, %s, %s, %s, %s, %s, %s)',
                        (new_topic_id, word['word'], word.get('ipa', ''), word.get('type', ''), word['meaning'], word.get('example', ''), current_pos)
                    )
                    word_positions[new_topic_id] = current_pos + 1

            conn.commit() # Commit khi mọi thứ thành công
            flash(f'Import thành công bộ sưu tập "{collection_name}"!', 'success')

        except psycopg2.IntegrityError: # Sửa: Lỗi Integrity của psycopg2
            if conn: conn.rollback()
            flash(f'Tên bộ sưu tập "{collection_name}" đã tồn tại. Vui lòng chọn tên khác.', 'error')
        except (Exception, psycopg2.DatabaseError) as e: # Sửa: Lỗi chung
            if conn: conn.rollback()
            flash(f'Đã xảy ra lỗi: {e}', 'error')
        finally:
            if cursor: cursor.close()
            if conn: conn.close()
    else:
        flash('Vui lòng upload file có định dạng .json', 'error')

    return redirect(url_for('admin.manage_collections'))

# --- Topic Management ---
@bp.route('/collection/<int:collection_id>/topics')
def manage_topics(collection_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        collection = cursor.execute('SELECT * FROM collections WHERE id = %s', (collection_id,)).fetchone()
        if not collection:
            flash('Bộ sưu tập không tồn tại.', 'error')
            return redirect(url_for('admin.manage_collections'))
            
        cursor.execute('SELECT * FROM topics WHERE collection_id = %s ORDER BY position, id', (collection_id,))
        topics = cursor.fetchall()
        
    except (Exception, psycopg2.DatabaseError) as e:
        flash(f'Lỗi khi tải chủ đề: {e}', 'error')
        topics = []
        collection = None # Đảm bảo collection không bị lỗi
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        
    if collection is None: # Kiểm tra lại sau khi đóng kết nối
        return redirect(url_for('admin.manage_collections'))
        
    return render_template('admin/manage_topics.html', topics=topics, collection=collection)

@bp.route('/collection/<int:collection_id>/topics/add', methods=['POST'])
def add_topic(collection_id):
    name = request.form['name']
    category = request.form['category']
    if not name or not category:
        flash('Tên chủ đề và danh mục không được để trống.', 'error')
    else:
        conn = None
        cursor = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('SELECT MAX(position) FROM topics WHERE collection_id = %s', (collection_id,))
            max_pos_row = cursor.fetchone()
            
            max_pos = max_pos_row[0] if max_pos_row[0] is not None else -1
            new_pos = max_pos + 1
            
            cursor.execute('INSERT INTO topics (name, category, position, collection_id) VALUES (%s, %s, %s, %s)', 
                           (name, category, new_pos, collection_id))
            conn.commit()
            flash('Chủ đề đã được thêm thành công!', 'success')
        except (Exception, psycopg2.DatabaseError) as e:
            if conn: conn.rollback()
            flash(f'Lỗi khi thêm chủ đề: {e}', 'error')
        finally:
            if cursor: cursor.close()
            if conn: conn.close()
            
    return redirect(url_for('admin.manage_topics', collection_id=collection_id))

@bp.route('/topics/edit/<int:id>', methods=['GET', 'POST'])
def edit_topic(id):
    conn = None
    cursor = None
    topic = None # Khai báo topic
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if request.method == 'POST':
            name = request.form['name']
            category = request.form['category']
            cursor.execute('UPDATE topics SET name = %s, category = %s WHERE id = %s', (name, category, id))
            conn.commit()
            
            # Lấy lại collection_id để redirect
            cursor.execute('SELECT collection_id FROM topics WHERE id = %s', (id,))
            topic = cursor.fetchone()
            
            flash('Chủ đề đã được cập nhật thành công!', 'success')
            return redirect(url_for('admin.manage_topics', collection_id=topic['collection_id']))
        
        # Cho GET request
        topic = cursor.execute('SELECT * FROM topics WHERE id = %s', (id,)).fetchone()
        
    except (Exception, psycopg2.DatabaseError) as e:
        if conn and request.method == 'POST': conn.rollback()
        flash(f'Lỗi khi sửa chủ đề: {e}', 'error')
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

    if topic is None:
        flash('Không tìm thấy chủ đề này.', 'error')
        return redirect(url_for('admin.manage_collections'))
        
    return render_template('admin/edit_topic.html', topic=topic)

@bp.route('/topics/delete/<int:id>', methods=['POST'])
def delete_topic(id):
    collection_id = None
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        topic = cursor.execute('SELECT collection_id FROM topics WHERE id = %s', (id,)).fetchone()
        collection_id = topic['collection_id'] if topic else None
        
        cursor.execute('DELETE FROM topics WHERE id = %s', (id,))
        conn.commit()
        flash('Chủ đề và các từ vựng liên quan đã được xóa.', 'success')
    except (Exception, psycopg2.DatabaseError) as e:
        if conn: conn.rollback()
        flash(f'Lỗi khi xóa chủ đề: {e}', 'error')
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        
    if collection_id:
        return redirect(url_for('admin.manage_topics', collection_id=collection_id))
    return redirect(url_for('admin.manage_collections'))


@bp.route('/topics/reorder', methods=['POST'])
def reorder_topics():
    data = request.get_json()
    ordered_ids = data.get('ordered_ids')
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        for index, topic_id in enumerate(ordered_ids):
            cursor.execute('UPDATE topics SET position = %s WHERE id = %s', (index, int(topic_id)))
        conn.commit()
        return jsonify({'status': 'success', 'message': 'Thứ tự chủ đề đã được cập nhật.'})
    except (Exception, psycopg2.DatabaseError) as e:
        if conn: conn.rollback()
        return jsonify({'status': 'error', 'message': f'Lỗi cơ sở dữ liệu: {e}'})
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# --- Word Management ---
@bp.route('/topic/<int:topic_id>/words')
def manage_words(topic_id):
    conn = None
    cursor = None
    topic = None
    words = []
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        topic = cursor.execute('SELECT t.*, c.name as collection_name FROM topics t JOIN collections c ON t.collection_id = c.id WHERE t.id = %s', (topic_id,)).fetchone()
        if topic is None:
            flash('Chủ đề không tồn tại.', 'error')
            return redirect(url_for('admin.manage_collections'))
            
        words = cursor.execute('SELECT * FROM words WHERE topic_id = %s ORDER BY position, id', (topic_id,)).fetchall()
        
    except (Exception, psycopg2.DatabaseError) as e:
        flash(f'Lỗi khi tải từ vựng: {e}', 'error')
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        
    if topic is None: # Kiểm tra lại phòng trường hợp lỗi
        return redirect(url_for('admin.manage_collections'))
        
    return render_template('admin/manage_words.html', topic=topic, words=words)

@bp.route('/topic/<int:topic_id>/words/add', methods=['POST'])
def add_word(topic_id):
    form_data = request.form
    if not form_data.get('word') or not form_data.get('meaning'):
        flash('Từ và nghĩa không được để trống.', 'error')
    else:
        conn = None
        cursor = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            max_pos_row = cursor.execute('SELECT MAX(position) FROM words WHERE topic_id = %s', (topic_id,)).fetchone()
            max_pos = max_pos_row[0] if max_pos_row[0] is not None else -1
            new_pos = max_pos + 1
            
            cursor.execute(
                'INSERT INTO words (topic_id, word, meaning, ipa, type, example, position) VALUES (%s, %s, %s, %s, %s, %s, %s)',
                (topic_id, form_data['word'], form_data['meaning'], form_data.get('ipa'), form_data.get('type'), form_data.get('example'), new_pos)
            )
            conn.commit()
            flash('Từ mới đã được thêm thành công!', 'success')
        except (Exception, psycopg2.DatabaseError) as e:
            if conn: conn.rollback()
            flash(f'Lỗi khi thêm từ: {e}', 'error')
        finally:
            if cursor: cursor.close()
            if conn: conn.close()
            
    return redirect(url_for('admin.manage_words', topic_id=topic_id))

@bp.route('/words/edit/<int:word_id>', methods=['GET', 'POST'])
def edit_word(word_id):
    conn = None
    cursor = None
    word = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if request.method == 'POST':
            form_data = request.form
            cursor.execute(
                'UPDATE words SET word = %s, meaning = %s, ipa = %s, type = %s, example = %s WHERE id = %s',
                (form_data['word'], form_data['meaning'], form_data.get('ipa'), form_data.get('type'), form_data.get('example'), word_id)
            )
            conn.commit()
            
            cursor.execute('SELECT topic_id FROM words WHERE id = %s', (word_id,))
            word = cursor.fetchone() # Lấy topic_id để redirect
            
            flash('Từ đã được cập nhật thành công!', 'success')
            return redirect(url_for('admin.manage_words', topic_id=word['topic_id']))
        
        # Cho GET request
        word = cursor.execute('SELECT * FROM words WHERE id = %s', (word_id,)).fetchone()
        
    except (Exception, psycopg2.DatabaseError) as e:
        if conn and request.method == 'POST': conn.rollback()
        flash(f'Lỗi khi sửa từ: {e}', 'error')
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

    if word is None:
        flash('Không tìm thấy từ này.', 'error')
        return redirect(url_for('admin.manage_collections'))
        
    return render_template('admin/edit_word.html', word=word)

@bp.route('/words/delete/<int:word_id>', methods=['POST'])
def delete_word(word_id):
    topic_id = None
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        word = cursor.execute('SELECT topic_id FROM words WHERE id = %s', (word_id,)).fetchone()
        topic_id = word['topic_id'] if word else None
        
        cursor.execute('DELETE FROM words WHERE id = %s', (word_id,))
        conn.commit()
        flash('Từ đã được xóa.', 'success')
    except (Exception, psycopg2.DatabaseError) as e:
        if conn: conn.rollback()
        flash(f'Lỗi khi xóa từ: {e}', 'error')
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        
    if topic_id:
        return redirect(url_for('admin.manage_words', topic_id=topic_id))
    return redirect(url_for('admin.manage_collections'))


@bp.route('/words/reorder', methods=['POST'])
def reorder_words():
    data = request.get_json()
    ordered_ids = data.get('ordered_ids')
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        for index, word_id in enumerate(ordered_ids):
            cursor.execute('UPDATE words SET position = %s WHERE id = %s', (index, int(word_id)))
        conn.commit()
        return jsonify({'status': 'success', 'message': 'Thứ tự từ đã được cập nhật.'})
    except (Exception, psycopg2.DatabaseError) as e:
        if conn: conn.rollback()
        return jsonify({'status': 'error', 'message': f'Lỗi cơ sở dữ liệu: {e}'})
    finally:
        if cursor: cursor.close()
        if conn: conn.close()