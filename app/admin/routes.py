import sqlite3
import json
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, jsonify

bp = Blueprint('admin', __name__, url_prefix='/admin', template_folder='templates')

def get_db_connection():
    db_path = current_app.instance_path + '/vocabulary.db'
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

# --- Collection Management ---
@bp.route('/')
def manage_collections():
    conn = get_db_connection()
    collections = conn.execute('SELECT * FROM collections ORDER BY created_at DESC').fetchall()
    conn.close()
    return render_template('admin/manage_collections.html', collections=collections)

@bp.route('/collections/delete/<int:id>', methods=['POST'])
def delete_collection(id):
    conn = get_db_connection()
    try:
        conn.execute('DELETE FROM collections WHERE id = ?', (id,))
        conn.commit()
        flash('Bộ sưu tập và tất cả dữ liệu liên quan đã được xóa.', 'success')
    except sqlite3.Error as e:
        conn.rollback()
        flash(f'Lỗi khi xóa bộ sưu tập: {e}', 'error')
    finally:
        conn.close()
    return redirect(url_for('admin.manage_collections'))

@bp.route('/collections/toggle-visibility/<int:id>', methods=['POST'])
def toggle_visibility(id):
    conn = get_db_connection()
    try:
        current_status_row = conn.execute('SELECT is_visible FROM collections WHERE id = ?', (id,)).fetchone()
        if current_status_row is None:
            return jsonify({'status': 'error', 'message': 'Không tìm thấy bộ sưu tập.'}), 404
        
        new_status = 0 if current_status_row['is_visible'] == 1 else 1
        conn.execute('UPDATE collections SET is_visible = ? WHERE id = ?', (new_status, id))
        conn.commit()
        return jsonify({'status': 'success', 'new_status': 'Hiển thị' if new_status == 1 else 'Đã ẩn', 'is_visible': new_status})
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'status': 'error', 'message': f'Lỗi cơ sở dữ liệu: {e}'}), 500
    finally:
        conn.close()

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
        conn = get_db_connection()
        try:
            data = json.load(file.stream)
            topics_data = data.get('topics', [])
            vocabulary_data = data.get('vocabulary', [])

            cursor = conn.cursor()
            cursor.execute('BEGIN TRANSACTION')
            
            cursor.execute('INSERT INTO collections (name) VALUES (?)', (collection_name,))
            collection_id = cursor.lastrowid
            
            old_id_to_new_id = {}
            for index, topic in enumerate(topics_data):
                old_topic_id = topic['id']
                cursor.execute(
                    'INSERT INTO topics (name, category, position, collection_id) VALUES (?, ?, ?, ?)',
                    (topic['name'], topic['category'], index, collection_id)
                )
                new_topic_id = cursor.lastrowid
                old_id_to_new_id[old_topic_id] = new_topic_id

            word_positions = {}
            for word in vocabulary_data:
                old_topic_id = word.get('topic_id')
                if old_topic_id in old_id_to_new_id:
                    new_topic_id = old_id_to_new_id[old_topic_id]
                    current_pos = word_positions.get(new_topic_id, 0)
                    cursor.execute(
                        'INSERT INTO words (topic_id, word, ipa, type, meaning, example, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        (new_topic_id, word['word'], word.get('ipa', ''), word.get('type', ''), word['meaning'], word.get('example', ''), current_pos)
                    )
                    word_positions[new_topic_id] = current_pos + 1

            conn.commit()
            flash(f'Import thành công bộ sưu tập "{collection_name}"!', 'success')

        except sqlite3.IntegrityError:
            conn.rollback()
            flash(f'Tên bộ sưu tập "{collection_name}" đã tồn tại. Vui lòng chọn tên khác.', 'error')
        except Exception as e:
            conn.rollback()
            flash(f'Đã xảy ra lỗi: {e}', 'error')
        finally:
            conn.close()
    else:
        flash('Vui lòng upload file có định dạng .json', 'error')

    return redirect(url_for('admin.manage_collections'))

# --- Topic Management ---
@bp.route('/collection/<int:collection_id>/topics')
def manage_topics(collection_id):
    conn = get_db_connection()
    collection = conn.execute('SELECT * FROM collections WHERE id = ?', (collection_id,)).fetchone()
    if not collection:
        flash('Bộ sưu tập không tồn tại.', 'error')
        return redirect(url_for('admin.manage_collections'))
    topics = conn.execute('SELECT * FROM topics WHERE collection_id = ? ORDER BY position, id', (collection_id,)).fetchall()
    conn.close()
    return render_template('admin/manage_topics.html', topics=topics, collection=collection)

@bp.route('/collection/<int:collection_id>/topics/add', methods=['POST'])
def add_topic(collection_id):
    name = request.form['name']
    category = request.form['category']
    if not name or not category:
        flash('Tên chủ đề và danh mục không được để trống.', 'error')
    else:
        conn = get_db_connection()
        max_pos_row = conn.execute('SELECT MAX(position) FROM topics WHERE collection_id = ?', (collection_id,)).fetchone()
        max_pos = max_pos_row[0] if max_pos_row[0] is not None else -1
        new_pos = max_pos + 1
        conn.execute('INSERT INTO topics (name, category, position, collection_id) VALUES (?, ?, ?, ?)', 
                     (name, category, new_pos, collection_id))
        conn.commit()
        conn.close()
        flash('Chủ đề đã được thêm thành công!', 'success')
    return redirect(url_for('admin.manage_topics', collection_id=collection_id))

