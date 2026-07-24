from flask import Flask, render_template, session, redirect, url_for
from functools import wraps
from models import db
from routes.api import api_bp
import os

# ============================================================
# 应用初始化
# ============================================================

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'game.db')

app = Flask(__name__)
app.secret_key = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

app.register_blueprint(api_bp)


# ============================================================
# 登录保护装饰器
# ============================================================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('authenticated'):
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function


# ============================================================
# 页面路由
# ============================================================

@app.route('/')
def index():
    """读者首页 - 故事列表"""
    return render_template('index.html')


@app.route('/reader/<int:story_id>')
def reader_page(story_id):
    """读者阅读页"""
    return render_template('reader.html', story_id=story_id)


@app.route('/login')
def login_page():
    """登录页面（已登录则跳转到工作台）"""
    if session.get('authenticated'):
        return redirect(url_for('creator_index'))
    return render_template('login.html')


@app.route('/creator')
@login_required
def creator_index():
    """创作者工作台（含故事列表、回收站、设置、备份）"""
    return render_template('creator_index.html')


@app.route('/creator/<int:story_id>')
@login_required
def creator_editor(story_id):
    """故事编辑器（思维导图 + 页面编辑）"""
    return render_template('creator.html', story_id=story_id)


# ============================================================
# 废弃路由（重定向到工作台）
# ============================================================

@app.route('/settings')
@login_required
def settings_page():
    """修改密码（已整合到工作台，重定向）"""
    return redirect(url_for('creator_index'))


@app.route('/trash')
@login_required
def trash_page():
    """回收站（已整合到工作台，重定向）"""
    return redirect(url_for('creator_index'))


# ============================================================
# 测试路由（可选，保留用于开发调试）
# ============================================================

@app.route('/creator_test')
def creator_test():
    """分栏拖拽测试页面（无 ECharts）"""
    return render_template('creator_test.html')


# ============================================================
# 启动入口
# ============================================================

if __name__ == '__main__':
    with app.app_context():
        db.create_all()

    print("\n" + "=" * 60)
    print("  📚 故事创作与阅读平台")
    print("=" * 60)
    print(f"  🗄️  数据库路径: {DB_PATH}")
    print(f"  ✅ 数据库状态: {'已存在' if os.path.exists(DB_PATH) else '新建'}")
    print("=" * 60)
    print("  🌐 访问地址:")
    print(f"     📖 读者首页:  http://127.0.0.1:5000/")
    print(f"     ✍️ 创作者工作台: http://127.0.0.1:5000/creator")
    print(f"     🔐 登录页面:  http://127.0.0.1:5000/login")
    print(f"     🧪 分栏测试:  http://127.0.0.1:5000/creator_test")
    print("=" * 60)
    print("  💡 按 Ctrl+C 停止服务")
    print("=" * 60 + "\n")

    app.run(debug=True, host='127.0.0.1', port=5000)