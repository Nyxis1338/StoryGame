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

        // 点击搜索按钮触发搜索
        doSearch() {
            this.fetchStories(true);
        },

        // 按回车键触发搜索
        handleKeydown(e) {
            if (e.key === 'Enter') {
                this.doSearch();
            }
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

        formatDate(iso) {
            if (!iso) return '未知';
            return new Date(iso).toLocaleDateString('zh-CN');
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
                <button @click="createStory" class="btn-primary">➕ 新建故事</button>
            </div>

            <div class="creator-toolbar">
                <button class="filter-btn" :class="{active: filterStatus === 'all'}" @click="setFilter('all')">全部</button>
                <button class="filter-btn" :class="{active: filterStatus === 'draft'}" @click="setFilter('draft')">草稿</button>
                <button class="filter-btn" :class="{active: filterStatus === 'published'}" @click="setFilter('published')">已发布</button>
                <input type="text" class="search-input" v-model="keyword" placeholder="搜索故事名..." @keydown="handleKeydown">
                <button @click="doSearch" class="btn-primary" style="padding:6px 16px; border-radius:20px;">搜索</button>
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
            <div v-if="!hasMore && stories.length === 0" class="creator-no-more">暂无故事，点击上方「新建故事」开始创作</div>
        </div>
    `
}).mount('#app');