@bp.route('/topics/edit/<int:id>', methods=['GET', 'POST'])
def edit_topic(id):
    conn = get_db_connection()
    topic = conn.execute('SELECT * FROM topics WHERE id = ?', (id,)).fetchone()
    if request.method == 'POST':
        name = request.form['name']
        category = request.form['category']
        conn.execute('UPDATE topics SET name = ?, category = ? WHERE id = ?', (name, category, id))
        conn.commit()
        conn.close()
        flash('Chủ đề đã được cập nhật thành công!', 'success')
        return redirect(url_for('admin.manage_topics', collection_id=topic['collection_id']))
    conn.close()
    if topic is None:
        flash('Không tìm thấy chủ đề này.', 'error')
        return redirect(url_for('admin.manage_collections'))
    return render_template('admin/edit_topic.html', topic=topic)

@bp.route('/topics/delete/<int:id>', methods=['POST'])
def delete_topic(id):
    conn = get_db_connection()
    topic = conn.execute('SELECT collection_id FROM topics WHERE id = ?', (id,)).fetchone()
    collection_id = topic['collection_id'] if topic else None
    conn.execute('DELETE FROM topics WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    flash('Chủ đề và các từ vựng liên quan đã được xóa.', 'success')
    return redirect(url_for('admin.manage_topics', collection_id=collection_id))

@bp.route('/topics/reorder', methods=['POST'])
def reorder_topics():
    data = request.get_json()
    ordered_ids = data.get('ordered_ids')
    conn = get_db_connection()
    try:
        for index, topic_id in enumerate(ordered_ids):
            conn.execute('UPDATE topics SET position = ? WHERE id = ?', (index, int(topic_id)))
        conn.commit()
        return jsonify({'status': 'success', 'message': 'Thứ tự chủ đề đã được cập nhật.'})
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'status': 'error', 'message': f'Lỗi cơ sở dữ liệu: {e}'})
    finally:
        conn.close()

# --- Word Management ---
@bp.route('/topic/<int:topic_id>/words')
def manage_words(topic_id):
    conn = get_db_connection()
    topic = conn.execute('SELECT t.*, c.name as collection_name FROM topics t JOIN collections c ON t.collection_id = c.id WHERE t.id = ?', (topic_id,)).fetchone()
    if topic is None:
        flash('Chủ đề không tồn tại.', 'error')
        return redirect(url_for('admin.manage_collections'))
    words = conn.execute('SELECT * FROM words WHERE topic_id = ? ORDER BY position, id', (topic_id,)).fetchall()
    conn.close()
    return render_template('admin/manage_words.html', topic=topic, words=words)

@bp.route('/topic/<int:topic_id>/words/add', methods=['POST'])
def add_word(topic_id):
    form_data = request.form
    if not form_data.get('word') or not form_data.get('meaning'):
        flash('Từ và nghĩa không được để trống.', 'error')
    else:
        conn = get_db_connection()
        max_pos_row = conn.execute('SELECT MAX(position) FROM words WHERE topic_id = ?', (topic_id,)).fetchone()
        max_pos = max_pos_row[0] if max_pos_row[0] is not None else -1
        new_pos = max_pos + 1
        conn.execute(
            'INSERT INTO words (topic_id, word, meaning, ipa, type, example, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (topic_id, form_data['word'], form_data['meaning'], form_data.get('ipa'), form_data.get('type'), form_data.get('example'), new_pos)
        )
        conn.commit()
        conn.close()
        flash('Từ mới đã được thêm thành công!', 'success')
    return redirect(url_for('admin.manage_words', topic_id=topic_id))

@bp.route('/words/edit/<int:word_id>', methods=['GET', 'POST'])
def edit_word(word_id):
    conn = get_db_connection()
    word = conn.execute('SELECT * FROM words WHERE id = ?', (word_id,)).fetchone()
    if request.method == 'POST':
        form_data = request.form
        conn.execute(
            'UPDATE words SET word = ?, meaning = ?, ipa = ?, type = ?, example = ? WHERE id = ?',
            (form_data['word'], form_data['meaning'], form_data.get('ipa'), form_data.get('type'), form_data.get('example'), word_id)
        )
        conn.commit()
        conn.close()
        flash('Từ đã được cập nhật thành công!', 'success')
        return redirect(url_for('admin.manage_words', topic_id=word['topic_id']))
    conn.close()
    if word is None:
        flash('Không tìm thấy từ này.', 'error')
        return redirect(url_for('admin.manage_collections'))
    return render_template('admin/edit_word.html', word=word)

@bp.route('/words/delete/<int:word_id>', methods=['POST'])
def delete_word(word_id):
    conn = get_db_connection()
    word = conn.execute('SELECT topic_id FROM words WHERE id = ?', (word_id,)).fetchone()
    topic_id = word['topic_id'] if word else None
    conn.execute('DELETE FROM words WHERE id = ?', (word_id,))
    conn.commit()
    conn.close()
    flash('Từ đã được xóa.', 'success')
    if topic_id:
        return redirect(url_for('admin.manage_words', topic_id=topic_id))
    return redirect(url_for('admin.manage_collections'))

@bp.route('/words/reorder', methods=['POST'])
def reorder_words():
    data = request.get_json()
    ordered_ids = data.get('ordered_ids')
    conn = get_db_connection()
    try:
        for index, word_id in enumerate(ordered_ids):
            conn.execute('UPDATE words SET position = ? WHERE id = ?', (index, int(word_id)))
        conn.commit()
        return jsonify({'status': 'success', 'message': 'Thứ tự từ đã được cập nhật.'})
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'status': 'error', 'message': f'Lỗi cơ sở dữ liệu: {e}'})
    finally:
        conn.close()