const { createApp } = Vue;

const app = createApp({
    data() {
        const appEl = document.getElementById('app');
        return {
            storyId: appEl ? parseInt(appEl.dataset.storyId) : 0,
            currentPage: null,
            saving: false,
            saved: false,
            autoSaveTimer: null,
            chart: null,
            graphData: { nodes: [], edges: [] },
            storyStatus: '草稿'
        };
    },
    methods: {
        loadPage(localId) {
            fetch(`/api/page/${this.storyId}/${localId}?mode=edit`)
                .then(res => res.json())
                .then(data => {
                    this.currentPage = data;
                })
                .catch(err => {
                    console.error('加载页面失败:', err);
                    alert('加载页面失败，请检查网络或数据库连接');
                });
        },

        autoSave() {
            clearTimeout(this.autoSaveTimer);
            this.saved = false;
            this.autoSaveTimer = setTimeout(() => {
                this.savePage();
            }, 1000);
        },

        savePage() {
            if (!this.currentPage) return;
            this.saving = true;
            fetch(`/api/page/${this.currentPage.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: this.currentPage.content,
                    options: this.currentPage.options,
                    page_type: this.currentPage.page_type,
                    is_true_ending: this.currentPage.is_true_ending
                })
            })
            .then(res => {
                if (!res.ok) throw new Error('保存失败');
                return res.json();
            })
            .then(() => {
                this.saving = false;
                this.saved = true;
                setTimeout(() => { this.saved = false; }, 2000);
                this.refreshGraph();
            })
            .catch(err => {
                console.error('保存失败:', err);
                this.saving = false;
                alert('保存失败，请检查网络连接');
            });
        },

        addOption() {
            if (!this.currentPage) return;
            this.currentPage.options.push({ text: '新选项', jump_local_id: 1 });
            this.autoSave();
        },

        removeOption(idx) {
            if (!this.currentPage) return;
            this.currentPage.options.splice(idx, 1);
            this.autoSave();
        },

        addNewPage() {
            if (!this.currentPage) return;
            const maxId = this.graphData.nodes.reduce((max, n) => Math.max(max, n.id), 0);
            const newLocalId = maxId + 1;
            fetch(`/api/page/${this.storyId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    local_page_id: newLocalId,
                    content: '# 新页面\n请编辑内容',
                    options: []
                })
            })
            .then(res => {
                if (!res.ok) throw new Error('创建页面失败');
                return res.json();
            })
            .then(() => {
                this.currentPage.options.push({ text: '前往新页', jump_local_id: newLocalId });
                this.savePage();
                this.refreshGraph();
                alert('✅ 新页面创建成功！');
            })
            .catch(err => {
                console.error('创建页面失败:', err);
                alert('创建页面失败，请检查网络连接');
            });
        },

        deleteCurrentPage() {
            if (!this.currentPage) return;
            if (!confirm(`确定删除第 ${this.currentPage.local_id} 页吗？\n此操作不可撤销！`)) return;
            fetch(`/api/page/${this.currentPage.id}`, { method: 'DELETE' })
                .then(res => {
                    if (!res.ok) return res.json().then(err => { throw new Error(err.error || '删除失败'); });
                    this.currentPage = null;
                    this.refreshGraph();
                })
                .catch(err => {
                    console.error('删除失败:', err);
                    alert(err.message);
                });
        },

        refreshGraph() {
            fetch(`/api/graph/${this.storyId}?mode=edit`)
                .then(res => res.json())
                .then(data => {
                    this.graphData = data;
                    this.updateChart(data);
                    this.fetchStoryStatus();
                })
                .catch(err => {
                    console.error('加载图数据失败:', err);
                });
        },

        updateChart(data) {
            if (!this.chart) {
                this.chart = echarts.init(document.getElementById('chart-container'));
                this.chart.on('click', (params) => {
                    if (params.dataType === 'node') {
                        this.loadPage(params.data.id);
                    }
                });
            }
            this.chart.setOption({
                title: { text: '故事流程图', left: 'center' },
                tooltip: { formatter: (params) => params.data.value || '' },
                series: [{
                    type: 'graph',
                    layout: 'force',
                    data: data.nodes,
                    edges: data.edges,
                    roam: true,
                    draggable: true,
                    label: { show: true, position: 'right', formatter: (p) => '第' + p.data.id + '页' },
                    edgeLabel: { show: true, formatter: (p) => p.data.label || '', fontSize: 10 },
                    force: { repulsion: 500, edgeLength: 200 },
                    itemStyle: { color: '#5470c6' },
                    edgeSymbol: ['none', 'arrow'],
                    edgeSymbolSize: [0, 10],
                    lineStyle: { color: '#aaa', width: 2, curveness: 0.2 }
                }]
            });
            this.chart.resize();
        },

        fetchStoryStatus() {
            fetch(`/api/story/${this.storyId}`)
                .then(res => res.json())
                .then(data => {
                    this.storyStatus = data.is_published === 1 ? '已发布' : '草稿';
                })
                .catch(err => {
                    console.error('获取故事状态失败:', err);
                });
        },

        publishStory() {
            if (!confirm('确认发布该故事吗？\n发布后将对所有读者可见。')) return;
            fetch(`/api/story/${this.storyId}/publish`, { method: 'POST' })
                .then(res => {
                    if (!res.ok) throw new Error('发布失败');
                    return res.json();
                })
                .then(() => {
                    alert('✅ 发布成功！');
                    this.fetchStoryStatus();
                })
                .catch(err => {
                    console.error('发布失败:', err);
                    alert('发布失败，请检查故事是否完整（必须包含起始页）');
                });
        }
    },

    mounted() {
        this.refreshGraph();
        window.addEventListener('resize', () => {
            if (this.chart) this.chart.resize();
        });
    },
    template: `
        <div class="editor-wrapper">
            <div id="chart-container" class="editor-chart"></div>
            <div id="editor-panel" class="editor-panel">
                <!-- 状态栏 -->
                <div v-if="currentPage" class="panel-header">
                    <h2 class="panel-title">编辑第 {{ currentPage.local_id }} 页</h2>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="status-tag">当前状态: {{ storyStatus }}</span>
                        <button v-if="storyStatus === '草稿'" @click="publishStory" class="btn-success" style="padding:6px 16px;">
                            📤 发布故事
                        </button>
                    </div>
                </div>

                <!-- 编辑器主体 -->
                <div v-if="currentPage">
                    <div class="toolbar" style="margin-bottom:15px; display:flex; gap:10px; flex-wrap:wrap;">
                        <button @click="addNewPage" class="btn-primary" style="padding:6px 14px; font-size:13px;">➕ 新增子页</button>
                        <button @click="deleteCurrentPage" class="btn-danger" style="padding:6px 14px; font-size:13px;">🗑️ 删除本页</button>
                    </div>

                    <div class="editor-field">
                        <label>正文 (支持Markdown)</label>
                        <textarea v-model="currentPage.content" @input="autoSave"></textarea>
                    </div>

                    <div class="editor-field">
                        <label>页面类型</label>
                        <select v-model="currentPage.page_type" @change="autoSave">
                            <option value="start">起始</option>
                            <option value="process">过程</option>
                            <option value="ending">结局</option>
                        </select>
                    </div>

                    <div class="editor-field">
                        <label><input type="checkbox" v-model="currentPage.is_true_ending" @change="autoSave"> 是正确结局</label>
                    </div>

                    <div class="editor-field">
                        <label>分支选项</label>
                        <div v-for="(opt, idx) in currentPage.options" :key="idx" class="editor-option-row">
                            <input type="text" v-model="opt.text" placeholder="选项文字" @input="autoSave">
                            <input type="number" v-model.number="opt.jump_local_id" placeholder="跳转页ID" @input="autoSave">
                            <button class="btn-remove-option" @click="removeOption(idx)">✕</button>
                        </div>
                        <button class="btn-add-option" @click="addOption">➕ 添加选项</button>
                    </div>

                    <div style="margin-top:10px;">
                        <button class="btn-save" @click="savePage" :disabled="saving">{{ saving ? '保存中...' : '手动保存' }}</button>
                        <span class="save-hint" v-show="saved">✅ 已保存</span>
                    </div>
                </div>

                <div v-else class="editor-empty-hint">
                    <p>👆 请点击左侧图中的节点开始编辑</p>
                </div>
            </div>
        </div>
    `
});

app.mount('#app');