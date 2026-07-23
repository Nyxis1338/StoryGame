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
        };
    },
    methods: {
        // ---------- 故事列表 ----------
        fetchStories(reset = false) {
            if (this.loading) return;
            if (reset) {
                this.page = 1;
                this.hasMore = true;
                this.stories = [];
            }
            if (!this.hasMore) return;

            this.loading = true;
            let url = `/api/stories?page=${this.page}&per_page=${this.perPage}`;
            if (this.filterStatus !== 'all') {
                url += `&status=${this.filterStatus}`;
            } else {
                url += `&status=all`;   // 明确传递 all
            }
            if (this.keyword.trim()) {
                url += `&q=${encodeURIComponent(this.keyword.trim())}`;
            }

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    this.stories.push(...data.items);
                    this.hasMore = data.page < data.pages;
                    this.page = data.page + 1;
                    this.loading = false;
                })
                .catch(() => {
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
            fetch('/api/story', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    window.location.href = `/creator/${data.story_id || data.id}`;
                });
        },

        deleteStory(id) {
            if (!confirm('确定要删除此故事吗？\n删除后可在回收站中恢复。')) return;
            fetch(`/api/story/${id}`, { method: 'DELETE' })
                .then(() => {
                    alert('✅ 已移至回收站');
                    this.fetchStories(true);
                });
        },

        // ---------- 编辑故事 ----------
        editStory(story) {
            this.editingStory = {
                story_id: story.story_id,
                story_name: story.story_name,
                story_desc: story.story_desc || ''
            };
            this.editModalVisible = true;
        },

        saveStoryEdit() {
            const data = {
                story_name: this.editingStory.story_name,
                story_desc: this.editingStory.story_desc
            };
            fetch(`/api/story/${this.editingStory.story_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(res => res.json())
            .then(() => {
                this.editModalVisible = false;
                // 刷新列表
                this.fetchStories(true);
                alert('✅ 故事信息已更新');
            })
            .catch(err => {
                console.error('更新失败:', err);
                alert('❌ 更新失败，请重试');
            });
        },

        // ---------- 回收站 ----------
        fetchTrash() {
            this.trashLoading = true;
            fetch('/api/trash')
                .then(res => res.json())
                .then(data => {
                    this.trashItems = data;
                    this.trashLoading = false;
                })
                .catch(() => {
                    this.trashLoading = false;
                });
        },

        restoreStory(id) {
            if (!confirm('确定恢复此故事吗？')) return;
            fetch(`/api/story/${id}/restore`, { method: 'POST' })
                .then(() => {
                    alert('✅ 恢复成功');
                    this.fetchTrash();
                    this.fetchStories(true);
                });
        },

        permanentDeleteStory(id) {
            if (!confirm('⚠️ 确定永久删除此故事吗？\n此操作不可恢复！')) return;
            fetch(`/api/story/${id}/permanent`, { method: 'DELETE' })
                .then(() => {
                    alert('✅ 已永久删除');
                    this.fetchTrash();
                });
        },

        // ---------- 设置 ----------
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

            fetch('/api/auth/change_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    old_password: this.oldPassword,
                    new_password: this.newPassword
                })
            })
            .then(res => res.json())
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
            .catch(() => {
                this.passwordError = '网络错误，请重试';
            });
        },

        // ---------- 备份 ----------
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

        // ---------- 通用 ----------
        logout() {
            fetch('/api/auth/logout', { method: 'POST' })
                .then(() => {
                    window.location.href = '/login';
                });
        },

        formatDate(iso) {
            if (!iso) return '未知';
            return new Date(iso).toLocaleDateString('zh-CN');
        },

        // ---------- 监听导航切换 ----------
        handleViewChange() {
            if (this.currentView === 'trash') {
                this.fetchTrash();
            }
        }
    },
    watch: {
        currentView(newVal) {
            if (newVal === 'trash') {
                this.fetchTrash();
            }
        }
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
    template: '#creator-template'
}).mount('#app');