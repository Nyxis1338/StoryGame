import json
from models import StoryPage, Story


def build_graph_data(story_id, mode='published'):
    """构建图数据供 ECharts 渲染"""
    # ✅ 只查询未删除的故事的页面
    pages = StoryPage.query.join(Story, StoryPage.story_id == Story.story_id).filter(
        StoryPage.story_id == story_id,
        Story.is_deleted == 0
    ).all()
    
    if not pages:
        return {"nodes": [], "edges": []}

    node_map = {p.local_page_id: p for p in pages}
    nodes, edges = [], []
    visited = set()
    stack = [1]

    while stack:
        current_id = stack.pop()

        if current_id in visited or current_id not in node_map:
            continue

        visited.add(current_id)
        page = node_map[current_id]

        if mode == 'draft':
            content = page.draft_content if page.draft_content is not None else page.content
            options_str = page.draft_options if page.draft_options is not None else page.options
        else:
            content = page.content
            options_str = page.options

        options = []
        if options_str:
            try:
                options = json.loads(options_str) if isinstance(options_str, str) else options_str
            except (json.JSONDecodeError, TypeError):
                options = []

        content_preview = content[:30] + "..." if content and len(content) > 30 else (content or "")

        nodes.append({
            "id": page.local_page_id,
            "name": f"第{page.local_page_id}页",
            "value": content_preview,
            "itemStyle": {
                "color": "#91cc75" if page.is_true_ending else "#5470c6"
            },
            "page_type": page.page_type,
            "has_draft": page.has_draft
        })

        if options:
            for opt in options:
                target_id = opt.get('jump_local_id')
                if target_id is None:
                    continue

                if target_id in node_map:
                    edges.append({
                        "source": page.local_page_id,
                        "target": target_id,
                        "label": opt.get('text', '')[:10] if opt.get('text') else ''
                    })

                    if target_id not in visited:
                        stack.append(target_id)

    return {"nodes": nodes, "edges": edges}