# ============================================================
# 导入依赖
# ============================================================

from flask import Blueprint, request, jsonify, abort, session
from models import db, Story, StoryPage, AdminConfig, StoryPageOption
from sqlalchemy import or_
from utils.graph_helper import build_graph_data
from datetime import datetime, timezone
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


def get_page_or_404(global_id, check_story_id=None):
    """获取页面并校验归属"""
    page = StoryPage.query.get(global_id)
    if not page:
        abort(404, description="页面不存在")
    if check_story_id and page.story_id != check_story_id:
        abort(403, description="无权操作此页面")
    return page


def validate_jump_targets(story_id, options):
    """校验选项中的 jump_local_id 是否真实存在（迁移后不再使用）"""
    # 保留以防旧代码调用
    if not options:
        return options
    valid_ids = {p.page_id for p in StoryPage.query.filter_by(story_id=story_id).all()}
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
    """将 options JSON 字符串解析为 Python 列表（迁移后保留兼容）"""
    if not options_str:
        return []
    try:
        return json.loads(options_str) if isinstance(options_str, str) else options_str
    except (json.JSONDecodeError, TypeError):
        return []


def stringify_options(options_list):
    """将 Python 列表转为 JSON 字符串（迁移后保留兼容）"""
    if not options_list:
        return '[]'
    return json.dumps(options_list, ensure_ascii=False)


# ============================================================
# 认证相关 API（不变）
# ============================================================

@api_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    password = data.get('password', '').strip()
    config = AdminConfig.query.first()
    if config and config.admin_pwd == hashlib.md5(password.encode()).hexdigest():
        session['authenticated'] = True
        return jsonify({'status': 'success'})
    return jsonify({'error': '密码错误'}), 401


@api_bp.route('/auth/check')
def check_auth():
    return jsonify({'authenticated': session.get('authenticated', False)})


@api_bp.route('/auth/logout', methods=['POST'])
def logout():
    session.pop('authenticated', None)
    return jsonify({'status': 'logged_out'})


@api_bp.route('/auth/change_password', methods=['POST'])
def change_password():
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401
    data = request.json
    old = data.get('old_password', '').strip()
    new = data.get('new_password', '').strip()
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
# 故事管理 API（部分修改，去除 edges 相关）
# ============================================================

@api_bp.route('/stories')
def get_stories():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    status = request.args.get('status')
    q = request.args.get('q', '').strip()

    query = Story.query.filter_by(is_deleted=0)
    if status == 'all':
        pass
    elif status == 'published':
        query = query.filter_by(is_published=1)
    elif status == 'draft':
        query = query.filter_by(is_published=0)
    else:
        # 无 status 时默认返回已发布（读者端）
        query = query.filter_by(is_published=1)

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


@api_bp.route('/story/<int:story_id>', methods=['PUT'])
def update_story(story_id):
    """更新故事名称和描述"""
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401
    story = get_story_or_404(story_id)
    data = request.json
    if 'story_name' in data:
        story.story_name = data['story_name']
    if 'story_desc' in data:
        story.story_desc = data['story_desc']
    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'status': 'success'})


@api_bp.route('/story/<int:story_id>')
def get_story_detail(story_id):
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
    story = Story(
        story_name='未命名故事',
        story_desc='',
        is_published=0,
        is_deleted=0
    )
    db.session.add(story)
    db.session.commit()
    # 自动创建起始页 (page_id=1)
    start_page = StoryPage(
        story_id=story.story_id,
        page_id=1,
        page_type='process',
        content='# 新故事\n请开始你的创作...',
        pos_x=50,
        pos_y=50
    )
    db.session.add(start_page)
    db.session.commit()
    return jsonify({'story_id': story.story_id})


@api_bp.route('/story/<int:story_id>', methods=['DELETE'])
def delete_story(story_id):
    story = get_story_or_404(story_id)
    story.is_deleted = 1
    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'status': 'deleted'})


@api_bp.route('/story/<int:story_id>/restore', methods=['POST'])
def restore_story(story_id):
    story = Story.query.filter_by(story_id=story_id, is_deleted=1).first()
    if not story:
        abort(404, description="未找到已删除的故事")
    story.is_deleted = 0
    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'status': 'restored'})


@api_bp.route('/story/<int:story_id>/publish', methods=['POST'])
def publish_story(story_id):
    story = get_story_or_404(story_id)
    pages = StoryPage.query.filter_by(story_id=story_id).all()
    # 校验：必须有起始页（page_id=1）
    if not any(p.page_id == 1 for p in pages):
        abort(400, description="缺少起始页（ID=1），无法发布")
    for page in pages:
        if page.has_draft and page.draft_content is not None:
            page.content = page.draft_content
            page.draft_content = None
            page.has_draft = 0
    story.is_published = 1
    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'status': 'published'})


# ============================================================
# 页面管理 API（迁移后新接口）
# ============================================================

