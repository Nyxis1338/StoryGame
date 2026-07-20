from flask import Blueprint, request, jsonify, abort
from models import db, Story, StoryPage
from sqlalchemy import or_
from utils.graph_helper import build_graph_data


api_bp = Blueprint('api', __name__, url_prefix='/api')


# ==========================================
# 辅助校验函数（核心防御层）
# ==========================================

def get_story_or_404(story_id):
    """获取故事并校验存在性（自动排除已删除）"""
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


# ==========================================
# 1. 故事列表（区分读者/创作者）
# ==========================================



@api_bp.route('/stories')
def get_stories():
    """获取故事列表 - 读者端只返回已发布，创作者端返回全部"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    status = request.args.get('status')
    q = request.args.get('q', '').strip()

    if status:
        query = Story.query.filter_by(is_published=(status == 'published'), is_deleted=0)
    else:
        query = Story.query.filter_by(is_published=1, is_deleted=0)

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

# ==========================================
# 2. 获取单个故事详情
# ==========================================

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


# ==========================================
# 3. 创建故事
# ==========================================

@api_bp.route('/story', methods=['POST'])
def create_story():
    """创建新故事（默认草稿状态）"""
    story = Story(
        story_name='未命名故事',
        story_desc='',
        is_published=0,
        has_draft=0
    )
    db.session.add(story)
    db.session.commit()

    # 自动创建起始页
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
# ==========================================
# 4. 删除/恢复故事
# ==========================================

@api_bp.route('/story/<int:story_id>', methods=['DELETE'])
def delete_story(story_id):
    """软删除故事（标记 is_deleted=1）"""
    story = get_story_or_404(story_id)
    story.is_deleted = 1
    story.update_time = datetime.utcnow()
    db.session.commit()
    return jsonify({'status': 'deleted'})

@api_bp.route('/story/<int:story_id>/restore', methods=['POST'])
def restore_story(story_id):
    """恢复已删除的故事"""
    story = Story.query.filter_by(story_id=story_id, is_deleted=1).first()
    if not story:
        abort(404, description="未找到已删除的故事")
    story.is_deleted = 0
    story.update_time = datetime.utcnow()
    db.session.commit()
    return jsonify({'status': 'restored'})


# ==========================================
# 5. 发布故事（原子覆盖）
# ==========================================

@api_bp.route('/story/<int:story_id>/publish', methods=['POST'])
def publish_story(story_id):
    """发布故事：将草稿内容覆盖到正式版"""
    story = get_story_or_404(story_id)
    pages = StoryPage.query.filter_by(story_id=story_id).all()

    # 校验：必须有起始页
    if not any(p.local_page_id == 1 for p in pages):
        abort(400, description="缺少起始页（ID=1），无法发布")

    # 执行原子覆盖
    for page in pages:
        if page.has_draft and page.draft_content is not None:
            # 再次校验跳转引用的有效性
            if page.draft_options:
                # 解析 JSON 字符串为列表
                import json
                draft_opts = json.loads(page.draft_options) if isinstance(page.draft_options, str) else page.draft_options
                validate_jump_targets(story_id, draft_opts)
                check_self_loop(page.local_page_id, draft_opts)

            page.content = page.draft_content
            page.options = page.draft_options
            page.draft_content = None
            page.draft_options = None
            page.has_draft = 0

    story.is_published = 1
    story.update_time = db.func.now()
    db.session.commit()

    return jsonify({'status': 'published'})


# ==========================================
# 6. 获取页面详情（区分读者/创作者模式）
# ==========================================


@api_bp.route('/page/<int:story_id>/<int:local_id>')
def get_page(story_id, local_id):
    """获取页面详情 - mode=edit 返回草稿，否则返回正式版"""
    # ✅ 校验时排除已删除
    story = Story.query.filter_by(story_id=story_id, is_deleted=0).first()
    if not story:
        abort(404, description="故事不存在")

    page = StoryPage.query.filter_by(
        story_id=story_id,
        local_page_id=local_id
    ).first()

    if not page:
        abort(404, description="该页面不存在")

    is_creator = request.args.get('mode') == 'edit'

    if is_creator:
        content = page.draft_content if page.draft_content is not None else page.content
        options_str = page.draft_options if page.draft_options is not None else page.options
    else:
        if story.is_published != 1:
            abort(403, description="故事暂未发布")
        content = page.content
        options_str = page.options

    import json
    try:
        options = json.loads(options_str) if options_str else []
    except (json.JSONDecodeError, TypeError):
        options = []

    return jsonify({
        'id': page.global_id,
        'local_id': page.local_page_id,
        'page_type': page.page_type,
        'content': content,
        'options': options,
        'is_true_ending': page.is_true_ending,
        'has_draft': page.has_draft
    })

# ==========================================
# 7. 更新页面（只写草稿区）
# ==========================================

@api_bp.route('/page/<int:page_id>', methods=['PUT'])
def update_page(page_id):
    """更新页面：只写入草稿区，不动正式版"""
    page = get_page_or_404(page_id)
    data = request.json

    if 'content' in data:
        page.draft_content = data['content']

    if 'options' in data:
        import json
        opts = data['options']
        # 如果前端传来的是列表，转为 JSON 字符串存储
        if isinstance(opts, list):
            page.draft_options = json.dumps(opts, ensure_ascii=False)
        elif isinstance(opts, str):
            # 如果已经是字符串，验证是否为合法 JSON
            try:
                json.loads(opts)
                page.draft_options = opts
            except:
                page.draft_options = '[]'
        else:
            page.draft_options = '[]'
        page.has_draft = 1

    if 'page_type' in data:
        page.page_type = data['page_type']

    if 'is_true_ending' in data:
        page.is_true_ending = 1 if data['is_true_ending'] else 0

    story = Story.query.get(page.story_id)
    story.update_time = datetime.utcnow()

    db.session.commit()
    return jsonify({'status': 'draft_saved'})


# ==========================================
# 8. 新增页面
# ==========================================

@api_bp.route('/page/<int:story_id>', methods=['POST'])
def create_page(story_id):
    """新增页面"""
    get_story_or_404(story_id)
    data = request.json
    new_local_id = data.get('local_page_id')

    if not new_local_id:
        abort(400, description="缺少 local_page_id")

    existing = StoryPage.query.filter_by(
        story_id=story_id,
        local_page_id=new_local_id
    ).first()
    if existing:
        abort(400, description="该页面ID已存在")

    import json
    options = data.get('options', [])
    if isinstance(options, list):
        options_str = json.dumps(options, ensure_ascii=False)
    else:
        options_str = '[]'

    page = StoryPage(
        story_id=story_id,
        local_page_id=new_local_id,
        page_type=data.get('page_type', 'process'),
        content=data.get('content', '# 新页面\n请编辑内容'),
        options=options_str,
        is_true_ending=data.get('is_true_ending', 0),
        pos_x=data.get('pos_x', 50),
        pos_y=data.get('pos_y', 50)
    )

    db.session.add(page)
    story = Story.query.get(story_id)
    story.update_time = datetime.utcnow()
    db.session.commit()

    return jsonify({'id': page.global_id})

# ==========================================
# 9. 删除页面（检查引用）
# ==========================================

@api_bp.route('/page/<int:page_id>', methods=['DELETE'])
def delete_page(page_id):
    """删除页面 - 检查是否被其他页面引用"""
    page = get_page_or_404(page_id)
    story_id = page.story_id
    local_id = page.local_page_id

    # 检查是否有其他页面的选项跳转到本页
    all_pages = StoryPage.query.filter_by(story_id=story_id).all()
    referrers = []
    import json

    for p in all_pages:
        if p.id == page_id:
            continue
        opts = json.loads(p.options) if isinstance(p.options, str) else p.options
        if opts:
            for opt in opts:
                if opt.get('jump_local_id') == local_id:
                    referrers.append(p.local_page_id)
                    break

    if referrers:
        return jsonify({
            'error': f'该页面被第 {", ".join(map(str, referrers))} 页引用，无法删除'
        }), 400

    db.session.delete(page)

    # 更新故事时间戳
    story = Story.query.get(story_id)
    story.update_time = db.func.now()

    db.session.commit()
    return jsonify({'status': 'deleted'})


# ==========================================
# 10. 获取图数据（ECharts 渲染）
# ==========================================

@api_bp.route('/graph/<int:story_id>')
def get_graph(story_id):
    """获取故事的图数据（ECharts 渲染）"""
    # 判断调用来源：mode=edit 表示创作者在后台编辑
    is_creator = request.args.get('mode') == 'edit'
    
    # 统一使用 build_graph_data，传入 mode 参数
    data = build_graph_data(story_id, mode='draft' if is_creator else 'published')
    
    return jsonify(data)