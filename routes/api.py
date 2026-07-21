# ============================================================
# 导入依赖
# ============================================================

from flask import Blueprint, request, jsonify, abort, session
from models import db, Story, StoryPage, AdminConfig
from sqlalchemy import or_
from utils.graph_helper import build_graph_data
from datetime import datetime
import json
import hashlib

api_bp = Blueprint('api', __name__, url_prefix='/api')


# ============================================================
# 辅助工具函数
# ============================================================

def get_story_or_404(story_id):
    """获取故事，自动排除已删除（is_deleted=0）"""
    story = Story.query.filter_by(story_id=story_id, is_deleted=0).first()
    if not story:
        abort(404, description="故事不存在")
    return story


def get_page_or_404(page_id, check_story_id=None):
    """获取页面并校验归属"""
    page = StoryPage.query.get(page_id)
    if not page:
        abort(404, description="页面不存在")
    if check_story_id and page.story_id != check_story_id:
        abort(403, description="无权操作此页面")
    return page


def validate_jump_targets(story_id, options):
    """校验选项中的 jump_local_id 是否真实存在"""
    if not options:
        return options
    valid_ids = {p.local_page_id for p in StoryPage.query.filter_by(story_id=story_id).all()}
    for opt in options:
        target = opt.get('jump_local_id')
        if target is not None and target not in valid_ids:
            abort(400, description=f"无效跳转目标: {target}")
    return options


def check_self_loop(page_local_id, options):
    """阻止页面跳转到自己（防止死循环）"""
    for opt in options:
        if opt.get('jump_local_id') == page_local_id:
            abort(400, description="禁止页面跳转至自身")


def parse_options(options_str):
    """将 options JSON 字符串解析为 Python 列表"""
    if not options_str:
        return []
    try:
        return json.loads(options_str) if isinstance(options_str, str) else options_str
    except (json.JSONDecodeError, TypeError):
        return []


def stringify_options(options_list):
    """将 Python 列表转为 JSON 字符串"""
    if not options_list:
        return '[]'
    return json.dumps(options_list, ensure_ascii=False)


# ============================================================
# 认证相关 API
# ============================================================

@api_bp.route('/auth/login', methods=['POST'])
def login():
    """管理员登录 - 使用 MD5 验证"""
    data = request.json
    # 双重清理：strip() 去除首尾空白，包括换行符
    password = data.get('password', '').strip()
    
    # 调试日志（确认清理后的密码）
    print(f"清理后密码: '{password}'")
    print(f"MD5: {hashlib.md5(password.encode()).hexdigest()}")
    
    config = AdminConfig.query.first()
    if config and config.admin_pwd == hashlib.md5(password.encode()).hexdigest():
        session['authenticated'] = True
        return jsonify({'status': 'success'})
    return jsonify({'error': '密码错误'}), 401


@api_bp.route('/auth/check')
def check_auth():
    """检查登录状态"""
    return jsonify({'authenticated': session.get('authenticated', False)})


@api_bp.route('/auth/logout', methods=['POST'])
def logout():
    """退出登录"""
    session.pop('authenticated', None)
    return jsonify({'status': 'logged_out'})


@api_bp.route('/auth/change_password', methods=['POST'])
def change_password():
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401

    data = request.json
    old = data.get('old_password', '').strip()   # ✅ 去除首尾空白
    new = data.get('new_password', '').strip()   # ✅ 去除首尾空白

    if not old or not new:
        return jsonify({'error': '密码不能为空'}), 400

    config = AdminConfig.query.first()
    if not config:
        return jsonify({'error': '配置不存在'}), 404

    if config.admin_pwd != hashlib.md5(old.encode()).hexdigest():
        return jsonify({'error': '当前密码错误'}), 400

    config.admin_pwd = hashlib.md5(new.encode()).hexdigest()
    db.session.commit()
    return jsonify({'status': 'success'})


# ============================================================
# 故事管理 API
# ============================================================

