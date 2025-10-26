from flask import Blueprint, render_template

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    """Phục vụ file HTML chính của ứng dụng học tập."""
    return render_template('index.html')
