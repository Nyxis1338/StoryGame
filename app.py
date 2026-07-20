from flask import Flask, render_template
from models import db
from routes.api import api_bp
import os

# 获取项目根目录的绝对路径
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'game.db')

app = Flask(__name__)
# 使用绝对路径连接数据库
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# 注册 API 蓝图
app.register_blueprint(api_bp)


# ==========================================
# 页面路由 - 仅渲染 HTML 骨架
# ==========================================

@app.route('/')
def index():
    """读者首页"""
    return render_template('index.html')


@app.route('/reader/<int:story_id>')
def reader_page(story_id):
    """读者阅读页"""
    return render_template('reader.html', story_id=story_id)


@app.route('/creator')
def creator_index():
    """创作者工作台"""
    return render_template('creator_index.html')


@app.route('/creator/<int:story_id>')
def creator_editor(story_id):
    """创作者编辑器"""
    return render_template('creator.html', story_id=story_id)


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    print(f"✅ 数据库路径: {DB_PATH}")
    print(f"✅ 数据库存在: {os.path.exists(DB_PATH)}")
    app.run(debug=True)