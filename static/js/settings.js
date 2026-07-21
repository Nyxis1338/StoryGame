const { createApp } = Vue;

createApp({
    data() {
        return {
            oldPassword: '',
            newPassword: '',
            confirmPassword: '',
            loading: false,
            error: '',
            success: ''
        };
    },
    methods: {
        changePassword() {
            if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
                this.error = '请完整填写所有字段';
                return;
            }
            if (this.newPassword.length < 6) {
                this.error = '新密码至少6位';
                return;
            }
            if (this.newPassword !== this.confirmPassword) {
                this.error = '两次输入的新密码不一致';
                return;
            }

            this.loading = true;
            this.error = '';
            this.success = '';

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
                    this.success = '✅ 密码修改成功！';
                    this.oldPassword = '';
                    this.newPassword = '';
                    this.confirmPassword = '';
                } else {
                    this.error = data.error || '修改失败';
                }
                this.loading = false;
            })
            .catch(() => {
                this.error = '网络错误，请重试';
                this.loading = false;
            });
        }
    },
    template: `
        <div style="max-width:500px; margin:60px auto; background:white; padding:40px; border-radius:16px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
            <h1 style="font-size:24px; color:#1a1a2e; margin-bottom:8px;">⚙️ 修改密码</h1>
            <p style="color:#888; font-size:14px; margin-bottom:30px;">修改管理员登录密码</p>

            <div style="margin-bottom:18px;">
                <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;">当前密码</label>
                <input type="password" v-model="oldPassword" placeholder="请输入当前密码" style="width:100%; padding:10px 14px; border:1px solid #ddd; border-radius:8px; font-size:15px; outline:none;">
            </div>
            <div style="margin-bottom:18px;">
                <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;">新密码</label>
                <input type="password" v-model="newPassword" placeholder="请输入新密码（至少6位）" style="width:100%; padding:10px 14px; border:1px solid #ddd; border-radius:8px; font-size:15px; outline:none;">
            </div>
            <div style="margin-bottom:18px;">
                <label style="display:block; font-weight:500; font-size:14px; color:#333; margin-bottom:4px;">确认新密码</label>
                <input type="password" v-model="confirmPassword" placeholder="请再次输入新密码" style="width:100%; padding:10px 14px; border:1px solid #ddd; border-radius:8px; font-size:15px; outline:none;">
            </div>

            <button @click="changePassword" :disabled="loading" style="
                width:100%;
                padding:12px;
                background: #1a73e8;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
            " :style="{opacity: loading ? 0.6 : 1}">
                {{ loading ? '修改中...' : '确认修改' }}
            </button>

            <p v-if="error" style="color:#ea4335; font-size:14px; margin-top:8px;">{{ error }}</p>
            <p v-if="success" style="color:#34a853; font-size:14px; margin-top:8px;">{{ success }}</p>

            <a href="/creator" style="display:inline-block; margin-top:16px; color:#666; text-decoration:none; font-size:14px;">← 返回工作台</a>
        </div>
    `
}).mount('#app');