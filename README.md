
## 📄 `README.md`

# 🎭 故事创作与阅读平台

一个基于 **Flask + Vue 3** 的文字互动游戏（侦探推理剧本）创作与阅读平台。  
创作者可以自由编排故事分支，读者可以沉浸式阅读并做出选择，体验“推理破案”的乐趣。

---

## ✨ 功能特点

### 📖 读者端
- **故事列表**：浏览所有已发布的故事，支持搜索和分页加载。
- **沉浸式阅读**：模拟纸质书的阅读体验，支持 Markdown 渲染。
- **分支选择**：每个页面可设置多个选项，跳转到不同剧情分支。
- **历史回溯**：支持“返回上一步”，方便读者重新选择。

### ✍️ 创作者端
- **故事管理**：新建、编辑、删除故事，支持草稿/发布状态切换。
- **思维导图编辑器**：基于 ECharts 可视化展示故事流程图，点击节点即可编辑。
- **实时保存**：编辑内容自动保存（防抖 1 秒），无需手动点击保存按钮。
- **草稿/发布分离**：已发布的故事在修改时不会影响读者看到的版本，确认无误后一键发布。
- **页面管理**：增删改故事页面，支持设置页面类型（起始/过程/结局）和正确结局标记。

---

## 🛠️ 技术栈

| 技术 | 用途 |
| :--- | :--- |
| **Python 3.11+** | 后端语言 |
| **Flask 2.3** | Web 框架，提供 RESTful API |
| **Flask-SQLAlchemy** | ORM 数据库操作 |
| **SQLite** | 轻量级数据库（可切换到 MySQL/PostgreSQL） |
| **Vue 3** | 前端框架，响应式 UI |
| **ECharts 5** | 思维导图/流程图可视化 |
| **Jinja2** | 仅用于渲染 HTML 骨架，不与 Vue 冲突 |

---

## 📁 项目目录结构

```
StoryGame/
├── app.py                      # Flask 入口（页面路由 + API 蓝图注册）
├── models.py                   # 数据库模型（Story, StoryPage）
├── requirements.txt            # Python 依赖清单
│
├── routes/
│   ├── __init__.py             # 路由包初始化
│   └── api.py                  # 所有 RESTful API 接口
│
├── utils/
│   └── graph_helper.py         # ECharts 图数据构建工具
│
├── static/
│   ├── css/
│   │   ├── reader.css          # 读者端沉浸式阅读样式
│   │   └── creator.css         # 创作端现代化工作台样式
│   └── js/
│       ├── index.js            # 读者故事列表页
│       ├── reader.js           # 读者阅读页
│       ├── creator_index.js    # 创作者工作台
│       └── creator.js          # 编辑器（含 ECharts）
│
├── templates/
│   ├── index.html              # 读者首页骨架
│   ├── reader.html             # 阅读页骨架
│   ├── creator_index.html      # 创作者工作台骨架
│   └── creator.html            # 编辑器骨架
│
└── README.md                   # 本文件
```

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/story-game.git
cd story-game
```

### 2. 创建虚拟环境（推荐）

```bash
python -m venv venv
source venv/bin/activate      # Linux/Mac
# 或
venv\Scripts\activate         # Windows
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

### 4. 初始化数据库

```bash
python -c "from app import app, db; with app.app_context(): db.create_all()"
```

或直接运行 `python app.py`，数据库会自动创建。

### 5. 启动服务

```bash
python app.py
```

访问：
- 读者首页：http://localhost:5000/
- 创作者工作台：http://localhost:5000/creator

---

## 📡 API 接口文档

### 故事管理

| 方法 | 路径 | 描述 |
| :--- | :--- | :--- |
| GET | `/api/stories` | 获取故事列表（读者端自动过滤未发布） |
| GET | `/api/story/<story_id>` | 获取故事详情 |
| POST | `/api/story` | 创建新故事（默认草稿） |
| DELETE | `/api/story/<story_id>` | 删除故事（级联删除所有页面） |
| POST | `/api/story/<story_id>/publish` | 发布故事（草稿覆盖正式版） |

### 页面管理

