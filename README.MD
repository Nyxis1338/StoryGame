## Story Game

### 安装依赖
pip install flask

### 运行后端
python app.py

打开浏览器访问：`http://127.0.0.1:5000/init`
目录不存在 `game.db` → 自动新建 `game.db` 文件

### 关键说明

- 重复访问 `/init` 会**清空原有数据重建库**（脚本里写了 `DROP TABLE IF EXISTS game_page`），正式写剧本后不要随便访问

### /init 密码保护

1. 访问 `/init` 弹出密码输入框
2. 密码 `storygame` 正确才执行重建库，错误返回表单并提示
3. 避免游客误删所有剧本数据

### 单库多故事分表设计

- `story` 表存所有剧本名称、简介
- `story_page` 通过 `story_id` 外键绑定所属故事，完全隔离不同剧本剧情
- 新增故事仅需要在`story`插入一行，再配套插入对应 page，不改动原有代码逻辑，扩展性极强

### 新增故事的表样
new_story_art.sql

```
StoryGame/
├── app.py                     # Flask 后端主程序（全部业务逻辑）
├── schema.sql                 # 数据库初始化完整脚本（重置库使用）
├── game.db                    # SQLite数据库文件（运行/init后自动生成）
├── sql_upload_tmp/            # SQL上传临时缓存目录（程序自动创建）
└── templates/                 # 所有前端页面模板
    ├── base.html              # 全局公共布局、Tailwind样式、提示弹窗
    ├── story_list.html        # 首页-故事选择列表（自适应多卡片、底部管理入口）
    ├── page.html              # 剧情阅读+选择按钮页面
    ├── ending.html            # 结局展示页面（真假结局区分、防直链）
    ├── init_password.html     # 数据库重置密码验证页
    ├── sql_upload.html        # 剧本SQL上传导入后台（带密码校验+表结构说明）
    └── password_edit.html     # 管理员密码修改页面

```

### 新建独立 `.sql` 增量文件上传
```
StoryGame/
├── new_story_art.sql     # 校园画室失踪案增量导入脚本（上传专用，不放入项目固定源码）
├── 新增剧本模板.sql
```
