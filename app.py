import warnings
warnings.filterwarnings("ignore", category=UserWarning, message=".*development server.*")

import sqlite3
import json
import os
import random
from flask import Flask, render_template, request, redirect, url_for, g, session, flash
from werkzeug.utils import secure_filename
from typing import cast

app = Flask(__name__)
app.secret_key = "StoryGame_2026_admin_secret_6688"
DATABASE = "game.db"
UPLOAD_FOLDER = "sql_upload_tmp"
ALLOWED_EXTENSIONS = {"sql"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    with open('schema.sql', 'r', encoding='utf-8') as f:
        db.executescript(f.read())
    db.commit()


# 读取数据库中存储的管理员密码
def get_admin_password():
    try:
        cur = get_db().cursor()
        cur.execute("SELECT admin_pwd FROM admin_config LIMIT 1")
        row = cur.fetchone()
        if row:
            return row['admin_pwd']
    except Exception:
        pass
    # 表不存在/查询异常，返回初始默认密码
    return "storygame"


# 修改管理员密码
def update_admin_password(new_pwd):
    db = get_db()
    db.execute("UPDATE admin_config SET admin_pwd = ? WHERE id = 1", (new_pwd,))
    db.commit()

# 根据故事ID + 本故事内局部页码 查询页面，每次随机打乱选项
def get_page(story_id: int, local_id: int):
    cur = get_db().cursor()
    cur.execute("""
        SELECT * FROM story_page 
        WHERE story_id = ? AND local_page_id = ?
    """, (story_id, local_id))
    row = cur.fetchone()
    print(f"查询故事{story_id} 局部页面{local_id}, 查询结果：{row}")
    if not row:
        return None
    page_data = dict(row)
    # 仅解析json，不洗牌，保留原始选项顺序
    page_data['options'] = json.loads(page_data['options'])
    return page_data


def get_story_start_local_id(story_id: int):
    cur = get_db().cursor()
    cur.execute("""
        SELECT local_page_id FROM story_page 
        WHERE story_id = ? AND page_type = 'start' AND local_page_id = 1 LIMIT 1
    """, (story_id,))
    res = cur.fetchone()
    return res['local_page_id'] if res else None

def get_all_stories():
    cur = get_db().cursor()
    cur.execute("SELECT * FROM story ORDER BY story_id")
    return cur.fetchall()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 故事列表首页
@app.route('/')
def story_list():
    stories = get_all_stories()
    return render_template("story_list.html", stories=stories)

# 进入故事，清空选项缓存
@app.route('/play/story/<int:story_id>')
def enter_story(story_id):
    # 清空全部游玩相关session，彻底隔离上一个故事状态
    session.pop('current_story_id', None)
    session.pop('allow_ending_map', None)
    remove_keys = [k for k in session.keys() if k.startswith("opt_cache_")]
    for k in remove_keys:
        session.pop(k)

    session['current_story_id'] = story_id
    start_local_id = get_story_start_local_id(story_id)
    if not start_local_id:
        flash("该故事暂无开篇剧情")
        return redirect(url_for("story_list"))
    return redirect(url_for("play_page", story_id=story_id, local_id=start_local_id))


# 游玩页面
@app.route('/play/<int:story_id>/<int:local_id>')
def play_page(story_id, local_id):
    if session.get("current_story_id") != story_id:
        flash("请先从故事列表进入对应剧本！")
        return redirect(url_for("story_list"))
    page = get_page(story_id, local_id)
    if not page:
        flash("剧情页面不存在，返回故事选择")
        return redirect(url_for("story_list"))

    if page['page_type'] == "ending":
        allow_info = session.get("allow_ending_map")
        # 严格校验：放行标记的故事必须等于当前故事
        if not allow_info or allow_info.get("story_id") != story_id or allow_info.get("enable") != 1:
            flash("不能直接查看结局，请正常推理走完剧情！")
            return redirect(url_for("story_list"))
        session.pop("allow_ending_map", None)

        # ========== 新增：终端打印结局信息 ==========
        end_type = "✅ 真结局" if page["is_true_ending"] == 1 else "❌ 错误结局"
        print(f"\n【抵达结局】故事ID:{story_id} | 页面ID:{local_id} | {end_type}")
        print(f"结局内容预览：{page['content'][:80]}...\n")

        return render_template("ending.html", page=page)

    # 仅渲染页面时执行一次洗牌，choose查询不会改动选项
    random.shuffle(page['options'])
    session.pop("allow_ending_map", None)
    return render_template("page.html", page=page, story_id=story_id)



# 选择跳转
@app.route('/choose', methods=["POST"])
def choose():
    story_id_raw = request.form.get("story_id")
    jump_local_raw = request.form.get("jump_local_id")
    if not story_id_raw or not jump_local_raw:
        return redirect(url_for("story_list"))
    story_id = int(story_id_raw)
    jump_local_id = int(jump_local_raw)
    # 获取原始页面数据（选项未打乱），仅判断页面类型
    target_page = get_page(story_id, jump_local_id)

    # ========== 新增：终端打印玩家选择 ==========
    print(f"\n【玩家操作】故事ID:{story_id} | 选择跳转至页面 local_page_id = {jump_local_id}")

    if target_page and target_page["page_type"] == "ending":
        session["allow_ending_map"] = {
            "story_id": story_id,
            "enable": 1
        }
    return redirect(url_for("play_page", story_id=story_id, local_id=jump_local_id))



# 重置数据库后台（密码校验）
@app.route('/init', methods=["GET", "POST"])
def init_database():
    if request.method == "GET":
        return render_template("init_password.html")

    # 第一步：先执行建表，保证 admin_config 存在
    init_db()
    # 第二步：再读取库内密码校验
    input_pwd = request.form.get("pwd", "")
    real_pwd = get_admin_password()
    if input_pwd != real_pwd:
        flash("密码错误，初始化已执行，但权限校验失败")
        return redirect(url_for("init_database"))

    flash("数据库重置、初始化完成！")
    return redirect(url_for("story_list"))


# SQL剧本上传后台（新增密码校验）
@app.route('/admin/sql_upload', methods=["GET", "POST"])
def sql_upload():
    if request.method == "GET":
        return render_template("sql_upload.html")
    # 校验管理员密码
    input_pwd = request.form.get("admin_pwd", "")
    real_pwd = get_admin_password()
    if input_pwd != real_pwd:
        flash("管理员密码错误，禁止导入剧本")
        return redirect(url_for("sql_upload"))

    if 'sql_file' not in request.files:
        flash("未选择SQL文件")
        return redirect(url_for("sql_upload"))
    file = request.files['sql_file']
    filename_raw = file.filename
    if not filename_raw:
        flash("文件名为空，请重新选择文件")
        return redirect(url_for("sql_upload"))
    if allowed_file(filename_raw):
        filename = secure_filename(cast(str, filename_raw))
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(save_path)
        db = get_db()
        cursor = db.cursor()
        try:
            # 开启数据库事务
            cursor.execute("BEGIN TRANSACTION;")
            with open(save_path, "r", encoding="utf-8") as f:
                sql_text = f.read()
            # 执行完整脚本
            cursor.executescript(sql_text)
            # 无异常则提交
            cursor.execute("COMMIT;")
            os.remove(save_path)
            flash("SQL文件导入成功，新故事已加载！")
        except Exception as e:
            # 任意错误，立刻全部回滚，撤销所有插入
            cursor.execute("ROLLBACK;")
            os.remove(save_path)
            flash(f"SQL脚本执行失败，所有操作已全部回退！错误详情：{str(e)}")
        return redirect(url_for("story_list"))
    flash("仅支持 .sql 格式文件上传")
    return redirect(url_for("sql_upload"))


# 新增：修改管理员密码页面
@app.route('/admin/password_edit', methods=["GET", "POST"])
def password_edit():
    if request.method == "GET":
        return render_template("password_edit.html")
    old_pwd = request.form.get("old_pwd", "")
    new_pwd = request.form.get("new_pwd", "").strip()
    confirm_pwd = request.form.get("confirm_pwd", "").strip()
    real_pwd = get_admin_password()

    if old_pwd != real_pwd:
        flash("原管理员密码输入错误")
        return redirect(url_for("password_edit"))
    if len(new_pwd) < 3:
        flash("新密码长度至少3位")
        return redirect(url_for("password_edit"))
    if new_pwd != confirm_pwd:
        flash("两次输入新密码不一致")
        return redirect(url_for("password_edit"))
    update_admin_password(new_pwd)
    flash("管理员密码修改成功！")
    return redirect(url_for("story_list"))

if __name__ == '__main__':
    app.run(debug=False)
