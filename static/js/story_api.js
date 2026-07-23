
const StoryAPI = {
    // 获取页面详情
    getPage(storyId, localId) {
        return fetch(`/api/page/${storyId}/${localId}?mode=edit`).then(res => res.json());
    },
    // 更新页面（草稿）
    updatePage(pageId, data) {
        return fetch(`/api/page/${pageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(res => res.json());
    },
    // 创建新页面
    createPage(storyId, data) {
        return fetch(`/api/page/${storyId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(res => res.json());
    },
    // 删除页面
    deletePage(pageId) {
        return fetch(`/api/page/${pageId}`, { method: 'DELETE' }).then(res => res.json());
    },
    // 获取图数据
    getGraph(storyId) {
        return fetch(`/api/graph/${storyId}?mode=edit`).then(res => res.json());
    },
    // 保存图数据（节点位置、连线）
    saveGraph(storyId, graphData) {
        return fetch(`/api/story/${storyId}/graph`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(graphData)
        }).then(res => res.json());
    },
    // 获取故事状态
    getStoryStatus(storyId) {
        return fetch(`/api/story/${storyId}`).then(res => res.json());
    },
    // 发布故事
    publishStory(storyId) {
        return fetch(`/api/story/${storyId}/publish`, { method: 'POST' }).then(res => res.json());
    }
};