const { createApp } = Vue;

createApp({
    data() {
        const appEl = document.getElementById('app');
        return {
            storyId: appEl ? parseInt(appEl.dataset.storyId) : 0,
            storyName: '',
            currentLocalId: 1,
            currentContent: '',
            currentOptions: [],
            isEnding: false,
            isTrueEnding: false,
            history: []
        };
    },
    methods: {
        loadPage(localId) {
            fetch(`/api/page/${this.storyId}/${localId}`)
                .then(res => {
                    if (!res.ok) throw new Error('页面不存在或未发布');
                    return res.json();
                })
                .then(page => {
                    this.currentLocalId = page.local_id || localId;
                    this.currentContent = marked.parse(page.content || '');
                    this.currentOptions = page.options || [];

                    // ✅ 适配新的 page_type 值
                    this.isEnding = (page.page_type === 'true_ending' || page.page_type === 'false_ending');
                    this.isTrueEnding = (page.page_type === 'true_ending');
                })
                .catch(err => {
                    this.currentContent = `<p style="color:red;">⚠️ ${err.message || '加载失败'}</p>`;
                    this.currentOptions = [];
                    this.isEnding = true;
                    this.isTrueEnding = false;
                });
        },

        chooseOption(opt) {
            if (!opt.jump_local_id) {
                console.error('选项缺少跳转目标:', opt);
                return;
            }
            this.history.push(this.currentLocalId);
            this.currentLocalId = opt.jump_local_id;
            this.loadPage(this.currentLocalId);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        goBack() {
            if (this.history.length === 0) return;
            const prevId = this.history.pop();
            this.currentLocalId = prevId;
            this.loadPage(this.currentLocalId);
        },

        goHome() {
            window.location.href = '/';
        }
    },
    mounted() {
        this.loadPage(1);
        fetch(`/api/story/${this.storyId}`)
            .then(res => res.json())
            .then(data => {
                this.storyName = data.story_name || '故事';
            })
            .catch(() => {});
    },
    template: '#reader-template'
}).mount('#app');