| 方法 | 路径 | 描述 |
| :--- | :--- | :--- |
| GET | `/api/page/<story_id>/<local_id>?mode=edit` | 获取页面详情（mode=edit 返回草稿） |
| PUT | `/api/page/<page_id>` | 更新页面（只写草稿区） |
| POST | `/api/page/<story_id>` | 新增页面 |
| DELETE | `/api/page/<page_id>` | 删除页面（检查引用） |

### 图数据（ECharts 渲染）

| 方法 | 路径 | 描述 |
| :--- | :--- | :--- |
| GET | `/api/graph/<story_id>?mode=edit` | 获取故事图数据（节点+边） |

---

## 🗄️ 数据库结构

### `story` 表

| 字段 | 类型 | 描述 |
| :--- | :--- | :--- |
| `story_id` | INTEGER | 主键，自增 |
| `story_name` | TEXT | 故事名称 |
| `story_desc` | TEXT | 故事简介 |
| `create_time` | TIMESTAMP | 创建时间 |
| `is_published` | BOOLEAN | 是否已发布（0/1） |
| `has_draft` | BOOLEAN | 是否有未发布的草稿 |
| `update_time` | TIMESTAMP | 最后更新时间 |

### `story_page` 表

| 字段 | 类型 | 描述 |
| :--- | :--- | :--- |
| `global_id` | INTEGER | 主键，自增 |
| `story_id` | INTEGER | 外键，关联 `story.story_id` |
| `local_page_id` | INTEGER | 故事内唯一 ID（起始页为 1） |
| `page_type` | TEXT | 页面类型：start / process / ending |
| `content` | TEXT | 正文（读者看到的正式版） |
| `options` | TEXT | 选项 JSON 字符串，如 `[{"text":"选项","jump_local_id":2}]` |
| `is_true_ending` | INTEGER | 是否正确结局（0/1） |
| `pos_x` | INTEGER | ECharts 节点 X 坐标 |
| `pos_y` | INTEGER | ECharts 节点 Y 坐标 |
| `draft_content` | TEXT | 草稿版正文（创作者编辑中） |
| `draft_options` | TEXT | 草稿版选项 JSON |
| `has_draft` | BOOLEAN | 是否有未发布的草稿 |

---

## 🎯 核心交互流程

### 创作者工作流

1. **新建故事**：自动创建起始页（`local_page_id=1`）
2. **编辑页面**：左侧思维导图点击节点 → 右侧编辑内容/选项
3. **增删页面**：通过“新增子页”按钮创建新页面，或在编辑器中删除页面
4. **实时保存**：编辑内容后自动保存到草稿区（不影响读者）
5. **发布故事**：确认无误后点击“发布”，原子覆盖到正式版

### 读者体验流程

1. **浏览故事**：在首页查看已发布的故事列表
2. **开始阅读**：点击故事进入阅读页，自动从第 1 页开始
3. **做出选择**：阅读内容后点击下方选项按钮，跳转到对应页面
4. **历史回溯**：随时点击“返回上一步”重新选择

---

## 🔧 配置说明

### 修改数据库

默认使用 SQLite，如需切换到 MySQL/PostgreSQL，修改 `app.py` 中的 `SQLALCHEMY_DATABASE_URI`：

```python
# MySQL
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://user:password@localhost/story_game'

# PostgreSQL
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:password@localhost/story_game'
```

### 修改端口

```bash
python app.py --port=8080
```

---

## 📦 依赖清单 (`requirements.txt`)

```
Flask==2.3.3
Flask-SQLAlchemy==3.1.1
```

---

## 🤝 贡献指南

欢迎提交 Issue 或 Pull Request！

---

## 📄 许可证

[MIT License](LICENSE)

---

## 🙋 常见问题

### Q: 为什么发布后读者看不到新内容？
A: 确保已点击“发布故事”按钮，草稿才会覆盖到正式版。

### Q: 删除页面时提示“被其他页面引用”？
A: 说明有其他页面的选项跳转到该页面，需要先修改那些页面的选项后再删除。

### Q: 思维导图不显示或报错？
A: 检查是否创建了起始页（`local_page_id=1`），如果没有起始页，图数据为空。

---

**🎉 祝你创作愉快！** 如果有任何问题，欢迎通过 Issue 联系。