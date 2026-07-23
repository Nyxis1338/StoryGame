const { createApp } = Vue;

createApp({
    data() {
        return {
            stories: [],
            page: 1,
            perPage: 10,
            loading: false,
            hasMore: true,
            keyword: '',
            filterStatus: 'all'
        };
    },
    methods: {
        fetchStories(reset = false) {
            if (this.loading) return;
            if (reset) {
                this.page = 1;
                this.hasMore = true;
                this.stories = [];
            }
            if (!this.hasMore) return;

            this.loading = true;
            let url = `/api/stories?page=${this.page}&per_page=${this.perPage}`;
            if (this.filterStatus !== 'all') {
                url += `&status=${this.filterStatus}`;
            }
            if (this.keyword.trim()) {
                url += `&q=${encodeURIComponent(this.keyword.trim())}`;
            }

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    this.stories.push(...data.items);
                    this.hasMore = data.page < data.pages;
                    this.page = data.page + 1;
                    this.loading = false;
                })
                .catch(() => {
                    this.loading = false;
                });
        },

        setFilter(status) {
            this.filterStatus = status;
            this.fetchStories(true);
        },

        search() {
            this.fetchStories(true);
        },

        createStory() {
            fetch('/api/story', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    window.location.href = `/creator/${data.story_id || data.id}`;
                });
        },

        deleteStory(id) {
            if (!confirm('确定要删除此故事吗？\n删除后可在回收站中恢复。')) return;
            fetch(`/api/story/${id}`, { method: 'DELETE' })
                .then(() => {
                    alert('✅ 已移至回收站');
                    this.fetchStories(true);
                });
        },

        logout() {
            fetch('/api/auth/logout', { method: 'POST' })
                .then(() => {
                    window.location.href = '/login';
                });
        },

        formatDate(iso) {
            if (!iso) return '未知';
            return new Date(iso).toLocaleDateString('zh-CN');
        },

        // ============================================================
        // 导入导出功能（与模板中按钮绑定）
        // ============================================================
        exportBackup() {
            window.location.href = '/api/backup/export';
        },

        // 触发文件选择器
        triggerFileInput() {
            document.getElementById('importFile').click();
        },

        importBackup(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                if (confirm('导入将覆盖现有所有数据，确定继续？')) {
                    fetch('/api/backup/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: e.target.result
                    })
                    .then(res => res.json())
                    .then(data => {
                        alert('导入成功，共 ' + data.imported + ' 个故事');
                        location.reload();
                    })
                    .catch(err => alert('导入失败: ' + err));
                }
            };
            reader.readAsText(file);
        }
    },
    mounted() {
        this.fetchStories(true);
        window.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                this.fetchStories();
            }
        });
    },
    template: `
        <div class="creator-dashboard">
            <div class="creator-header">
                <h1>✍️ 我的故事</h1>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button @click="createStory" class="btn-primary">➕ 新建故事</button>
                    <button @click="logout" style="color:#ea4335; background:transparent; border:1px solid #ea4335; padding:6px 12px; border-radius:6px; cursor:pointer;">🚪 退出</button>
                </div>
            </div>

            <div class="creator-toolbar">
                <button class="filter-btn" :class="{active: filterStatus === 'all'}" @click="setFilter('all')">全部</button>
                <button class="filter-btn" :class="{active: filterStatus === 'draft'}" @click="setFilter('draft')">草稿</button>
                <button class="filter-btn" :class="{active: filterStatus === 'published'}" @click="setFilter('published')">已发布</button>
                <input type="text" class="search-input" v-model="keyword" placeholder="搜索故事名..." @keydown.enter="search">
                <button @click="search" class="btn-primary" style="padding:6px 16px; border-radius:20px;">搜索</button>
            </div>
            <div class="creator-toolbar">
                <button class="btn-primary" @click="exportBackup">📤 导出数据</button>
                <input type="file" id="importFile" accept=".json" style="display:none" @change="importBackup" />
                <button class="btn-primary" @click="triggerFileInput">📥 导入数据</button>
             </div>

            <div class="creator-grid">
                <div v-for="story in stories" :key="story.story_id" class="creator-card">
                    <div>
                        <h3><a :href="'/creator/'+story.story_id">{{ story.story_name }}</a></h3>
                        <p class="desc">{{ story.story_desc || '暂无简介' }}</p>
                    </div>
                    <div class="meta">
                        <span class="status-badge" :class="story.is_published ? 'published' : 'draft'">
                            {{ story.is_published ? '已发布' : '草稿' }}
                        </span>
                        <span>{{ formatDate(story.update_time || story.create_time) }}</span>
                        <button class="btn-danger" @click="deleteStory(story.story_id)">删除</button>
                    </div>
                </div>
            </div>

            <div v-if="loading" class="creator-loading">加载中...</div>
            <div v-if="!hasMore && stories.length > 0" class="creator-no-more">没有更多了</div>
            <div v-if="!hasMore && stories.length === 0" class="creator-no-more">暂无故事，点击「新建故事」开始创作</div>
        </div>
    `
}).mount('#app');