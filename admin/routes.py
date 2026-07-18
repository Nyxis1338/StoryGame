from flask import Blueprint, render_template, request, abort, jsonify, session, redirect, url_for
import sqlite3
import json
import os
import config

bp = Blueprint("admin", __name__, url_prefix="/admin")

def get_db():
    return sqlite3.connect(config.DB_PATH)

# ===== 原有管理路由（完全保留）=====
@bp.route("/")
def admin_index():
    """管理首页"""
    with get_db() as db:
        stories = db.execute("SELECT * FROM story").fetchall()
    return render_template("admin.html", stories=stories)

@bp.route("/init", methods=["GET", "POST"])
def init_db():
    """重置数据库（原有密码校验逻辑保留）"""
    if request.method == "POST":
        password = request.form.get("password")
        if password != config.ADMIN_PASSWORD:
            return render_template("database_reset.html", error="密码错误")
        
        # 执行重置（原有逻辑）
        with get_db() as db:
            with open(os.path.join(config.BASE_DIR, "schema.sql"), "r") as f:
                db.executescript(f.read())
        return render_template("database_reset.html", success="数据库重置成功")
    return render_template("database_reset.html")

# ===== 原有管理路由（修正上传逻辑）=====
@bp.route("/upload_sql", methods=["GET", "POST"])
def upload_sql():
    """SQL上传（原有密码校验逻辑保留）"""
    if request.method == "POST":
        password = request.form.get("password")
        if password != config.ADMIN_PASSWORD:
            return render_template("sql_upload.html", error="密码错误")
        
        if 'sql_file' not in request.files:
            return render_template("sql_upload.html", error="未选择文件")
        
        sql_file = request.files['sql_file']
        
        # ✅ 关键修复：检查文件名是否为空
        if sql_file.filename == '':
            return render_template("sql_upload.html", error="未选择文件")
        
        if sql_file:
            # 确保临时目录存在
            tmp_dir = os.path.join(config.BASE_DIR, "sql_upload_tmp")
            os.makedirs(tmp_dir, exist_ok=True)
            
            # ✅ 关键修复：安全拼接路径
            # ✅ 关键修复：使用类型断言告诉VS Code这是字符串
            filename: str = sql_file.filename  # type: ignore[assignment]
            filename = os.path.basename(filename)  # 防止路径遍历
            tmp_path = os.path.join(tmp_dir, filename)
            
            sql_file.save(tmp_path)
            try:
                with get_db() as db:
                    with open(tmp_path, 'r', encoding='utf-8') as f:
                        db.executescript(f.read())
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            return render_template("sql_upload.html", success="SQL导入成功")
    return render_template("sql_upload.html")

@bp.route("/edit_password", methods=["GET", "POST"])
def edit_password():
    """修改管理员密码（原有逻辑保留）"""
    if request.method == "POST":
        old_pwd = request.form.get("old_password")
        new_pwd = request.form.get("new_password")
        if old_pwd != config.ADMIN_PASSWORD:
            return render_template("password_edit.html", error="旧密码错误")
        
        # 更新配置（生产环境建议持久化到数据库）
        config.ADMIN_PASSWORD = new_pwd
        return render_template("password_edit.html", success="密码修改成功")
    return render_template("password_edit.html")

@bp.route("/story/<int:story_id>/edit")
def story_edit(story_id):
    """原有表单编辑页（保留，作为思维导图之外的备选）"""
    with get_db() as db:
        story = db.execute("SELECT * FROM story WHERE story_id=?", (story_id,)).fetchone()
        pages = db.execute(
            """SELECT local_page_id, content, options, page_type, is_true_ending 
               FROM story_page WHERE story_id=? ORDER BY local_page_id""",
            (story_id,)
        ).fetchall()
    return render_template("admin_edit.html", story=story, pages=pages)