@api_bp.route('/stories')
def get_stories():
    """
    获取故事列表
    - 读者端（无 status 参数）：只返回已发布且未删除的故事
    - 创作者端（有 status 参数）：按状态筛选
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    status = request.args.get('status')
    q = request.args.get('q', '').strip()

    # 基础查询：只查未删除的
    if status:
        query = Story.query.filter_by(is_published=(status == 'published'), is_deleted=0)
    else:
        query = Story.query.filter_by(is_published=1, is_deleted=0)

    # 搜索（只搜故事名）
    if q:
        query = query.filter(Story.story_name.contains(q))

    query = query.order_by(Story.update_time.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'items': [{
            'story_id': s.story_id,
            'story_name': s.story_name,
            'story_desc': s.story_desc,
            'is_published': s.is_published,
            'create_time': s.create_time.isoformat() if s.create_time else None,
            'update_time': s.update_time.isoformat() if s.update_time else None
        } for s in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@api_bp.route('/story/<int:story_id>')
def get_story_detail(story_id):
    """获取故事详情"""
    story = get_story_or_404(story_id)
    return jsonify({
        'story_id': story.story_id,
        'story_name': story.story_name,
        'story_desc': story.story_desc,
        'is_published': story.is_published,
        'create_time': story.create_time.isoformat() if story.create_time else None,
        'update_time': story.update_time.isoformat() if story.update_time else None
    })


@api_bp.route('/story', methods=['POST'])
def create_story():
    """创建新故事（默认草稿状态），自动创建起始页"""
    story = Story(
        story_name='未命名故事',
        story_desc='',
        is_published=0,
        has_draft=0,
        is_deleted=0
    )
    db.session.add(story)
    db.session.commit()

    # 自动创建起始页 (local_page_id=1)
    start_page = StoryPage(
        story_id=story.story_id,
        local_page_id=1,
        page_type='start',
        content='# 新故事\n请开始你的创作...',
        options='[]',
        is_true_ending=0,
        pos_x=50,
        pos_y=50
    )
    db.session.add(start_page)
    db.session.commit()

    return jsonify({'story_id': story.story_id})


@api_bp.route('/story/<int:story_id>', methods=['DELETE'])
def delete_story(story_id):
    """软删除故事（标记 is_deleted=1），数据保留可恢复"""
    story = get_story_or_404(story_id)
    story.is_deleted = 1
    story.update_time = datetime.utcnow()
    db.session.commit()
    return jsonify({'status': 'deleted'})


@api_bp.route('/story/<int:story_id>/restore', methods=['POST'])
def restore_story(story_id):
    """恢复已软删除的故事"""
    story = Story.query.filter_by(story_id=story_id, is_deleted=1).first()
    if not story:
        abort(404, description="未找到已删除的故事")
    story.is_deleted = 0
    story.update_time = datetime.utcnow()
    db.session.commit()
    return jsonify({'status': 'restored'})


@api_bp.route('/story/<int:story_id>/publish', methods=['POST'])
def publish_story(story_id):
    """
    发布故事：将草稿内容原子覆盖到正式版
    校验：必须有起始页(local_page_id=1)，校验跳转合法性
    """
    story = get_story_or_404(story_id)
    pages = StoryPage.query.filter_by(story_id=story_id).all()

    # 校验：必须有起始页
    if not any(p.local_page_id == 1 for p in pages):
        abort(400, description="缺少起始页（ID=1），无法发布")

    # 执行原子覆盖
    for page in pages:
        if page.has_draft and page.draft_content is not None:
            # 校验跳转引用的有效性
            if page.draft_options:
                draft_opts = parse_options(page.draft_options)
                validate_jump_targets(story_id, draft_opts)
                check_self_loop(page.local_page_id, draft_opts)

            page.content = page.draft_content
            page.options = page.draft_options
            page.draft_content = None
            page.draft_options = None
            page.has_draft = 0

    story.is_published = 1
    story.update_time = datetime.utcnow()
    db.session.commit()

    return jsonify({'status': 'published'})


# ============================================================
# 页面管理 API
# ============================================================

@api_bp.route('/page/<int:story_id>/<int:local_id>')
def get_page(story_id, local_id):
    """
    获取页面详情
    - mode=edit（创作者）：返回草稿内容（优先 draft_content）
    - 普通访问（读者）：只返回正式版，且故事必须已发布
    """
    story = get_story_or_404(story_id)

    page = StoryPage.query.filter_by(
        story_id=story_id,
        local_page_id=local_id
    ).first()

    if not page:
        abort(404, description="该页面不存在")

    is_creator = request.args.get('mode') == 'edit'

    if is_creator:
        # 创作者：优先返回草稿，若无则回退正式版
        content = page.draft_content if page.draft_content is not None else page.content
        options_str = page.draft_options if page.draft_options is not None else page.options
        options = parse_options(options_str)

        return jsonify({
            'id': page.global_id,
            'local_id': page.local_page_id,
            'page_type': page.page_type,
            'content': content,
            'options': options,
            'is_true_ending': page.is_true_ending,
            'has_draft': page.has_draft,
            'published_content': page.content,
            'published_options': parse_options(page.options)
        })
    else:
        # 读者：只读正式版
        if story.is_published != 1:
            abort(403, description="故事暂未发布")

        return jsonify({
            'id': page.global_id,
            'local_id': page.local_page_id,
            'page_type': page.page_type,
            'content': page.content,
            'options': parse_options(page.options),
            'is_true_ending': page.is_true_ending
        })


@api_bp.route('/page/<int:page_id>', methods=['PUT'])
def update_page(page_id):
    """
    更新页面：只写入草稿区（draft_content / draft_options）
    不影响读者看到的正式版（content / options）
    """
    page = get_page_or_404(page_id)
    data = request.json

    if 'content' in data:
        page.draft_content = data['content']

    if 'options' in data:
        opts = data['options']
        if isinstance(opts, str):
            opts = parse_options(opts)
        # 校验跳转合法性
        validate_jump_targets(page.story_id, opts)
        check_self_loop(page.local_page_id, opts)
        page.draft_options = stringify_options(opts)
        page.has_draft = 1

    if 'page_type' in data:
        page.page_type = data['page_type']

    if 'is_true_ending' in data:
        page.is_true_ending = 1 if data['is_true_ending'] else 0

    # 更新故事时间戳
    story = Story.query.get(page.story_id)
    story.update_time = datetime.utcnow()

    db.session.commit()
    return jsonify({'status': 'draft_saved'})


@api_bp.route('/page/<int:story_id>', methods=['POST'])
def create_page(story_id):
    """新增页面"""
    get_story_or_404(story_id)
    data = request.json
    new_local_id = data.get('local_page_id')

    if not new_local_id:
        abort(400, description="缺少 local_page_id")

    # 检查是否已存在
    existing = StoryPage.query.filter_by(
        story_id=story_id,
        local_page_id=new_local_id
    ).first()
    if existing:
        abort(400, description="该页面ID已存在")

    options = data.get('options', [])
    if options:
        if isinstance(options, str):
            options = parse_options(options)
        validate_jump_targets(story_id, options)

    page = StoryPage(
        story_id=story_id,
        local_page_id=new_local_id,
        page_type=data.get('page_type', 'process'),
        content=data.get('content', '# 新页面\n请编辑内容'),
        options=stringify_options(options),
        is_true_ending=data.get('is_true_ending', 0),
        pos_x=data.get('pos_x', 50),
        pos_y=data.get('pos_y', 50)
    )

    db.session.add(page)

    story = Story.query.get(story_id)
    story.update_time = datetime.utcnow()

    db.session.commit()
    return jsonify({'id': page.global_id})


@api_bp.route('/page/<int:page_id>', methods=['DELETE'])
def delete_page(page_id):
    """
    删除页面 - 检查是否被其他页面引用
    如果有其他页面的选项跳转到本页，则拒绝删除
    """
    page = get_page_or_404(page_id)
    story_id = page.story_id
    local_id = page.local_page_id

    # 检查是否有其他页面的选项跳转到本页
    all_pages = StoryPage.query.filter_by(story_id=story_id).all()
    referrers = []

    for p in all_pages:
        if p.global_id == page.global_id:
            continue
        opts = parse_options(p.options)
        for opt in opts:
            if opt.get('jump_local_id') == local_id:
                referrers.append(p.local_page_id)
                break

    if referrers:
        return jsonify({
            'error': f'该页面被第 {", ".join(map(str, referrers))} 页引用，无法删除'
        }), 400

    db.session.delete(page)

    story = Story.query.get(story_id)
    story.update_time = datetime.utcnow()

    db.session.commit()
    return jsonify({'status': 'deleted'})


# ============================================================
# 图数据 API（ECharts 渲染）
# ============================================================

@api_bp.route('/graph/<int:story_id>')
def get_graph(story_id):
    """
    获取故事的图数据（节点+边）
    - mode=edit：创作者视角（优先显示草稿内容）
    - 普通访问：读者视角（只显示正式版）
    """
    is_creator = request.args.get('mode') == 'edit'
    mode = 'draft' if is_creator else 'published'
    data = build_graph_data(story_id, mode)
    return jsonify(data)


# ============================================================
# 回收站 API
# ============================================================

@api_bp.route('/trash', methods=['GET'])
def get_trash():
    """获取所有已软删除的故事"""
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401
    stories = Story.query.filter_by(is_deleted=1).all()
    return jsonify([{
        'story_id': s.story_id,
        'story_name': s.story_name,
        'story_desc': s.story_desc,
        'delete_time': s.update_time.isoformat() if s.update_time else None
    } for s in stories])


@api_bp.route('/story/<int:story_id>/permanent', methods=['DELETE'])
def permanent_delete_story(story_id):
    """永久删除故事（不可恢复）"""
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401
    story = Story.query.filter_by(story_id=story_id, is_deleted=1).first()
    if not story:
        abort(404, description="未找到已删除的故事")
    db.session.delete(story)
    db.session.commit()
    return jsonify({'status': 'permanently_deleted'})