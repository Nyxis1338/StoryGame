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
            targetPageId: null,

            // 连线编辑
            currentEdge: null,
            edgeSourceAnchor: 'right',
            edgeTargetAnchor: 'left',
            edgeLabel: '',
            edgeOptionId: null,
            edgeConnection: null,  // 引用 jsPlumb 连接对象

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
                    this.currentPage.id = data.id;
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

        addNewPage() {
            if (!this.currentPage) return;
            const newPageId = JsPlumbRenderer.getNextAvailablePageId();
            const maxId = JsPlumbRenderer.getMaxNodeId() + 1;

            StoryAPI.createPage(this.storyId, {
                page_id: newPageId,           // ✅ 改为 page_id
                content: '# 新页面\n请编辑内容',
                // ❌ 移除 options 字段
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

        // ============================================================
        // 选项管理
        // ============================================================
        addOption() {
            if (!this.currentPage) {
                this.showToast('请先选择一个页面', 'warning');
                return;
            }
            this.optionText = '';
            this.targetPageId = null;
            this.optionModalVisible = true;

        },

        removeOption(idx) {
            if (!this.currentPage) return;
            const opt = this.currentPage.options[idx];
            const sourcePage = this.currentPage.local_id;
            const targetPage = opt.jump_local_id;
            // 删除选项（调用 API）
            StoryAPI.removeOption(this.storyId, {
                source_page: sourcePage,
                target_page: targetPage
            })
            .then(() => {
                // 从本地移除
                this.currentPage.options.splice(idx, 1);
                // 刷新图
                this.refreshGraph();
                this.showToast('✅ 分支已删除', 'success');
            })
            .catch(err => {
                console.error('删除分支失败:', err);
                this.showToast('❌ 删除分支失败', 'error');
            });
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
                .then(() => {
                    // 添加选项
                    return this.addOptionToCurrentPage(targetId);
                })
                .catch(err => {
                    console.error('创建页面失败:', err);
                    this.showToast('创建页面失败: ' + err.message, 'error');
                    this.optionModalVisible = false;
                });
            } else {
                // 直接添加选项
                this.addOptionToCurrentPage(targetId);
            }
        },

        addOptionToCurrentPage(targetId) {
            return StoryAPI.addOption(this.storyId, {
                source_page: this.currentPage.local_id,
                target_page: targetId,
                option_text: this.optionText.trim(),
                source_anchor: 'right',
                target_anchor: 'left'
            })
            .then(() => {
                // 刷新图数据和当前页面
                this.refreshGraph();
                this.loadPage(this.currentPage.local_id);
                this.showToast('✅ 分支添加成功', 'success');
                this.optionModalVisible = false;
            })
            .catch(err => {
                console.error('添加分支失败:', err);
                this.showToast('添加分支失败: ' + err.message, 'error');
                throw err; // 继续抛出，让上层处理
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
        },

        saveEdge() {
            if (!this.edgeOptionId) return;
            StoryAPI.updateOption(this.edgeOptionId, {
                source_anchor: this.edgeSourceAnchor,
                target_anchor: this.edgeTargetAnchor,
                option_text: this.edgeLabel
            })
            .then(() => {
                this.showToast('✅ 连线设置已保存', 'success');
                this.currentEdge = null;
                this.refreshGraph();  // 刷新图以更新锚点
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
                    // 需要知道 source 和 target 来调用 removeOption（或使用 option_id）
                    // 我们可以新增一个基于 option_id 的删除接口
                    // 或者通过 source/target 删除
                    // 这里我们使用 source/target
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


    },

    mounted() {
        // 初始化渲染器，传入回调
        JsPlumbRenderer.init('chart-container', {
            onNodeClick: (nodeId) => {
                this.loadPage(nodeId);
                JsPlumbRenderer.highlightNode(nodeId);  // 高亮当前选中的节点
            },
            onEdgeClick: (edgeData) => {
                this.currentEdge = edgeData;
                this.edgeOptionId = edgeData.option_id;
                this.edgeSourceAnchor = edgeData.sourceAnchor;
                this.edgeTargetAnchor = edgeData.targetAnchor;
                this.edgeLabel = edgeData.label;
                this.edgeConnection = edgeData.connection;
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
                        console.error('sourceLocalId:', sourceLocalId, 'targetLocalId:', targetLocalId);
                        this.showToast('同步连线数据失败: ' + err.message, 'error');
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

    // 引用外部模板
    template: '#creator-template'
});

app.mount('#app');