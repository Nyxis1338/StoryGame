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
                    // ✅ 使用 marked 解析 Markdown
                    this.currentContent = marked.parse(page.content || '');
                    this.currentOptions = page.options || [];
                    this.isEnding = page.page_type === 'ending';
                    this.isTrueEnding = page.is_true_ending || false;
                    
                    console.log('加载页面:', this.currentLocalId, '选项数:', this.currentOptions.length);
                })
                .catch(err => {
                    console.error('加载失败:', err);
                    this.currentContent = `<p style="color:red;">⚠️ ${err.message || '加载失败'}</p>`;
                    this.currentOptions = [];
                    this.isEnding = true;
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
    template: `
        <div class="reader-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h1 class="reader-title" style="margin-bottom:0;">📖 {{ storyName || '故事阅读' }}</h1>
                <button @click="goHome" style="
                    background: #8a7a6a;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 30px;
                    cursor: pointer;
                    font-size: 0.95rem;
                    font-family: inherit;
                    transition: background 0.2s;
                    flex-shrink: 0;
                " onmouseover="this.style.background='#6a5a4a'" onmouseout="this.style.background='#8a7a6a'">
                    📚 返回列表
                </button>
            </div>

            <div class="reader-content" v-html="currentContent"></div>

            <div class="reader-options">
                <button v-for="(opt, idx) in currentOptions" :key="idx" @click="chooseOption(opt)">
                    {{ opt.text }}
                </button>
            </div>

            <div v-if="isEnding" class="reader-ending">
                {{ isTrueEnding ? '🎉 恭喜你完成了正确的推理！' : '📖 故事结束' }}
            </div>

            <button v-if="history.length > 0" class="reader-back-btn" @click="goBack">
                ⬅️ 返回上一步
            </button>
        </div>
    `
}).mount('#app');