@api_bp.route('/page/<int:story_id>/<int:page_id>')
def get_page(story_id, page_id):
    story = get_story_or_404(story_id)
    page = StoryPage.query.filter_by(story_id=story_id, page_id=page_id).first()
    if not page:
        abort(404, description="该页面不存在")

    # 获取该页面的所有选项（从 story_page_options）
    options = StoryPageOption.query.filter_by(story_id=story_id, source_page=page_id).all()
    options_list = [{'text': opt.option_text, 'jump_local_id': opt.target_page} for opt in options]

    is_creator = request.args.get('mode') == 'edit'
    content = page.draft_content if (is_creator and page.draft_content is not None) else page.content

    return jsonify({
        'id': page.global_id,
        'local_id': page.page_id,
        'page_type': page.page_type,
        'content': content,
        'options': options_list,
        'is_true_ending': (page.page_type == 'true_ending'),
        'has_draft': page.has_draft,
        'published_content': page.content,
        'published_options': []  # 不再需要
    })


@api_bp.route('/page/<int:global_id>', methods=['PUT'])
def update_page(global_id):
    page = get_page_or_404(global_id)
    data = request.json

    if 'content' in data:
        page.draft_content = data['content']
        page.has_draft = 1

    if 'page_type' in data:
        page.page_type = data['page_type']


    if 'pos_x' in data:
        page.pos_x = data['pos_x']
    if 'pos_y' in data:
        page.pos_y = data['pos_y']

    story = Story.query.get(page.story_id)
    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'status': 'draft_saved'})


@api_bp.route('/page/<int:story_id>', methods=['POST'])
def create_page(story_id):
    get_story_or_404(story_id)
    data = request.json
    new_page_id = data.get('page_id')

    if not new_page_id:
        abort(400, description="缺少 page_id")

    existing = StoryPage.query.filter_by(story_id=story_id, page_id=new_page_id).first()
    if existing:
        abort(400, description="该页面ID已存在")

    page = StoryPage(
        story_id=story_id,
        page_id=new_page_id,
        page_type=data.get('page_type', 'process'),
        content=data.get('content', '# 新页面\n请编辑内容'),
        pos_x=data.get('pos_x', 50),
        pos_y=data.get('pos_y', 50)
    )
    db.session.add(page)
    story = Story.query.get(story_id)
    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'id': page.global_id})


@api_bp.route('/page/<int:global_id>', methods=['DELETE'])
def delete_page(global_id):
    page = get_page_or_404(global_id)
    story_id = page.story_id
    page_id = page.page_id

    # 删除所有以该页面为 source 或 target 的选项
    StoryPageOption.query.filter(
        (StoryPageOption.story_id == story_id) &
        ((StoryPageOption.source_page == page_id) | (StoryPageOption.target_page == page_id))
    ).delete()

    db.session.delete(page)
    story = Story.query.get(story_id)
    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'status': 'deleted'})


# ============================================================
# 图数据 API
# ============================================================

@api_bp.route('/graph/<int:story_id>')
def get_graph(story_id):
    is_creator = request.args.get('mode') == 'edit'
    mode = 'draft' if is_creator else 'published'
    data = build_graph_data(story_id, mode)
    return jsonify(data)


@api_bp.route('/story/<int:story_id>/graph', methods=['PUT'])
def save_graph(story_id):
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401

    story = get_story_or_404(story_id)
    data = request.json

    # 1. 更新节点坐标
    nodes = data.get('nodes', [])
    for node in nodes:
        page = StoryPage.query.filter_by(story_id=story_id, page_id=node['id']).first()
        if page:
            page.pos_x = node.get('pos_x', page.pos_x)
            page.pos_y = node.get('pos_y', page.pos_y)

    # 2. 更新边（全量替换）
    edges = data.get('edges', [])
    # 删除该故事所有现有边
    StoryPageOption.query.filter_by(story_id=story_id).delete()
    for edge in edges:
        opt = StoryPageOption(
            story_id=story_id,
            source_page=edge['source'],
            target_page=edge['target'],
            option_text=edge.get('label', ''),
            source_anchor=edge.get('sourceAnchor', 'right'),
            target_anchor=edge.get('targetAnchor', 'left')
        )
        db.session.add(opt)

    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'status': 'success'})


# ============================================================
# 分支选项管理（独立 API）
# ============================================================

@api_bp.route('/story/<int:story_id>/option', methods=['POST'])
def add_option(story_id):
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401
    data = request.json
    opt = StoryPageOption(
        story_id=story_id,
        source_page=data['source_page'],
        target_page=data['target_page'],
        option_text=data['option_text'],
        source_anchor=data.get('source_anchor', 'right'),
        target_anchor=data.get('target_anchor', 'left')
    )
    db.session.add(opt)
    story = Story.query.get(story_id)
    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'option_id': opt.option_id})


