import json
from models import Story, StoryPage, StoryPageOption


def build_graph_data(story_id, mode='published'):
    """
    构建图数据（节点 + 边）
    - mode='published'：使用正式版 content
    - mode='draft'：使用草稿版 draft_content（若存在）
    """
    story = Story.query.get(story_id)
    if not story:
        return {"nodes": [], "edges": []}

    pages = StoryPage.query.filter_by(story_id=story_id).all()
    nodes = []
    for page in pages:
        content = page.content if mode == 'published' else (page.draft_content or page.content)
        nodes.append({
            "id": page.page_id,
            "label": f"第{page.page_id}页",
            "pos_x": page.pos_x or 50,
            "pos_y": page.pos_y or 50,
            "value": (content[:30] + '...') if content else '',
            "page_type": page.page_type,
            "has_draft": page.has_draft
        })

    options = StoryPageOption.query.filter_by(story_id=story_id).all()
    edges = []
    for opt in options:
        edges.append({
            "option_id": opt.option_id,  # ✅ 新增
            "source": opt.source_page,
            "target": opt.target_page,
            "label": opt.option_text,
            "sourceAnchor": opt.source_anchor,
            "targetAnchor": opt.target_anchor
        })

    return {"nodes": nodes, "edges": edges}