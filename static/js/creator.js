// ============================================================
// 故事编辑器 - Vue 组件 (creator.js)
// 依赖: StoryAPI (story_api.js), JsPlumbRenderer (jsplumb_renderer.js)
// ============================================================

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
            storyStatus: '草稿',
            hasUnsavedChanges: false,
            leftWidth: parseFloat(localStorage.getItem('leftWidth')) || 70,
            isDragging: false,
            dragStartX: 0,
            startLeftWidth: 70,
            isFullscreen: false,
            modalVisible: false,
            modalTitle: '提示',
            modalMessage: '',
            modalConfirmText: '确定',
            modalCancelText: '取消',
            modalResolve: null,
            modalIsDanger: false,
            toastVisible: false,
            toastMessage: '',
            toastType: 'success',
            toastTimer: null,
        };
    },

    methods: {
        // ============================================================
        // 页面加载
        // ============================================================
        loadPage(localId) {
            StoryAPI.getPage(this.storyId, localId)
                .then(data => {
                    this.currentPage = data;
                    this.currentPage.id = data.id;   // ← 确保 id 是全局主键
                    this.hasUnsavedChanges = false;
                })
                .catch(err => {
                    console.error('加载页面失败:', err);
                    this.showToast('加载页面失败', 'error');
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
            StoryAPI.updatePage(this.currentPage.id, {
                content: this.currentPage.content,
                options: this.currentPage.options,
                page_type: this.currentPage.page_type,
                is_true_ending: this.currentPage.is_true_ending
            })
            .then(() => {
                this.saving = false;
                this.saved = true;
                this.hasUnsavedChanges = false;
                setTimeout(() => { this.saved = false; }, 2000);

                this.showToast('✅ 保存成功', 'success');
            })
            .catch(err => {
                console.error('保存失败:', err);
                this.saving = false;
                this.showToast('❌ 保存失败', 'error');
            });
        },

        // ============================================================
        // 选项管理
        // ============================================================
        addOption() {
            if (!this.currentPage) {
                this.showToast('请先选择一个页面', 'warning');
                return;
            }
            // 安全获取最大节点 ID
            const nodes = (this.graphData && this.graphData.nodes) || [];
            const maxId = nodes.reduce((max, n) => Math.max(max, n.id || 0), 0);
            const newLocalId = maxId + 1;

            // 1. 创建新页面
            StoryAPI.createPage(this.storyId, {
                local_page_id: newLocalId,
                content: '# 新页面\n请编辑内容',
                options: [],
                pos_x: 100 + Math.random() * 300,
                pos_y: 100 + Math.random() * 200
            })
            .then(() => {
                // 2. 更新当前页面的 options
                this.currentPage.options.push({
                    text: '新选项',
                    jump_local_id: newLocalId
                });
                // 3. 保存当前页面（更新 options）
                return StoryAPI.updatePage(this.currentPage.id, {
                    options: this.currentPage.options
                });
            })
            .then(() => {
                // 4. 获取新的 edges 并保存（包含新连线）
                this.saveGraphData();
                // 5. 刷新图数据
                this.refreshGraph();
                this.showToast('✅ 新分支创建成功', 'success');
            })
            .catch(err => {
                console.error('创建分支失败:', err);
                this.showToast('❌ 创建分支失败', 'error');
            });
        },

        removeOption(idx) {
            if (!this.currentPage) return;
            this.currentPage.options.splice(idx, 1);
            this.autoSave();
        },

        // ============================================================
        // 页面管理（新增/删除）
        // ============================================================
        addNewPage() {
            if (!this.currentPage) return;
            const maxId = JsPlumbRenderer.getMaxNodeId() + 1;
            const newLocalId = maxId || 1;
            StoryAPI.createPage(this.storyId, {
                local_page_id: newLocalId,
                content: '# 新页面\n请编辑内容',
                options: [],
                pos_x: 100 + Math.random() * 200,
                pos_y: 100 + Math.random() * 200
            })
            .then(() => {
                this.refreshGraph();
                this.showToast('✅ 新页面创建成功', 'success');
            })
            .catch(err => {
                console.error('创建页面失败:', err);
                this.showToast('❌ 创建失败', 'error');
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
                    const nodeId = this.currentPage.local_id;
                    // 1. 查找所有指向该节点的页面，清理其 options
                    // 可通过遍历 graphData.edges 找到所有 source 为 nodeId 的边，但这里简化：直接后端处理
                    // 或者前端遍历所有节点，但需要获取所有页面的 options
                    // 推荐在后端删除页面时自动清理引用（在 delete_page 接口中处理）
                    
                    // 2. 调用后端删除页面（后端应清理引用）
                    StoryAPI.deletePage(this.currentPage.id)
                        .then(() => {
                            // 3. 从渲染器中删除节点
                            JsPlumbRenderer.deleteNode(nodeId);
                            // 4. 保存图数据（移除相关 edges）
                            this.saveGraphData();
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
        // 图表渲染（调用渲染器）
        // ============================================================
        refreshGraph() {
            StoryAPI.getGraph(this.storyId)
                .then(data => {
                    // 安全处理，防止 data 为 null/undefined
                    if (!data) data = { nodes: [], edges: [] };
                    if (!data.nodes) data.nodes = [];
                    if (!data.edges) data.edges = [];
                    this.graphData = data;
                    JsPlumbRenderer.renderGraph(data.nodes, data.edges);
                    this.fetchStoryStatus();
                })
                .catch(err => {
                    console.error('加载图数据失败:', err);
                });
        },

        saveGraphData() {
            const graphData = JsPlumbRenderer.getGraphData();
            StoryAPI.saveGraph(this.storyId, graphData)
                .catch(err => console.error('保存图数据失败:', err));
        },

        // ============================================================
        // 故事状态
        // ============================================================
        fetchStoryStatus() {
            StoryAPI.getStoryStatus(this.storyId)
                .then(data => {
                    this.storyName = data.story_name || '未命名故事';
                    this.storyStatus = data.is_published ? '已发布' : '草稿';
                })
                .catch(err => console.error('获取故事状态失败:', err));
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
                    StoryAPI.publishStory(this.storyId)
                        .then(() => {
                            this.showToast('✅ 发布成功', 'success');
                            this.fetchStoryStatus();
                        })
                        .catch(err => {
                            console.error('发布失败:', err);
                            this.showToast('❌ 发布失败', 'error');
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
            window.location.href = '/creator';
        },

        // ============================================================
        // 左右分栏拖拽
        // ============================================================
        startDrag(e) {
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.startLeftWidth = this.leftWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            const container = document.getElementById('chart-container');
            if (container) container.style.pointerEvents = 'none';
        },

        onDrag(e) {
            if (!this.isDragging) return;
            const container = this.$refs.mainContainer;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const totalWidth = rect.width;
            if (totalWidth === 0) return;
            const delta = (e.clientX - this.dragStartX) / totalWidth * 100;
            let newWidth = Math.max(15, Math.min(85, this.startLeftWidth + delta));
            this.leftWidth = newWidth;
            JsPlumbRenderer.resize && JsPlumbRenderer.resize();
        },

        stopDrag() {
            if (!this.isDragging) return;
            this.isDragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            localStorage.setItem('leftWidth', this.leftWidth);
            const container = document.getElementById('chart-container');
            if (container) container.style.pointerEvents = '';
            setTimeout(() => { JsPlumbRenderer.resize && JsPlumbRenderer.resize(); }, 50);
        },

        toggleFullscreen() {
            this.isFullscreen = !this.isFullscreen;
            this.leftWidth = this.isFullscreen ? 100 : 70;
            setTimeout(() => { JsPlumbRenderer.resize && JsPlumbRenderer.resize(); }, 100);
        },

        // ============================================================
        // 模态框 / Toast
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

        showToast(message, type = 'success', duration = 2000) {
            clearTimeout(this.toastTimer);
            this.toastMessage = message;
            this.toastType = type;
            this.toastVisible = true;
            this.toastTimer = setTimeout(() => {
                this.toastVisible = false;
            }, duration);
        },

        exportBackup() {
            window.location.href = '/api/backup/export';
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
        // 初始化渲染器，传入回调
        JsPlumbRenderer.init('chart-container', {
            onNodeClick: (nodeId) => {
                this.loadPage(nodeId);
            },
            onNodeMove: (nodeId, x, y) => {
                // 节点移动时自动保存图数据（防抖）
                if (this._saveGraphTimer) clearTimeout(this._saveGraphTimer);
                this._saveGraphTimer = setTimeout(() => {
                    this.saveGraphData();
                }, 500);
            },
            onOptionChange: (sourceLocalId, targetLocalId, action, label) => {
                // 1. 获取源页面的当前 options
                StoryAPI.getPage(this.storyId, sourceLocalId)
                    .then(data => {
                        const options = data.options || [];
                        if (action === 'add') {
                            // 检查是否已存在相同跳转，避免重复
                            if (!options.find(opt => opt.jump_local_id === targetLocalId)) {
                                options.push({ text: label || '新连线', jump_local_id: targetLocalId });
                            }
                        } else if (action === 'remove') {
                            const idx = options.findIndex(opt => opt.jump_local_id === targetLocalId);
                            if (idx !== -1) options.splice(idx, 1);
                        }
                        // 2. 更新源页面的 options
                        return StoryAPI.updatePage(data.id, { options: options });
                    })
                    .then(() => {
                        // 3. 保存图数据（包含 edges）
                        this.saveGraphData();
                        // 4. 如果当前页面是源页面，更新本地 currentPage.options
                        if (this.currentPage && this.currentPage.local_id === sourceLocalId) {
                            // 重新加载当前页面以刷新右侧面板
                            this.loadPage(sourceLocalId);
                        }
                        // 5. 刷新图（可选，但会触发重绘）
                        // this.refreshGraph(); // 如果不想全量刷新，可只更新本地数据
                    })
                    .catch(err => {
                        console.error('更新选项失败:', err);
                        this.showToast('同步连线数据失败', 'error');
                    });
            },
            onLabelChange: (sourceLocalId, targetLocalId, newLabel) => {
                this.saveGraphData();
            }
        });

        // 加载图数据
        this.refreshGraph();

        // 事件绑定
        document.addEventListener('mousemove', this.onDrag);
        document.addEventListener('mouseup', this.stopDrag);
        document.addEventListener('mouseleave', this.stopDrag);
        window.addEventListener('resize', () => {
            JsPlumbRenderer.resize && JsPlumbRenderer.resize();
        });
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改';
            }
        });
    },

    beforeUnmount() {
        document.removeEventListener('mousemove', this.onDrag);
        document.removeEventListener('mouseup', this.stopDrag);
        document.removeEventListener('mouseleave', this.stopDrag);
        JsPlumbRenderer.destroy && JsPlumbRenderer.destroy();
    },

    template: `
        <div style="display:flex; flex-direction:column; height:100vh; background:#f0f2f5;">
            <!-- 导航栏 -->
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

            <!-- 主内容区 -->
            <div class="main" ref="mainContainer" style="display:flex; flex:1; overflow:hidden; padding:12px; gap:0;">
                <!-- 左侧：思维导图 -->
                <div style="height:100%; background:white; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.06); overflow:hidden; min-height:400px; position:relative; flex-shrink:0;" :style="{ width: leftWidth + '%' }">
                    <div id="chart-container" style="width:100%; height:100%;"></div>
                    <button @click="toggleFullscreen" style="position:absolute; top:12px; right:12px; z-index:10; background:rgba(255,255,255,0.92); border:1px solid #ddd; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:13px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                        {{ isFullscreen ? '⛶ 退出全屏' : '⛶ 全屏' }}
                    </button>
                </div>

                <!-- 分隔条 -->
                <div v-if="leftWidth > 5 && leftWidth < 95"
                     style="flex: 0 0 6px; background:#e0e0e0; cursor:col-resize; flex-shrink:0; transition:background 0.2s; position:relative; border-radius:3px; margin:0 4px;"
                     :style="{background: isDragging ? '#1a73e8' : '#e0e0e0'}"
                     @mousedown="startDrag">
                    <span style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#999; font-size:14px; font-weight:bold;">⋮</span>
                </div>

                <!-- 右侧：编辑面板 -->
                <div style="height:100%; background:white; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.06); padding:24px 28px; overflow-y:auto; min-width:200px; flex:1;" :style="{ width: (100 - leftWidth) + '%' }">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-weight:600; font-size:16px;" v-if="currentPage">编辑第 {{ currentPage.local_id }} 页</span>
                        <span style="font-weight:600; font-size:16px;" v-else>编辑面板</span>
                        <div>
                            <button @click="addNewPage" style="background:#1a73e8; color:white; border:none; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:13px;">➕ 新增子页</button>
                            <button @click="deleteCurrentPage" style="background:#ea4335; color:white; border:none; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:13px; margin-left:8px;">🗑️ 删除</button>
                        </div>
                    </div>

                    <div v-if="currentPage">
                        <div style="margin-bottom:18px;">
                            <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;">正文 (支持Markdown)</label>
                            <textarea v-model="currentPage.content" @input="autoSave" style="width:100%; padding:10px 14px; border:1px solid #ddd; border-radius:8px; font-size:14px; font-family:inherit; box-sizing:border-box; min-height:120px; resize:vertical;"></textarea>
                        </div>
                        <div style="margin-bottom:18px;">
                            <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;">页面类型</label>
                            <select v-model="currentPage.page_type" @change="autoSave" style="width:100%; padding:10px 14px; border:1px solid #ddd; border-radius:8px; font-size:14px; font-family:inherit; box-sizing:border-box;">
                                <option value="start">起始</option>
                                <option value="process">过程</option>
                                <option value="ending">结局</option>
                            </select>
                        </div>
                        <div style="margin-bottom:18px;">
                            <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;"><input type="checkbox" v-model="currentPage.is_true_ending" @change="autoSave"> 是正确结局</label>
                        </div>
                        <div style="margin-bottom:18px;">
                            <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;">分支选项</label>
                            <div v-for="(opt, idx) in currentPage.options" :key="idx" style="display:flex; gap:8px; align-items:center; background:#f8f9fa; padding:8px 12px; border-radius:8px; margin-bottom:8px;">
                                <input type="text" v-model="opt.text" placeholder="选项文字" @input="autoSave" style="flex:2; padding:8px 12px; border:1px solid #ddd; border-radius:6px; font-size:14px; box-sizing:border-box;">
                                <input type="number" v-model.number="opt.jump_local_id" placeholder="跳转页ID" @input="autoSave" style="flex:0.8; padding:8px 12px; border:1px solid #ddd; border-radius:6px; font-size:14px; box-sizing:border-box;">
                                <button @click="removeOption(idx)" style="background:#ea4335; color:white; border:none; width:28px; height:28px; border-radius:50%; cursor:pointer; font-size:16px; flex-shrink:0;">✕</button>
                            </div>
                            <button @click="addOption" style="background:#e8f0fe; color:#1a73e8; border:1px dashed #1a73e8; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:14px;">➕ 添加选项</button>
                        </div>
                        <div style="margin-top:10px;">
                            <button @click="savePage" :disabled="saving" style="background:#1a73e8; color:white; border:none; padding:10px 24px; border-radius:8px; font-weight:500; cursor:pointer; font-size:15px;" :style="{opacity: saving ? 0.6 : 1}">{{ saving ? '保存中...' : '手动保存' }}</button>
                            <span v-show="saved" style="color:#34a853; font-size:14px; margin-left:12px;">✅ 已保存</span>
                        </div>
                    </div>
                    <div v-else style="color:#999; text-align:center; padding:60px 0; font-size:16px;">
                        <p>👆 请点击左侧图中的节点开始编辑</p>
                    </div>
                </div>
            </div>

            <!-- 模态框 -->
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

            <!-- Toast -->
            <div v-if="toastVisible" style="position:fixed; top:30px; left:50%; transform:translateX(-50%); padding:12px 28px; border-radius:12px; color:white; font-size:15px; z-index:10000; box-shadow:0 4px 20px rgba(0,0,0,0.15); background: #34a853;" :style="{background: toastType === 'error' ? '#ea4335' : toastType === 'warning' ? '#fbbc04' : '#34a853', color: toastType === 'warning' ? '#333' : 'white'}">
                {{ toastMessage }}
            </div>
        </div>
    `
});

app.mount('#app');