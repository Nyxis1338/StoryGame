const { createApp } = Vue;

createApp({
    data() {
        return {
            password: '',
            loading: false,
            error: ''
        };
    },

    methods: {
        login() {
            // 清理密码：去除首尾空白字符（包括换行、空格等）
            const password = this.password.trim();
            
            if (!password) {
                this.error = '请输入密码';
                return;
            }
            
            this.loading = true;
            this.error = '';
            fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })  // 发送清理后的密码
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    window.location.href = '/creator';
                } else {
                    this.error = data.error || '密码错误';
                    this.loading = false;
                }
            })
            .catch(() => {
                this.error = '网络错误，请重试';
                this.loading = false;
            });
        }
    },

    template: `
        <div class="login-container" style="
            max-width: 400px;
            margin: 80px auto;
            background: white;
            padding: 48px 40px;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.1);
        ">
            <div style="text-align:center; font-size:48px; margin-bottom:10px;">📚</div>
            <h1 style="text-align:center; font-size:24px; color:#1a1a2e; margin-bottom:30px;">管理员登录</h1>
            <div style="margin-bottom:18px;">
            <input type="password" 
                v-model="password" 
                placeholder="请输入密码" 
                @input="password = password.trim()" 
                @keydown.enter="login"
                style="width:100%; padding:12px 16px; border:1px solid #ddd; border-radius:8px; font-size:15px; outline:none;">
            </div>
            <button @click="login" :disabled="loading" style="
                width: 100%;
                padding: 12px;
                background: #1a73e8;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
            " :style="{opacity: loading ? 0.6 : 1}">
                {{ loading ? '登录中...' : '登 录' }}
            </button>
            <p v-if="error" style="color:#ea4335; font-size:14px; text-align:center; margin-top:12px;">{{ error }}</p>
            <p style="text-align:center; font-size:13px; color:#999; margin-top:16px;">默认密码: storygame</p>
        </div>
    `
}).mount('#app');