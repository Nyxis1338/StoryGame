import os

# 基础配置
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SECRET_KEY = "your-secret-key-change-me"  # 生产环境务必修改
DB_PATH = os.path.join(BASE_DIR, "game.db")

# 端口配置
USER_PORT = 5000    # 读者端（公网开放）
ADMIN_PORT = 5001   # 管理端（仅内网/本地访问）

# 管理员密码（原有逻辑保留，可自行修改）
ADMIN_PASSWORD = "storygame"

# 思维导图配置
MINDMAP_DEFAULT_POS = {"x": 50, "y": 50}