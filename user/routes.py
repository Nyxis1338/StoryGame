from flask import Blueprint, render_template, request, abort, jsonify, session, redirect, url_for
import sqlite3
import json
import config

bp = Blueprint("user", __name__, url_prefix="")

def get_db():
    return sqlite3.connect(config.DB_PATH)

# ===== 原有读者路由（完全保留）=====
@bp.route("/")
def story_list():
    """首页：故事列表（原story_list.html）"""
    with get_db() as db:
        stories = db.execute(
            "SELECT story_id, story_name, story_desc FROM story"
        ).fetchall()
    return render_template("index.html", stories=stories)

@bp.route("/story/<int:story_id>/page/<int:local_page_id>")
def story_page(story_id, local_page_id):
    # ===== 最强调试：如果这行不打印，说明代码没保存或者路由没注册 =====
    print(f"\n\n🚨🚨🚨 进入 story_page 函数！ Story: {story_id}, Page: {local_page_id} 🚨🚨🚨\n\n")
    
    try:
        db = get_db()
        # 查故事列表（给左侧栏用）
        stories = db.execute("SELECT story_id, story_name, story_desc FROM story").fetchall()
        print(f"[DEBUG] 查到 {len(stories)} 个故事")
        
        # 查当前页
        page = db.execute(
            """SELECT content, options, page_type, is_true_ending 
               FROM story_page 
               WHERE story_id=? AND local_page_id=?""",
            (story_id, local_page_id)
        ).fetchone()

        if not page:
            print(f"[ERROR] 页面不存在: story={story_id}, page={local_page_id}")
            return "Page not found in DB", 404

        content, options_json, page_type, is_true_ending = page
        print(f"[DEBUG] 数据库内容: page_type={page_type}, is_true_ending={is_true_ending}")
        print(f"[DEBUG] 正文前20字: {content[:20]}")

        # 记录session
        session["last_story_id"] = story_id
        session["last_page_id"] = local_page_id

        # 渲染page.html
        print(f"[DEBUG] 准备渲染 page.html")
        return render_template(
            "page.html",
            stories=stories,
            story_id=story_id,
            content=content,
            options=json.loads(options_json) if options_json else [],
            page_type=page_type,
            is_true_ending=is_true_ending
        )
    except Exception as e:
        print(f"[FATAL ERROR] story_page 崩溃: {e}")
        import traceback
        traceback.print_exc()
        return "Internal Server Error", 500


@bp.route("/ending")
def ending():
    # 1. 先查故事列表，确保左侧栏有数据
    stories = []
    try:
        db = get_db()
        stories = db.execute("SELECT story_id, story_name, story_desc FROM story").fetchall()
        print(f"[DEBUG] 结局页加载，story表数据量：{len(stories)}")  # 你已经看到这行日志，说明这里没问题
    except Exception as e:
        print(f"[ERROR] 查询story表失败：{e}")
        stories = []

    story_id = request.args.get("story_id", type=int)
    print(f"[DEBUG] 访问/ending，story_id={story_id}")

    # 2. 防直链校验
    if session.get("last_story_id") != story_id:
        print("[DEBUG] 判定为非法访问，渲染invalid页面")
        return render_template("ending.html", invalid=True, stories=stories)

    # 3. 查询结局内容（重点！确保SQL正确）
    content = ""
    is_true_ending = 0
    try:
        db = get_db()
        # ✅ 正确的SQL：查指定story_id的所有结局页，优先取真结局
        page = db.execute(
            """SELECT content, is_true_ending 
               FROM story_page 
               WHERE story_id=? AND page_type='ending'
               ORDER BY is_true_ending DESC LIMIT 1""",
            (story_id,)
        ).fetchone()
        if page:
            content, is_true_ending = page
            print(f"[DEBUG] 找到结局，is_true_ending={is_true_ending}")
        else:
            print(f"[ERROR] 未找到story_id={story_id}的结局页")
    except Exception as e:
        print(f"[ERROR] 查询结局页失败：{e}")

    # 4. 渲染模板，不管有没有找到结局，都返回页面，不崩溃
    return render_template(
        "ending.html",
        content=content,
        is_true_ending=is_true_ending,
        invalid=False,
        stories=stories
    )

# ===== 新增AJAX接口（供无刷新翻页用）=====
@bp.route("/api/story/<int:story_id>/page/<int:local_page_id>")
def api_get_page(story_id, local_page_id):
    """返回单页JSON数据，供AJAX调用"""
    with get_db() as db:
        page = db.execute(
            """SELECT content, options, page_type, is_true_ending 
               FROM story_page 
               WHERE story_id=? AND local_page_id=?""",
            (story_id, local_page_id)
        ).fetchone()
    
    if not page:
        return jsonify({"error": "Page not found"}), 404
    
    content, options_json, page_type, is_true_ending = page
    return jsonify({
        "content": content,
        "options": json.loads(options_json) if options_json else [],
        "page_type": page_type,
        "is_true_ending": is_true_ending
    })