@api_bp.route('/story/<int:story_id>/option', methods=['DELETE'])
def remove_option(story_id):
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401
    data = request.json
    source = data['source_page']
    target = data['target_page']
    # 删除两个方向的记录（防止用户点击顺序相反）
    opts = StoryPageOption.query.filter(
        StoryPageOption.story_id == story_id,
        ((StoryPageOption.source_page == source) & (StoryPageOption.target_page == target)) |
        ((StoryPageOption.source_page == target) & (StoryPageOption.target_page == source))
    ).all()
    if not opts:
        abort(404, description="未找到该选项")
    for opt in opts:
        db.session.delete(opt)
    story = Story.query.get(story_id)
    story.update_time = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'status': 'deleted'})


# ============================================================
# 回收站 API
# ============================================================

@api_bp.route('/trash', methods=['GET'])
def get_trash():
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
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401
    story = Story.query.filter_by(story_id=story_id, is_deleted=1).first()
    if not story:
        abort(404, description="未找到已删除的故事")
    db.session.delete(story)
    db.session.commit()
    return jsonify({'status': 'permanently_deleted'})


# ============================================================
# 数据导入/导出
# ============================================================

@api_bp.route('/backup/export', methods=['GET'])
def export_data():
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401

    stories = Story.query.filter_by(is_deleted=0).all()
    export_data = []

    for s in stories:
        pages = StoryPage.query.filter_by(story_id=s.story_id).all()
        options = StoryPageOption.query.filter_by(story_id=s.story_id).all()
        story_data = {
            'story': {
                'story_id': s.story_id,
                'story_name': s.story_name,
                'story_desc': s.story_desc,
                'is_published': s.is_published,
                'create_time': s.create_time.isoformat(),
                'update_time': s.update_time.isoformat(),
            },
            'pages': [{
                'page_id': p.page_id,
                'page_type': p.page_type,
                'content': p.content,
                'draft_content': p.draft_content,
                'has_draft': p.has_draft,
                'pos_x': p.pos_x,
                'pos_y': p.pos_y
            } for p in pages],
            'options': [{
                'source_page': o.source_page,
                'target_page': o.target_page,
                'option_text': o.option_text,
                'source_anchor': o.source_anchor,
                'target_anchor': o.target_anchor
            } for o in options]
        }
        export_data.append(story_data)

    response = jsonify(export_data)
    response.headers['Content-Disposition'] = 'attachment; filename=backup.json'
    response.headers['Content-Type'] = 'application/json; charset=utf-8'
    return response


@api_bp.route('/backup/import', methods=['POST'])
def import_data():
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401

    data = request.json
    if not isinstance(data, list):
        return jsonify({'error': '数据格式无效，应为数组'}), 400

    try:
        for item in data:
            story_data = item.get('story')
            pages_data = item.get('pages', [])
            options_data = item.get('options', [])

            existing = Story.query.filter_by(story_id=story_data['story_id']).first()
            if existing:
                db.session.delete(existing)
                db.session.commit()

            story = Story(
                story_id=story_data['story_id'],
                story_name=story_data['story_name'],
                story_desc=story_data['story_desc'],
                is_published=story_data.get('is_published', 0),
                create_time=datetime.fromisoformat(story_data['create_time']),
                update_time=datetime.fromisoformat(story_data['update_time']),
            )
            db.session.add(story)
            db.session.flush()

            for p in pages_data:
                page = StoryPage(
                    story_id=story.story_id,
                    page_id=p['page_id'],
                    page_type=p.get('page_type', 'process'),
                    content=p.get('content', ''),
                    draft_content=p.get('draft_content'),
                    has_draft=p.get('has_draft', 0),
                    pos_x=p.get('pos_x', 50),
                    pos_y=p.get('pos_y', 50)
                )
                db.session.add(page)

            for o in options_data:
                opt = StoryPageOption(
                    story_id=story.story_id,
                    source_page=o['source_page'],
                    target_page=o['target_page'],
                    option_text=o['option_text'],
                    source_anchor=o.get('source_anchor', 'right'),
                    target_anchor=o.get('target_anchor', 'left')
                )
                db.session.add(opt)

        db.session.commit()
        return jsonify({'imported': len(data)})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500


# ============================================================
# 锚点 连线
# ============================================================
@api_bp.route('/option/<int:option_id>', methods=['PUT'])
def update_option(option_id):
    """更新连线的锚点或标签"""
    if not session.get('authenticated'):
        return jsonify({'error': '未登录'}), 401
    opt = StoryPageOption.query.get_or_404(option_id)
    data = request.json
    if 'source_anchor' in data:
        opt.source_anchor = data['source_anchor']
    if 'target_anchor' in data:
        opt.target_anchor = data['target_anchor']
    if 'option_text' in data:
        opt.option_text = data['option_text']
    db.session.commit()
    return jsonify({'status': 'success'})