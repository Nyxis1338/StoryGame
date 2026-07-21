const { createApp } = Vue;

const app = createApp({
    data() {
        const appEl = document.getElementById('app');
        return {
            storyId: appEl ? parseInt(appEl.dataset.storyId) : 0,
            storyName: '',
            currentPage: null,
            saving: false,
            saved: false,
            autoSaveTimer: null,
            chart: null,
            graphData: { nodes: [], edges: [] },
            storyStatus: '草稿',
            hasUnsavedChanges: false,
            // ----- 左右分栏 -----
            leftWidth: 70,          // 左侧宽度百分比
            isDragging: false,
            dragStartX: 0,
            startLeftWidth: 70,
            isFullscreen: false,   // 左侧全屏
            // ----- 模态框 -----
            modalVisible: false,
            modalTitle: '提示',
            modalMessage: '',
            modalConfirmText: '确定',
            modalCancelText: '取消',
            modalResolve: null,
            modalIsDanger: false,
            // ----- Toast -----
            toastVisible: false,
            toastMessage: '',
            toastType: 'success',
            toastTimer: null
        };
    },
    methods: {
        // ============================================================
        // 页面加载
        // ============================================================
        loadPage(localId) {
            fetch(`/api/page/${this.storyId}/${localId}?mode=edit`)
                .then(res => res.json())
                .then(data => {
                    this.currentPage = data;
                    this.hasUnsavedChanges = false;
                    console.log(`📌 第${localId}页 坐标: (${data.pos_x || 50}, ${data.pos_y || 50})`);
                })
                .catch(err => {
                    console.error('加载页面失败:', err);
                    this.showToast('加载页面失败，请检查网络连接', 'error');
                });
        },

        // ============================================================
        // 保存相关
        // ============================================================
        autoSave() {
            this.hasUnsavedChanges = true;
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
                this.hasUnsavedChanges = false;
                setTimeout(() => { this.saved = false; }, 2000);
                this.refreshGraph();
                this.showToast('✅ 保存成功', 'success');
            })
            .catch(err => {
                console.error('保存失败:', err);
                this.saving = false;
                this.showToast('❌ 保存失败，请检查网络连接', 'error');
            });
        },

        // ============================================================
        // 选项管理
        // ============================================================
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

        // ============================================================
        // 页面管理
        // ============================================================
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
                this.showToast('✅ 新页面创建成功！', 'success');
            })
            .catch(err => {
                console.error('创建页面失败:', err);
                this.showToast('❌ 创建页面失败', 'error');
            });
        },

        deleteCurrentPage() {
            if (!this.currentPage) return;
            this.showConfirm(
                '⚠️ 确认删除',
                `确定删除第 ${this.currentPage.local_id} 页吗？此操作不可撤销！`,
                '确定删除',
                '取消',
                true
            ).then(confirmed => {
                if (confirmed) {
                    fetch(`/api/page/${this.currentPage.id}`, { method: 'DELETE' })
                        .then(res => {
                            if (!res.ok) return res.json().then(err => { throw new Error(err.error || '删除失败'); });
                            this.currentPage = null;
                            this.refreshGraph();
                            this.showToast('✅ 页面已删除', 'success');
                        })
                        .catch(err => {
                            console.error('删除失败:', err);
                            this.showToast('❌ ' + err.message, 'error');
                        });
                }
            });
        },

        // ============================================================
        // ECharts 图表（去掉 force 布局）
        // ============================================================
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
            const container = document.getElementById('chart-container');
            if (!container) {
                console.error('找不到 chart-container 元素');
                return;
            }

            if (!this.chart) {
                this.chart = echarts.init(container);

                this.chart.on('click', (params) => {
                    if (params.dataType === 'node') {
                        this.loadPage(params.data.id);
                    }
                });

                this.chart.on('dragend', (params) => {
                    if (params.dataType === 'node') {
                        const node = params.data;
                        console.log(`📍 节点 ${node.id} 拖动到: (${Math.round(node.x)}, ${Math.round(node.y)})`);
                    }
                });
            }

            if (!data.nodes || data.nodes.length === 0) {
                this.chart.clear();
                this.chart.setOption({
                    title: { text: '暂无页面数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 16 } }
                });
                return;
            }

            const nodesWithLabel = data.nodes.map(node => ({
                ...node,
                label: {
                    show: true,
                    position: 'inside',
                    fontSize: 12,
                    color: '#ffffff',
                    fontWeight: 'bold',
                    formatter: function(params) {
                        const text = params.data.labelText || `第${params.data.id}页`;
                        return text.length > 20 ? text.substring(0, 20) + '...' : text;
                    }
                },
                symbol: 'rect',
                symbolSize: [160, 55],
                itemStyle: {
                    color: node.itemStyle?.color || '#5470c6',
                    borderColor: '#fff',
                    borderWidth: 2,
                    borderRadius: 8,
                    shadowBlur: 8,
                    shadowColor: 'rgba(0,0,0,0.15)'
                }
            }));

            const edgesWithLabel = (data.edges || []).map(edge => ({
                ...edge,
                label: {
                    show: true,
                    formatter: edge.label || '',
                    fontSize: 12,
                    color: '#2c3e50',
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    padding: [4, 12],
                    borderRadius: 6,
                    borderColor: '#3498db',
                    borderWidth: 1
                }
            }));

            // ⭐ 关键：series 配置在这里
            this.chart.setOption({
                title: { text: '故事流程图', left: 'center', textStyle: { fontSize: 16, fontWeight: 'bold' } },
                tooltip: {
                    formatter: (params) => {
                        if (params.dataType === 'node') {
                            return `<b>第${params.data.id}页</b><br>${params.data.value || ''}`;
                        }
                        return params.data.label || '';
                    }
                },
                series: [{
                    type: 'graph',
                    layout: 'force',           // ← 这里！改成 force
                    data: nodesWithLabel,
                    edges: edgesWithLabel,
                    roam: true,
                    draggable: true,
                    force: {
                        repulsion: 100,        // 减小排斥力
                        edgeLength: 200,
                        layoutAnimation: false,
                        friction: 0.3,
                        gravity: 0.05
                    },
                    label: {
                        show: true,
                        position: 'inside',
                        fontSize: 12,
                        color: '#ffffff',
                        fontWeight: 'bold',
                        formatter: function(params) {
                            const text = params.data.labelText || `第${params.data.id}页`;
                            return text.length > 20 ? text.substring(0, 20) + '...' : text;
                        }
                    },
                    edgeLabel: {
                        show: true,
                        formatter: (p) => p.data.label || '',
                        fontSize: 12,
                        color: '#2c3e50',
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(255,255,255,0.92)',
                        padding: [4, 12],
                        borderRadius: 6,
                        borderColor: '#3498db',
                        borderWidth: 1
                    },
                    itemStyle: {
                        color: '#5470c6',
                        borderColor: '#fff',
                        borderWidth: 2,
                        borderRadius: 8,
                        shadowBlur: 8,
                        shadowColor: 'rgba(0,0,0,0.15)'
                    },
                    edgeSymbol: ['none', 'arrow'],
                    edgeSymbolSize: [0, 10],
                    lineStyle: { color: '#7f8c8d', width: 2, curveness: 0.2 }
                }]
            });
            this.chart.resize();
        },

        // ============================================================
        // 故事状态
        // ============================================================
        fetchStoryStatus() {
            fetch(`/api/story/${this.storyId}`)
                .then(res => res.json())
                .then(data => {
                    this.storyName = data.story_name || '未命名故事';
                    this.storyStatus = data.is_published === 1 ? '已发布' : '草稿';
                })
                .catch(err => {
                    console.error('获取故事状态失败:', err);
                });
        },

        publishStory() {
            this.showConfirm(
                '📤 发布确认',
                '确认发布该故事吗？发布后将对所有读者可见。',
                '确认发布',
                '取消',
                false
            ).then(confirmed => {
                if (confirmed) {
                    fetch(`/api/story/${this.storyId}/publish`, { method: 'POST' })
                        .then(res => {
                            if (!res.ok) throw new Error('发布失败');
                            return res.json();
                        })
                        .then(() => {
                            this.showToast('✅ 发布成功！', 'success');
                            this.fetchStoryStatus();
                        })
                        .catch(err => {
                            console.error('发布失败:', err);
                            this.showToast('❌ 发布失败，请检查故事是否完整（必须包含起始页）', 'error');
                        });
                }
            });
        },

        // ============================================================
        // 刷新 / 返回
        // ============================================================
        refreshPage() {
            if (this.hasUnsavedChanges) {
                this.showConfirm(
                    '🔄 刷新确认',
                    '当前有未保存的修改，确定刷新吗？',
                    '确定刷新',
                    '取消',
                    false
                ).then(confirmed => {
                    if (confirmed) {
                        this.doRefresh();
                    }
                });
            } else {
                this.doRefresh();
            }
        },

        doRefresh() {
            this.showToast('🔄 正在刷新...', 'warning', 1000);
            this.refreshGraph();
            if (this.currentPage) {
                this.loadPage(this.currentPage.local_id);
            }
            setTimeout(() => {
                this.showToast('✅ 刷新完成', 'success', 1500);
            }, 500);
        },

        goHome() {
            if (this.hasUnsavedChanges) {
                this.showConfirm(
                    '🏠 离开确认',
                    '有未保存的修改，确定离开吗？',
                    '确定离开',
                    '取消',
                    false
                ).then(confirmed => {
                    if (confirmed) {
                        window.location.href = '/creator';
                    }
                });
            } else {
                window.location.href = '/creator';
            }
        },

        // ============================================================
        // 左右分栏拖拽（Vue 原生，丝滑流畅）
        // ============================================================
        startDrag(e) {
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.startLeftWidth = this.leftWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        },

        onDrag(e) {
            if (!this.isDragging) return;
            const container = this.$el.querySelector('.editor-main');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const totalWidth = rect.width;
            if (totalWidth === 0) return;

            const delta = (e.clientX - this.dragStartX) / totalWidth * 100;
            let newWidth = Math.max(15, Math.min(85, this.startLeftWidth + delta));
            this.leftWidth = newWidth;
        },

        stopDrag() {
            this.isDragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // 拖拽结束后刷新 ECharts
            setTimeout(() => {
                if (this.chart) this.chart.resize();
            }, 50);
        },

        // ============================================================
        // 左侧全屏切换
        // ============================================================
        toggleFullscreen() {
            this.isFullscreen = !this.isFullscreen;
            if (this.isFullscreen) {
                this.leftWidth = 100;
            } else {
                this.leftWidth = 70;
            }
            setTimeout(() => {
                if (this.chart) this.chart.resize();
            }, 100);
        },

        // ============================================================
        // 模态框
        // ============================================================
        showConfirm(title, message, confirmText = '确定', cancelText = '取消', isDanger = false) {
            return new Promise((resolve) => {
                this.modalTitle = title;
                this.modalMessage = message;
                this.modalConfirmText = confirmText;
                this.modalCancelText = cancelText;
                this.modalIsDanger = isDanger;
                this.modalVisible = true;
                this.modalResolve = resolve;
            });
        },

        modalConfirm() {
            this.modalVisible = false;
            if (this.modalResolve) this.modalResolve(true);
        },

        modalCancel() {
            this.modalVisible = false;
            if (this.modalResolve) this.modalResolve(false);
        },

        // ============================================================
        // Toast
        // ============================================================
        showToast(message, type = 'success', duration = 2000) {
            clearTimeout(this.toastTimer);
            this.toastMessage = message;
            this.toastType = type;
            this.toastVisible = true;
            this.toastTimer = setTimeout(() => {
                this.toastVisible = false;
            }, duration);
        }
    },

    mounted() {
        setTimeout(() => {
            this.refreshGraph();
        }, 200);

        window.addEventListener('resize', () => {
            if (this.chart) this.chart.resize();
        });

        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
            }
        });
    },

    template: `
        <div style="display:flex; flex-direction:column; height:100vh; background:#f0f2f5;">
            <!-- ====== 顶部导航栏 ====== -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 24px; background:white; border-bottom:1px solid #e0e0e0; flex-shrink:0; z-index:100;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <h2 style="font-size:18px; margin:0;">📖 {{ storyName || '未命名故事' }}</h2>
                    <span style="background:#6c757d; color:white; padding:2px 12px; border-radius:30px; font-size:12px;">{{ storyStatus }}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button @click="savePage" :disabled="saving" style="background:#1a73e8; color:white; border:none; padding:6px 16px; border-radius:8px; cursor:pointer; font-size:14px;" :style="{opacity: saving ? 0.6 : 1}">{{ saving ? '保存中...' : '💾 保存' }}</button>
                    <span v-show="saved" style="color:#34a853; font-size:13px;">✅ 已保存</span>
                    <button @click="refreshPage" style="background:#6c757d; color:white; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:14px;">🔄 刷新</button>
                    <button @click="goHome" style="background:#8a7a6a; color:white; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:14px;">🏠 返回</button>
                    <button v-if="storyStatus === '草稿'" @click="publishStory" style="background:#28a745; color:white; border:none; padding:6px 16px; border-radius:8px; cursor:pointer; font-size:14px; margin-left:8px;">📤 发布</button>
                </div>
            </div>

            <!-- ====== 主内容区 ====== -->
            <div class="editor-main" style="display:flex; flex:1; overflow:hidden; padding:12px; gap:0;">

                <!-- ====== 左侧：ECharts ====== -->
                <div id="chart-container" style="background:white; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.06); overflow:hidden; min-height:400px; position:relative; transition: flex 0.15s ease;" :style="{ flex: '0 0 ' + leftWidth + '%' }">
                    <!-- 全屏按钮 -->
                    <button @click="toggleFullscreen" style="position:absolute; top:12px; right:12px; z-index:10; background:rgba(255,255,255,0.92); border:1px solid #ddd; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:13px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                        {{ isFullscreen ? '⛶ 退出全屏' : '⛶ 全屏' }}
                    </button>
                </div>

                <!-- ====== 分隔条 ====== -->
                <div v-if="leftWidth > 5 && leftWidth < 95"
                     style="flex: 0 0 6px; background:#e0e0e0; cursor:col-resize; flex-shrink:0; transition:background 0.2s; position:relative; border-radius:3px; margin:0 4px;"
                     :style="{background: isDragging ? '#1a73e8' : '#e0e0e0'}"
                     @mousedown="startDrag"
                     @mousemove="onDrag"
                     @mouseup="stopDrag"
                     @mouseleave="stopDrag">
                    <span style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#999; font-size:14px; font-weight:bold;">⋮</span>
                </div>

                <!-- ====== 右侧：编辑面板 ====== -->
                <div style="background:white; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.06); padding:24px 28px; overflow-y:auto; min-width:200px; transition: flex 0.15s ease;" :style="{ flex: '0 0 ' + (100 - leftWidth) + '%' }">
                    <!-- 面板标题 -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-weight:600; font-size:16px;" v-if="currentPage">编辑第 {{ currentPage.local_id }} 页</span>
                        <span style="font-weight:600; font-size:16px;" v-else>编辑面板</span>
                    </div>

                    <!-- 编辑器内容 -->
                    <div v-if="currentPage">
                        <div style="margin-bottom:15px; display:flex; gap:10px; flex-wrap:wrap;">
                            <button @click="addNewPage" style="background:#1a73e8; color:white; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:13px;">➕ 新增子页</button>
                            <button @click="deleteCurrentPage" style="background:#ea4335; color:white; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:13px;">🗑️ 删除本页</button>
                        </div>

                        <!-- 正文 -->
                        <div style="margin-bottom:18px;">
                            <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;">正文 (支持Markdown)</label>
                            <textarea v-model="currentPage.content" @input="autoSave" style="width:100%; padding:10px 14px; border:1px solid #ddd; border-radius:8px; font-size:14px; font-family:inherit; box-sizing:border-box; min-height:120px; resize:vertical;"></textarea>
                        </div>

                        <!-- 页面类型 -->
                        <div style="margin-bottom:18px;">
                            <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;">页面类型</label>
                            <select v-model="currentPage.page_type" @change="autoSave" style="width:100%; padding:10px 14px; border:1px solid #ddd; border-radius:8px; font-size:14px; font-family:inherit; box-sizing:border-box;">
                                <option value="start">起始</option>
                                <option value="process">过程</option>
                                <option value="ending">结局</option>
                            </select>
                        </div>

                        <!-- 正确结局 -->
                        <div style="margin-bottom:18px;">
                            <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;"><input type="checkbox" v-model="currentPage.is_true_ending" @change="autoSave"> 是正确结局</label>
                        </div>

                        <!-- 分支选项 -->
                        <div style="margin-bottom:18px;">
                            <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;">分支选项</label>
                            <div v-for="(opt, idx) in currentPage.options" :key="idx" style="display:flex; gap:8px; align-items:center; background:#f8f9fa; padding:8px 12px; border-radius:8px; margin-bottom:8px;">
                                <input type="text" v-model="opt.text" placeholder="选项文字" @input="autoSave" style="flex:2; padding:8px 12px; border:1px solid #ddd; border-radius:6px; font-size:14px; box-sizing:border-box;">
                                <input type="number" v-model.number="opt.jump_local_id" placeholder="跳转页ID" @input="autoSave" style="flex:0.8; padding:8px 12px; border:1px solid #ddd; border-radius:6px; font-size:14px; box-sizing:border-box;">
                                <button @click="removeOption(idx)" style="background:#ea4335; color:white; border:none; width:28px; height:28px; border-radius:50%; cursor:pointer; font-size:16px; flex-shrink:0;">✕</button>
                            </div>
                            <button @click="addOption" style="background:#e8f0fe; color:#1a73e8; border:1px dashed #1a73e8; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:14px;">➕ 添加选项</button>
                        </div>

                        <!-- 保存按钮 -->
                        <div style="margin-top:10px;">
                            <button @click="savePage" :disabled="saving" style="background:#1a73e8; color:white; border:none; padding:10px 24px; border-radius:8px; font-weight:500; cursor:pointer; font-size:15px;" :style="{opacity: saving ? 0.6 : 1}">{{ saving ? '保存中...' : '手动保存' }}</button>
                            <span v-show="saved" style="color:#34a853; font-size:14px; margin-left:12px;">✅ 已保存</span>
                        </div>
                    </div>

                    <!-- 空状态 -->
                    <div v-else style="color:#999; text-align:center; padding:60px 0; font-size:16px;">
                        <p>👆 请点击左侧图中的节点开始编辑</p>
                    </div>
                </div>
            </div>

            <!-- ====== 模态框 ====== -->
            <div v-if="modalVisible" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;">
                <div style="background:white; border-radius:16px; max-width:420px; width:90%; padding:24px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h3 style="margin:0; font-size:18px;">{{ modalTitle }}</h3>
                        <button @click="modalCancel" style="background:none; border:none; font-size:22px; cursor:pointer; color:#999;">✕</button>
                    </div>
                    <div style="margin-bottom:20px;">
                        <p style="margin:0; font-size:15px; color:#555; line-height:1.6;">{{ modalMessage }}</p>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px;">
                        <button @click="modalCancel" style="padding:8px 24px; border:none; border-radius:8px; font-size:14px; cursor:pointer; background:#f0f0f0; color:#555;">{{ modalCancelText }}</button>
                        <button @click="modalConfirm" style="padding:8px 24px; border:none; border-radius:8px; font-size:14px; cursor:pointer; background: #1a73e8; color:white;" :style="{background: modalIsDanger ? '#ea4335' : '#1a73e8'}">{{ modalConfirmText }}</button>
                    </div>
                </div>
            </div>

            <!-- ====== Toast ====== -->
            <div v-if="toastVisible" style="position:fixed; top:30px; left:50%; transform:translateX(-50%); padding:12px 28px; border-radius:12px; color:white; font-size:15px; z-index:10000; box-shadow:0 4px 20px rgba(0,0,0,0.15); background: #34a853;" :style="{background: toastType === 'error' ? '#ea4335' : toastType === 'warning' ? '#fbbc04' : '#34a853', color: toastType === 'warning' ? '#333' : 'white'}">
                {{ toastMessage }}
            </div>
        </div>
    `
});

app.mount('#app');