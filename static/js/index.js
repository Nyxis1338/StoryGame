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
            // ✅ 显式添加 status=published，确保只读取已发布故事
            let url = `/api/stories?page=${page.value}&per_page=${perPage}&status=published`;
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

        const search = () => {
            fetchStories(true);
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

        return { stories, loading, hasMore, keyword, search, formatDate };
    },
    template: '#index-template'
}).mount('#app');