# ===== 新增思维导图相关接口 =====
@bp.route("/story/<int:story_id>/mindmap")
def story_mindmap(story_id):
    # 获取故事数据
    with get_db() as db:
        story = db.execute("SELECT * FROM story WHERE story_id=?", (story_id,)).fetchone()
        if not story:
            abort(404)
    return render_template("story_mindmap.html", story=story, story_id=story_id)

@bp.route("/api/story/<int:story_id>/graph")
def get_story_graph(story_id):
    """获取思维导图数据"""
    with get_db() as db:
        pages = db.execute(
            """SELECT local_page_id, content, options, page_type, pos_x, pos_y 
               FROM story_page WHERE story_id=?""",
            (story_id,)
        ).fetchall()
    
    nodes = []
    edges = []
    for p in pages:
        pid, content, options_json, ptype, x, y = p
        nodes.append({
            "id": f"page_{pid}",
            "page_id": pid,
            "content": content[:30] + "..." if len(content) > 30 else content,
            "type": ptype,
            "left": x,
            "top": y
        })
        options = json.loads(options_json) if options_json else []
        for opt in options:
            edges.append({
                "source": f"page_{pid}",
                "target": f"page_{opt['jump_local_id']}",
                "label": opt["text"]
            })
    return jsonify({"nodes": nodes, "edges": edges})

@bp.route("/api/node/move", methods=["POST"])
def move_node():
    """保存节点拖拽位置"""
    data = request.json
    with get_db() as db:
        db.execute(
            """UPDATE story_page 
               SET pos_x=?, pos_y=? 
               WHERE story_id=? AND local_page_id=?""",
            (data["x"], data["y"], data["story_id"], data["page_id"])
        )
        db.commit()
    return jsonify(status="ok")

@bp.route("/api/page/get")
def get_page():
    """获取单页详情（供思维导图编辑用）"""
    story_id = request.args.get("story_id", type=int)
    page_id = request.args.get("local_page_id", type=int)
    with get_db() as db:
        page = db.execute(
            """SELECT content, options, page_type, is_true_ending 
               FROM story_page 
               WHERE story_id=? AND local_page_id=?""",
            (story_id, page_id)
        ).fetchone()
    if not page:
        return jsonify({})
    return jsonify({
        "content": page[0],
        "options": json.loads(page[1]) if page[1] else [],
        "page_type": page[2],
        "is_true_ending": page[3]
    })

@bp.route("/api/page/save", methods=["POST"])
def save_page():
    data = request.json
    try:
        with get_db() as db:
            # 1. 先存草稿，不直接改正式表
            db.execute(
                """INSERT INTO story_page_draft (story_id, local_page_id, draft_data)
                   VALUES (?,?,?)""",
                (data["story_id"], data["local_page_id"], json.dumps(data))
            )
            db.commit()
        return jsonify(status="draft_saved", message="草稿已保存，请确认后发布")
    except Exception as e:
        return jsonify(status="error", message=str(e)), 500

