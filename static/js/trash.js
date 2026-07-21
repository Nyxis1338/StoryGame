const { createApp } = Vue;

createApp({
    data() {
        return {
            deletedStories: [],
            loading: false
        };
    },
    methods: {
        fetchTrash() {
            this.loading = true;
            fetch('/api/trash')
                .then(res => res.json())
                .then(data => {
                    this.deletedStories = data;
                    this.loading = false;
                })
                .catch(() => {
                    this.loading = false;
                });
        },

        restore(storyId) {
            if (!confirm('确定恢复该故事吗？')) return;
            fetch(`/api/story/${storyId}/restore`, { method: 'POST' })
                .then(() => {
                    alert('✅ 恢复成功！');
                    this.fetchTrash();
                });
        },

        permanentDelete(storyId) {
            if (!confirm('⚠️ 确定永久删除此故事吗？\n此操作不可恢复！')) return;
            fetch(`/api/story/${storyId}/permanent`, { method: 'DELETE' })
                .then(() => {
                    alert('✅ 已永久删除');
                    this.fetchTrash();
                });
        },

        formatDate(iso) {
            if (!iso) return '未知';
            return new Date(iso).toLocaleString('zh-CN');
        }
    },
    mounted() {
        this.fetchTrash();
    },
    template: `
        <div style="max-width:800px; margin:40px auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h1 style="font-size:24px; color:#1a1a2e;">🗑️ 回收站</h1>
                <a href="/creator" style="color:#666; text-decoration:none; font-size:14px;">← 返回工作台</a>
            </div>

            <div v-if="loading" style="text-align:center; padding:20px; color:#999;">加载中...</div>
            <div v-else-if="deletedStories.length === 0" style="text-align:center; padding:60px 0; color:#999;">
                <p>📭 回收站为空</p>
            </div>
            <div v-else>
                <div v-for="story in deletedStories" :key="story.story_id" style="
                    background:white;
                    padding:16px 20px;
                    border-radius:12px;
                    margin-bottom:12px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.06);
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    flex-wrap:wrap;
                    gap:10px;
                ">
                    <div style="flex:1;">
                        <div style="font-weight:500; font-size:16px;">{{ story.story_name }}</div>
                        <div style="color:#888; font-size:14px;">{{ story.story_desc || '暂无简介' }}</div>
                        <div style="color:#aaa; font-size:12px;">删除于 {{ formatDate(story.delete_time) }}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button @click="restore(story.story_id)" style="
                            padding:6px 16px;
                            background:#28a745;
                            color:white;
                            border:none;
                            border-radius:6px;
                            cursor:pointer;
                            font-size:14px;
                        ">♻️ 恢复</button>
                        <button @click="permanentDelete(story.story_id)" style="
                            padding:6px 16px;
                            background:#ea4335;
                            color:white;
                            border:none;
                            border-radius:6px;
                            cursor:pointer;
                            font-size:14px;
                        ">🔥 永久删除</button>
                    </div>
                </div>
            </div>
        </div>
    `
}).mount('#app');