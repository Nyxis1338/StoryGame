const { createApp } = Vue;

createApp({
    data() {
        return {
            // 当前视图
            currentView: 'stories', // stories | trash | settings | backup

            // 故事列表
            stories: [],
            page: 1,
            perPage: 10,
            loading: false,
            hasMore: true,
            keyword: '',
            filterStatus: 'published',

            // 回收站
            trashItems: [],
            trashLoading: false,

            // 设置
            oldPassword: '',
            newPassword: '',
            confirmPassword: '',
            passwordMessage: '',
            passwordError: '',

            // 编辑故事模态框
            editModalVisible: false,
            editingStory: { story_id: null, story_name: '', story_desc: '' },

            // 全局模态框（确认对话框）
            modalVisible: false,
            modalTitle: '提示',
            modalMessage: '',
            modalConfirmText: '确定',
            modalCancelText: '取消',
            modalResolve: null,
            modalIsDanger: false,

            // Toast
            toastVisible: false,
            toastMessage: '',
            toastType: 'success',
            toastTimer: null,

            loading: false, // 用于修改密码按钮
        };
    },
    methods: {
        // ============================================================
        // 全局模态框 / Toast
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

        // ============================================================
        // 故事列表
        // ============================================================
        fetchStories(reset = false) {
            if (this.loading) return;
            if (reset) {
                this.page = 1;
                this.hasMore = true;
                this.stories = [];
            }
            if (!this.hasMore) return;

            this.loading = true;
            const params = {
                page: this.page,
                per_page: this.perPage,
                status: this.filterStatus === 'all' ? 'all' : this.filterStatus,
            };
            if (this.keyword.trim()) {
                params.q = this.keyword.trim();
            }

            StoryAPI.getStories(params)
                .then(data => {
                    this.stories.push(...data.items);
                    this.hasMore = data.page < data.pages;
                    this.page = data.page + 1;
                })
                .catch(err => {
                    console.error('获取故事列表失败:', err);
                    this.showToast('加载故事列表失败，请刷新重试', 'error');
                })
                .finally(() => {
                    this.loading = false;
                });
        },

        setFilter(status) {
            this.filterStatus = status;
            this.fetchStories(true);
        },

        search() {
            this.fetchStories(true);
        },

        createStory() {
            StoryAPI.createStory()
                .then(data => {
                    window.location.href = `/creator/${data.story_id || data.id}`;
                })
                .catch(err => {
                    console.error('创建故事失败:', err);
                    this.showToast('创建故事失败，请重试', 'error');
                });
        },

        deleteStory(id) {
            this.showConfirm('确认删除', '确定要删除此故事吗？\n删除后可在回收站中恢复。', '删除', '取消', true)
                .then(confirmed => {
                    if (confirmed) {
                        StoryAPI.deleteStory(id)
                            .then(() => {
                                this.showToast('✅ 已移至回收站', 'success');
                                this.fetchStories(true);
                            })
                            .catch(err => {
                                console.error('删除故事失败:', err);
                                this.showToast('❌ 删除失败: ' + err.message, 'error');
                            });
                    }
                });
        },

        // ============================================================
        // 编辑故事
        // ============================================================
        editStory(story) {
            this.editingStory = {
                story_id: story.story_id,
                story_name: story.story_name,
                story_desc: story.story_desc || '',
            };
            this.editModalVisible = true;
        },

        saveStoryEdit() {
            const data = {
                story_name: this.editingStory.story_name,
                story_desc: this.editingStory.story_desc,
            };
            StoryAPI.updateStory(this.editingStory.story_id, data)
                .then(() => {
                    this.editModalVisible = false;
                    this.fetchStories(true);
                    this.showToast('✅ 故事信息已更新', 'success');
                })
                .catch(err => {
                    console.error('更新故事失败:', err);
                    this.showToast('❌ 更新失败: ' + err.message, 'error');
                });
        },

        // ============================================================
        // 回收站
        // ============================================================
        fetchTrash() {
            this.trashLoading = true;
            StoryAPI.getTrash()
                .then(data => {
                    this.trashItems = data;
                })
                .catch(err => {
                    console.error('获取回收站失败:', err);
                    this.showToast('加载回收站失败，请重试', 'error');
                })
                .finally(() => {
                    this.trashLoading = false;
                });
        },

        restoreStory(id) {
            this.showConfirm('确认恢复', '确定恢复此故事吗？', '恢复', '取消')
                .then(confirmed => {
                    if (confirmed) {
                        StoryAPI.restoreStory(id)
                            .then(() => {
                                this.showToast('✅ 恢复成功', 'success');
                                this.fetchTrash();
                                this.fetchStories(true);
                            })
                            .catch(err => {
                                console.error('恢复故事失败:', err);
                                this.showToast('❌ 恢复失败: ' + err.message, 'error');
                            });
                    }
                });
        },

        permanentDeleteStory(id) {
            this.showConfirm(
                '⚠️ 确认永久删除',
                '确定永久删除此故事吗？\n此操作不可恢复！',
                '永久删除',
                '取消',
                true
            ).then(confirmed => {
                if (confirmed) {
                    StoryAPI.permanentDeleteStory(id)
                        .then(() => {
                            this.showToast('✅ 已永久删除', 'success');
                            this.fetchTrash();
                        })
                        .catch(err => {
                            console.error('永久删除失败:', err);
                            this.showToast('❌ 删除失败: ' + err.message, 'error');
                        });
                }
            });
        },

        // ============================================================
        // 设置（修改密码）
        // ============================================================
        changePassword() {
            if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
                this.passwordError = '请完整填写所有字段';
                return;
            }
            if (this.newPassword.length < 6) {
                this.passwordError = '新密码至少6位';
                return;
            }
            if (this.newPassword !== this.confirmPassword) {
                this.passwordError = '两次输入的新密码不一致';
                return;
            }
            this.passwordError = '';
            this.passwordMessage = '';
            this.loading = true; // 开始加载

            fetch('/api/auth/change_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    old_password: this.oldPassword,
                    new_password: this.newPassword,
                }),
            })
                .then(res => {
                    if (!res.ok) throw new Error(`修改密码失败 (${res.status})`);
                    return res.json();
                })
                .then(data => {
                    if (data.status === 'success') {
                        this.passwordMessage = '✅ 密码修改成功！';
                        this.oldPassword = '';
                        this.newPassword = '';
                        this.confirmPassword = '';
                    } else {
                        this.passwordError = data.error || '修改失败';
                    }
                })
                .catch(err => {
                    console.error('修改密码失败:', err);
                    this.passwordError = '网络错误，请重试';
                })
                .finally(() => {
                    this.loading = false;
                });
        },

        // ============================================================
        // 数据备份
        // ============================================================
        exportBackup() {
            window.location.href = '/api/backup/export';
        },

        importBackup(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                this.showConfirm(
                    '确认导入',
                    '导入将覆盖现有所有数据，确定继续？',
                    '导入',
                    '取消',
                    true
                ).then(confirmed => {
                    if (confirmed) {
                        fetch('/api/backup/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: e.target.result,
                        })
                            .then(res => {
                                if (!res.ok) throw new Error(`导入失败 (${res.status})`);
                                return res.json();
                            })
                            .then(data => {
                                this.showToast(`导入成功，共 ${data.imported} 个故事`, 'success');
                                location.reload();
                            })
                            .catch(err => {
                                console.error('导入失败:', err);
                                this.showToast('导入失败: ' + err.message, 'error');
                            });
                    }
                });
            };
            reader.readAsText(file);
        },

        // ============================================================
        // 通用
        // ============================================================
        logout() {
            this.showConfirm('确认退出', '确定要退出登录吗？', '退出', '取消')
                .then(confirmed => {
                    if (confirmed) {
                        StoryAPI.logout() // 需要在 story_api.js 中添加此方法
                            .then(() => {
                                window.location.href = '/login';
                            })
                            .catch(err => {
                                console.error('退出登录失败:', err);
                                // 即使 API 失败也强制跳转
                                window.location.href = '/login';
                            });
                    }
                });
        },

        formatDate(iso) {
            if (!iso) return '未知';
            return new Date(iso).toLocaleDateString('zh-CN');
        },
    },

    watch: {
        currentView(newVal) {
            if (newVal === 'trash') {
                this.fetchTrash();
            }
        },
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

    template: '#creator-template',
}).mount('#app');