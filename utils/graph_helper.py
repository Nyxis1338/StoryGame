import json
from models import StoryPage, Story


def build_graph_data(story_id, mode='published'):
    story = Story.query.get(story_id)
    if not story:
        return {"nodes": [], "edges": []}
    
    pages = StoryPage.query.filter_by(story_id=story_id).all()
    nodes = []
    for page in pages:
        content = page.content if mode == 'published' else (page.draft_content or page.content)
        nodes.append({
            "id": page.local_page_id,
            "label": f"第{page.local_page_id}页",
            "pos_x": page.pos_x or 50,
            "pos_y": page.pos_y or 50,
            "value": (content[:30] + '...') if content else '',
            "itemStyle": {"color": "#91cc75" if page.is_true_ending else "#5470c6"},
            "page_type": page.page_type,
            "has_draft": page.has_draft
        })
    
    # 直接使用 story.edges
    edges = story.edges or []
    return {"nodes": nodes, "edges": edges}