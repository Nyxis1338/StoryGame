const { createApp, ref, onMounted } = Vue;

createApp({
    setup() {
        const stories = ref([]);
        const page = ref(1);
        const perPage = 10;
        const loading = ref(false);
        const hasMore = ref(true);
        const keyword = ref('');

        const fetchStories = (reset = false) => {
            if (loading.value) return;
            if (reset) {
                page.value = 1;
                hasMore.value = true;
                stories.value = [];
            }
            if (!hasMore.value) return;

            loading.value = true;
            let url = `/api/stories?page=${page.value}&per_page=${perPage}`;
            if (keyword.value.trim()) {
                url += `&q=${encodeURIComponent(keyword.value.trim())}`;
            }

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    stories.value.push(...data.items);
                    hasMore.value = data.page < data.pages;
                    page.value = data.page + 1;
                    loading.value = false;
                })
                .catch(() => {
                    loading.value = false;
                });
        };

        // 点击搜索按钮触发搜索（不再实时搜索）
        const doSearch = () => {
            fetchStories(true);
        };

        // 按回车键触发搜索
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                doSearch();
            }
        };

        const formatDate = (iso) => {
            if (!iso) return '未知';
            return new Date(iso).toLocaleDateString('zh-CN');
        };

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                fetchStories();
            }
        };

        onMounted(() => {
            fetchStories(true);
            window.addEventListener('scroll', handleScroll);
        });

        return { stories, loading, hasMore, keyword, doSearch, handleKeydown, formatDate };
    },
    template: `
        <div class="reader-container">
            <h1 class="reader-title">📚 故事库</h1>

            <div class="reader-search-box">
                <input type="text" v-model="keyword" placeholder="搜索故事名..." @keydown="handleKeydown">
                <button @click="doSearch">搜索</button>
            </div>

            <div v-for="story in stories" :key="story.story_id" class="reader-story-item">
                <h3><a :href="'/reader/'+story.story_id">{{ story.story_name }}</a></h3>
                <p>{{ story.story_desc || '暂无简介' }}</p>
                <span class="date">更新于 {{ formatDate(story.update_time || story.create_time) }}</span>
            </div>

            <div v-if="loading" class="reader-loading">加载中...</div>
            <div v-if="!hasMore && stories.length > 0" class="reader-no-more">没有更多故事了</div>
            <div v-if="!hasMore && stories.length === 0" class="reader-no-more">📭 暂无故事，敬请期待...</div>
        </div>
    `
}).mount('#app');