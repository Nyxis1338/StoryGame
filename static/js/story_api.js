// story_api.js (async/await 版本)

const StoryAPI = {
    async getPage(storyId, pageId) {
        const res = await fetch(`/api/page/${storyId}/${pageId}?mode=edit`);
        if (!res.ok) throw new Error(`获取页面失败 (${res.status})`);
        return res.json();
    },

    async updatePage(globalId, data) {
        // data 只包含 content, page_type, 等，不再包含 options
        const res = await fetch(`/api/page/${globalId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`更新页面失败 (${res.status})`);
        return res.json();
    },

    async createPage(storyId, data) {
        // data 包含 page_id, content, options? 但选项由后续单独添加
        const res = await fetch(`/api/page/${storyId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`创建页面失败 (${res.status})`);
        return res.json();
    },

    async deletePage(globalId) {
        const res = await fetch(`/api/page/${globalId}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `删除页面失败 (${res.status})`);
        }
        return res.json();
    },

    async getGraph(storyId) {
        const res = await fetch(`/api/graph/${storyId}?mode=edit`);
        if (!res.ok) throw new Error(`获取图数据失败 (${res.status})`);
        return res.json();
    },

    async saveGraph(storyId, graphData) {
        const res = await fetch(`/api/story/${storyId}/graph`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(graphData)
        });
        if (!res.ok) throw new Error(`保存图数据失败 (${res.status})`);
        return res.json();
    },

    async getStoryStatus(storyId) {
        const res = await fetch(`/api/story/${storyId}`);
        if (!res.ok) throw new Error(`获取故事状态失败 (${res.status})`);
        return res.json();
    },

    async publishStory(storyId) {
        const res = await fetch(`/api/story/${storyId}/publish`, { method: 'POST' });
        if (!res.ok) throw new Error(`发布失败 (${res.status})`);
        return res.json();
    },

    // 新增：添加选项
    async addOption(storyId, data) {
        const res = await fetch(`/api/story/${storyId}/option`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`添加选项失败 (${res.status})`);
        return res.json();
    },

    // 新增：删除选项
    async removeOption(storyId, data) {
        const res = await fetch(`/api/story/${storyId}/option`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`删除选项失败 (${res.status})`);
        return res.json();
    },

    async updateOption(optionId, data) {
        const res = await fetch(`/api/option/${optionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`更新选项失败 (${res.status})`);
        return res.json();
    },

    // 新增到 story_api.js

    async createStory() {
        const res = await fetch('/api/story', { method: 'POST' });
        if (!res.ok) throw new Error(`创建故事失败 (${res.status})`);
        return res.json();
    },

    async getStories(params) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`/api/stories?${query}`);
        if (!res.ok) throw new Error(`获取故事列表失败 (${res.status})`);
        return res.json();
    },

    async updateStory(storyId, data) {
        const res = await fetch(`/api/story/${storyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`更新故事失败 (${res.status})`);
        return res.json();
    },

    async deleteStory(storyId) {
        const res = await fetch(`/api/story/${storyId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`删除故事失败 (${res.status})`);
        return res.json();
    },

    async restoreStory(storyId) {
        const res = await fetch(`/api/story/${storyId}/restore`, { method: 'POST' });
        if (!res.ok) throw new Error(`恢复故事失败 (${res.status})`);
        return res.json();
    },

    async permanentDeleteStory(storyId) {
        const res = await fetch(`/api/story/${storyId}/permanent`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`永久删除故事失败 (${res.status})`);
        return res.json();
    },

    async getTrash() {
        const res = await fetch('/api/trash');
        if (!res.ok) throw new Error(`获取回收站失败 (${res.status})`);
        return res.json();
    },

    async logout() {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (!res.ok) throw new Error(`退出登录失败 (${res.status})`);
        return res.json();
    },

};