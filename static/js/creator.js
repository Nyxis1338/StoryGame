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
            optionModalVisible: false,
            optionText: '',
            sourcePageId: null,
            targetPageId: null,

            // 连线编辑
            currentEdge: null,
            edgeSourceAnchor: 'bottom',
            edgeTargetAnchor: 'top',
            edgeLabel: '',
            edgeOptionId: null,
            edgeConnection: null,
        };
    },

    methods: {
        // ============================================================
        // 页面加载
        // ============================================================
        loadPage(pageId) {
            StoryAPI.getPage(this.storyId, pageId)
                .then(data => {
                    this.currentPage = data;
                    // 确保 local_id 或 page_id 存在
                    this.currentPage.page_id = data.local_id || data.page_id || pageId;
                    this.hasUnsavedChanges = false;
                })
                .catch(err => {
                    console.error('加载页面失败:', err);
                    this.showToast('加载页面失败', 'error');
                });
        },

        // ============================================================
        // 保存相关（不再保存 options，由独立 API 管理）
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

            // 构建选项数据（包含 option_id 和 text）
            const optionsData = (this.currentPage.options || []).map(opt => ({
                option_id: opt.option_id,
                text: opt.text
            }));

            StoryAPI.updatePage(this.currentPage.id, {
                content: this.currentPage.content,
                page_type: this.currentPage.page_type,
                options: optionsData,   // 新增：传递选项文本更新
            })
            .then(() => {
                this.saving = false;
                this.saved = true;
                this.hasUnsavedChanges = false;
                setTimeout(() => { this.saved = false; }, 2000);
                // 刷新图数据，使节点预览和连线标签同步更新
                this.refreshGraph();
                this.showToast('✅ 保存成功', 'success');
            })
            .catch(err => {
                console.error('保存失败:', err);
                this.saving = false;
                this.showToast('❌ 保存失败', 'error');
            });
        },

        // ============================================================
        // 页面管理（新增/删除）
        // ============================================================
        addNewPage() {
            if (!this.currentPage) return;
            // 获取下一个可用 ID（复用已删除的空缺）
            const maxId = JsPlumbRenderer.getMaxNodeId() + 1;
            // 简单起见直接使用 maxId + 1，如需复用空缺可扩展
            const newPageId = maxId || 1;
            StoryAPI.createPage(this.storyId, {
                page_id: newPageId,
                content: '# 新页面\n请编辑内容',
                pos_x: 100 + Math.random() * 200,
                pos_y: 100 + Math.random() * 200
            })
            .then(() => {
                this.refreshGraph();
                this.showToast('✅ 新页面创建成功', 'success');
            })
            .catch(err => {
                console.error('创建页面失败:', err);
                this.showToast('❌ 创建失败: ' + (err.message || '未知错误'), 'error');
            });
        },

        deleteCurrentPage() {
            if (!this.currentPage) return;
            this.showConfirm(
                '⚠️ 确认删除',
                `确定删除第 ${this.currentPage.page_id} 页吗？此操作不可撤销！`,
                '确定删除',
                '取消',
                true
            ).then(confirmed => {
                if (confirmed) {
                    const nodeId = this.currentPage.page_id;
                    StoryAPI.deletePage(this.currentPage.id)
                        .then(() => {
                            JsPlumbRenderer.deleteNode(nodeId);
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
        // 分支选项管理（通过 story_page_options 独立 API）
        // ============================================================
        addOption() {
            if (!this.currentPage) {
                this.showToast('请先选择一个页面', 'warning');
                return;
            }
            this.optionText = '';
            this.sourcePageId = null;
            this.targetPageId = null;
            this.optionModalVisible = true;
        },

        confirmAddOption() {
            if (!this.optionText.trim() || !this.targetPageId) {
                this.showToast('请完整填写选项文字和目标页面ID', 'warning');
                return;
            }
            const targetId = parseInt(this.targetPageId);
            if (isNaN(targetId) || targetId < 1) {
                this.showToast('目标页面ID必须是有效的正整数', 'warning');
                return;
            }

            // 检查目标页是否存在
            const existingNode = (this.graphData.nodes || []).find(n => n.id === targetId);
            if (!existingNode) {
                // 创建目标页（使用指定的 page_id）
                StoryAPI.createPage(this.storyId, {
                    page_id: targetId,
                    content: '# 新页面\n请编辑内容',
                    pos_x: 100 + Math.random() * 300,
                    pos_y: 100 + Math.random() * 200
                })
                .then(() => this.addOptionToCurrentPage(targetId))
                .catch(err => {
                    console.error('创建页面失败:', err);
                    this.showToast('创建页面失败: ' + err.message, 'error');
                    this.optionModalVisible = false;
                });
            } else {
                this.addOptionToCurrentPage(targetId);
            }
        },

        addOptionToCurrentPage(targetId) {
            console.log('当前页面:', this.currentPage);
            console.log('page_id:', this.currentPage?.page_id); 
            StoryAPI.addOption(this.storyId, {
                source_page: this.currentPage.page_id,
                target_page: targetId,
                option_text: this.optionText.trim(),
                source_anchor: 'bottom',
                target_anchor: 'top'
            })
            .then(() => {
                this.refreshGraph();
                this.loadPage(this.currentPage.page_id);
                this.showToast('✅ 分支添加成功', 'success');
                this.optionModalVisible = false;
            })
            .catch(err => {
                console.error('添加分支失败:', err);
                this.showToast('添加分支失败: ' + err.message, 'error');
            });
        },

        removeOption(idx) {
            if (!this.currentPage) return;
            const opt = this.currentPage.options[idx];
            const sourcePage = this.currentPage.page_id;
            const targetPage = opt.jump_local_id;
            StoryAPI.removeOption(this.storyId, {
                source_page: sourcePage,
                target_page: targetPage
            })
            .then(() => {
                this.currentPage.options.splice(idx, 1);
                this.refreshGraph();
                this.showToast('✅ 分支已删除', 'success');
            })
            .catch(err => {
                console.error('删除分支失败:', err);
                this.showToast('❌ 删除分支失败', 'error');
            });
        },

        // ============================================================
        // 图表渲染（调用渲染器）
        // ============================================================
        refreshGraph() {
            StoryAPI.getGraph(this.storyId)
                .then(data => {
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
        // 连线锚点编辑
        // ============================================================
        saveEdge() {
            if (!this.edgeOptionId) {
                this.showToast('⚠️ 该连线尚未保存到数据库，请刷新后再试', 'warning');
                return;
            }
            StoryAPI.updateOption(this.edgeOptionId, {
                source_anchor: this.edgeSourceAnchor,
                target_anchor: this.edgeTargetAnchor,
                option_text: this.edgeLabel
            })
            .then(() => {
                this.showToast('✅ 连线设置已保存', 'success');
                this.currentEdge = null;
                this.refreshGraph();
            })
            .catch(err => {
                console.error('保存连线失败:', err);
                this.showToast('❌ 保存连线失败', 'error');
            });
        },

        deleteEdge() {
            if (!this.edgeOptionId) return;
            this.showConfirm(
                '确认删除',
                '确定要删除此连线吗？',
                '删除',
                '取消',
                true
            ).then(confirmed => {
                if (confirmed) {
                    StoryAPI.removeOption(this.storyId, {
                        source_page: this.currentEdge.source,
                        target_page: this.currentEdge.target
                    })
                    .then(() => {
                        this.showToast('✅ 连线已删除', 'success');
                        this.currentEdge = null;
                        this.refreshGraph();
                    })
                    .catch(err => {
                        console.error('删除连线失败:', err);
                        this.showToast('❌ 删除连线失败', 'error');
                    });
                }
            });
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
                this.loadPage(this.currentPage.page_id);
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
                JsPlumbRenderer.highlightNode(nodeId);
                // 点击节点时隐藏连线设置
                this.currentEdge = null;
                this.edgeOptionId = null;
            },
            onEdgeClick: (edgeData) => {
                // 如果点击的是同一条连线，则取消选中
                if (this.currentEdge && this.currentEdge.option_id === edgeData.option_id) {
                    this.currentEdge = null;
                    this.edgeOptionId = null;
                    // 可清除其他状态
                    return;
                }
                // 1. 加载源页面内容（显示在右侧编辑面板）
                this.loadPage(edgeData.source);
                // 2. 高亮源节点（左侧思维导图）
                JsPlumbRenderer.highlightNode(edgeData.source);
                // 3. 设置连线数据（用于下方连线设置区）
                this.currentEdge = edgeData;
                this.edgeOptionId = edgeData.option_id;
                this.edgeSourceAnchor = edgeData.sourceAnchor;
                this.edgeTargetAnchor = edgeData.targetAnchor;
                this.edgeLabel = edgeData.label;
                this.edgeConnection = edgeData.connection;
                console.log('连线点击数据:', edgeData);
            },
            onNodeMove: (nodeId, x, y) => {
                if (this._saveGraphTimer) clearTimeout(this._saveGraphTimer);
                this._saveGraphTimer = setTimeout(() => {
                    this.saveGraphData();
                }, 500);
            },
            // 简化 onOptionChange：仅刷新图数据，因为增删操作已在独立方法中完成
            onOptionChange: (sourcePageId, targetPageId, action, label) => {
                // 直接刷新图数据，无需重复调用 API
                this.refreshGraph();
                // 如果当前页面是源页面，重新加载以更新分支列表
                if (this.currentPage && this.currentPage.page_id === sourcePageId) {
                    this.loadPage(sourcePageId);
                }
            },
            onLabelChange: (sourcePageId, targetPageId, newLabel) => {
                // this.saveGraphData();
            }
        });

        this.refreshGraph();

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

    template: '#creator-template'
});

app.mount('#app');