# 新增发布接口（作者确认后调用）
@bp.route("/api/page/publish", methods=["POST"])
def publish_page():
    data = request.json
    db_conn = None  # 先声明连接变量，避免作用域问题
    try:
        db_conn = get_db()  # 手动获取连接，不依赖with块的作用域
        # SQLite默认自动提交，所以需要手动开启事务
        db_conn.execute("BEGIN TRANSACTION")
        
        # 从草稿表取最新数据
        draft = db_conn.execute(
            """SELECT draft_data FROM story_page_draft 
               WHERE story_id=? AND local_page_id=? 
               ORDER BY created_at DESC LIMIT 1""",
            (data["story_id"], data["local_page_id"])
        ).fetchone()
        
        if not draft:
            return jsonify(status="error", message="草稿不存在，无法发布"), 404
        
        page_data = json.loads(draft[0])
        
        # 写入正式表（INSERT OR REPLACE覆盖旧数据）
        db_conn.execute(
            """INSERT OR REPLACE INTO story_page
               (story_id, local_page_id, content, options, page_type, is_true_ending, pos_x, pos_y)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                page_data["story_id"],
                page_data["local_page_id"],
                page_data["content"],
                json.dumps(page_data["options"]),
                page_data["page_type"],
                page_data["is_true_ending"],
                page_data.get("pos_x", 50),
                page_data.get("pos_y", 50)
            )
        )
        
        # 提交事务（只有到这里才真正写入正式库）
        db_conn.commit()
        return jsonify(status="published", message="内容已正式发布，可回退")
        
    except Exception as e:
        # 出错时回滚，此时db_conn还在作用域内，不会Unbound
        if db_conn:
            db_conn.rollback()
        return jsonify(status="error", message=f"发布失败，已回滚：{str(e)}"), 500
    finally:
        # 确保连接关闭
        if db_conn:
            db_conn.close()

# 「批量发布所有草稿」的接口
@bp.route("/api/story/<int:story_id>/publish_all", methods=["POST"])
def publish_all_drafts(story_id):
    db_conn = None
    try:
        db_conn = get_db()
        db_conn.execute("BEGIN TRANSACTION")
        
        # 取该故事的所有最新草稿
        drafts = db_conn.execute(
            """SELECT local_page_id, draft_data FROM story_page_draft 
               WHERE story_id=? 
               GROUP BY local_page_id 
               HAVING created_at = MAX(created_at)""",
            (story_id,)
        ).fetchall()
        
        if not drafts:
            return jsonify(status="error", message="没有可发布的草稿"), 404
        
        # 批量写入正式表
        for draft in drafts:
            local_page_id, draft_json = draft
            page_data = json.loads(draft_json)
            db_conn.execute(
                """INSERT OR REPLACE INTO story_page
                   (story_id, local_page_id, content, options, page_type, is_true_ending, pos_x, pos_y)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (
                    story_id,
                    local_page_id,
                    page_data["content"],
                    json.dumps(page_data["options"]),
                    page_data["page_type"],
                    page_data["is_true_ending"],
                    page_data.get("pos_x", 50),
                    page_data.get("pos_y", 50)
                )
            )
        
        db_conn.commit()
        return jsonify(
            status="published", 
            message=f"成功发布{len(drafts)}个页面的草稿，可随时回退",
            count=len(drafts)
        )
        
    except Exception as e:
        if db_conn:
            db_conn.rollback()
        return jsonify(status="error", message=f"批量发布失败，已回滚：{str(e)}"), 500
    finally:
        if db_conn:
            db_conn.close()

# 「草稿回退」接口        
@bp.route("/api/story/<int:story_id>/rollback/<int:local_page_id>", methods=["POST"])
def rollback_page(story_id, local_page_id):
    db_conn = None
    try:
        db_conn = get_db()
        db_conn.execute("BEGIN TRANSACTION")
        
        # 取草稿覆盖正式表
        draft = db_conn.execute(
            """SELECT draft_data FROM story_page_draft 
               WHERE story_id=? AND local_page_id=? 
               ORDER BY created_at DESC LIMIT 1""",
            (story_id, local_page_id)
        ).fetchone()
        
        if not draft:
            return jsonify(status="error", message="没有可回退的草稿"), 404
        
        page_data = json.loads(draft[0])
        db_conn.execute(
            """INSERT OR REPLACE INTO story_page
               (story_id, local_page_id, content, options, page_type, is_true_ending, pos_x, pos_y)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                story_id,
                local_page_id,
                page_data["content"],
                json.dumps(page_data["options"]),
                page_data["page_type"],
                page_data["is_true_ending"],
                page_data.get("pos_x", 50),
                page_data.get("pos_y", 50)
            )
        )
        
        db_conn.commit()
        return jsonify(status="rolled_back", message="已回退到草稿版本")
        
    except Exception as e:
        if db_conn:
            db_conn.rollback()
        return jsonify(status="error", message=f"回退失败：{str(e)}"), 500
    finally:
        if db_conn:
            db_conn.close()