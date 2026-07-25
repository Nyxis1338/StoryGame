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
- **思维导图编辑器**：基于 jsPlumb 可视化展示故事流程图，点击节点即可编辑。
- **实时保存**：编辑内容自动保存（防抖 1 秒），无需手动点击保存按钮。
- **草稿/发布分离**：已发布的故事在修改时不会影响读者看到的版本，确认无误后一键发布。
- **页面管理**：增删改故事页面，支持设置页面类型（过程/正确结局/错误结局）。
- **分支管理**：通过“添加选项”创建分支，支持指定目标页面和选项文字。
- **连线编辑**：点击连线可调整锚点方向（源/目标锚点），删除连线。

---

## 🛠️ 技术栈

| 技术 | 用途 |
| :--- | :--- |
| **Python 3.11+** | 后端语言 |
| **Flask 2.3** | Web 框架，提供 RESTful API |
| **Flask-SQLAlchemy** | ORM 数据库操作 |
| **SQLite** | 轻量级数据库（可切换到 MySQL/PostgreSQL） |
| **Vue 3** | 前端框架，响应式 UI |
| **jsPlumb 2.15.6** | 思维导图/流程图可视化与交互 |
| **Jinja2** | 仅用于渲染 HTML 骨架，不与 Vue 冲突 |

---

## 📁 项目目录结构与文件说明
```
StoryGame/
├── app.py # Flask 入口，注册路由与蓝图
├── models.py # 数据库模型定义
├── requirements.txt # Python 依赖清单
├── routes/
│ ├── init.py # 路由包初始化
│ └── api.py # 所有 RESTful API 接口
├── utils/
│ └── graph_helper.py # 构建图数据（节点+边）工具函数
├── static/
│ ├── css/
│ │ ├── creator.css # 创作端样式（工作台、编辑器、侧边栏）
│ │ └── reader.css # 读者端沉浸式阅读样式
│ └── js/
│ ├── creator.js # 故事编辑器 Vue 组件（核心交互）
│ ├── creator_index.js # 创作者工作台 Vue 组件（故事列表、回收站、设置、备份）
│ ├── index.js # 读者首页 Vue 组件（故事列表）
│ ├── reader.js # 读者阅读页 Vue 组件（分支选择、历史回溯）
│ ├── jsplumb_renderer.js # jsPlumb 渲染器（封装节点、端点、连线交互）
│ ├── story_api.js # 所有后端 API 调用封装
│ └── login.js # 登录页 Vue 组件
├── templates/
│ ├── index.html # 读者首页模板
│ ├── reader.html # 读者阅读页模板
│ ├── login.html # 登录页模板
│ ├── creator_index.html # 创作者工作台模板
│ └── creator.html # 故事编辑器模板
└── README.md # 本文件
```


---

### 核心文件及主要方法说明

#### `app.py`
- `login_required`：登录保护装饰器，未登录跳转到登录页。
- `index()`：读者首页路由。
- `reader_page(story_id)`：读者阅读页路由。
- `login_page()`：登录页路由，已登录重定向到工作台。
- `creator_index()`：创作者工作台路由（需登录）。
- `creator_editor(story_id)`：故事编辑器路由（需登录）。

#### `routes/api.py`（关键 API）
- **认证**：`/auth/login`、`/auth/logout`、`/auth/change_password`
- **故事管理**：`/stories`（列表）、`/story`（POST 创建）、`/story/<id>`（GET/PUT/DELETE）、`/story/<id>/publish`
- **页面管理**：`/page/<story_id>/<page_id>`（GET 页面详情）、`/page/<global_id>`（PUT 更新）、`/page/<story_id>`（POST 创建）、`/page/<global_id>`（DELETE 删除）
- **分支选项**：`/story/<story_id>/option`（POST 添加 / DELETE 删除）、`/option/<option_id>`（PUT 更新锚点或标签）
- **图数据**：`/graph/<story_id>`（GET 节点+边）、`/story/<story_id>/graph`（PUT 保存坐标和边）
- **回收站**：`/trash`（GET 已删除故事）、`/story/<id>/restore`（POST 恢复）、`/story/<id>/permanent`（DELETE 永久删除）
- **备份**：`/backup/export`（GET 导出 JSON）、`/backup/import`（POST 导入 JSON）

#### `utils/graph_helper.py`
- `build_graph_data(story_id, mode)`：从数据库读取页面和选项，构建 ECharts/jsPlumb 可用的 `{ nodes, edges }` 数据结构。

#### `static/js/creator.js`（编辑器核心）
- `loadPage(pageId)`：加载指定页面内容到右侧编辑面板。
- `savePage()`：保存当前页面的正文、类型，并更新选项文本（通过 `options` 数组）。
- `addOption()`：弹出分支添加模态框。
- `confirmAddOption()`：确认添加分支，若目标页不存在则自动创建。
- `removeOption(idx)`：删除指定分支（同时删除连线）。
- `addNewPage()`：新增子页。
- `deleteCurrentPage()`：删除当前页（同时清理相关连线）。
- `refreshGraph()`：获取最新图数据并渲染。
- `saveGraphData()`：保存节点坐标和连线到后端。
- `saveEdge()`：保存当前选中连线的锚点方向。
- `deleteEdge()`：删除当前选中连线。
- `showConfirm` / `showToast`：自定义确认框和消息提示。

#### `static/js/jsplumb_renderer.js`（图形渲染器）
- `init(containerId, callbacks)`：初始化 jsPlumb 实例，绑定事件。
- `renderGraph(nodes, edges)`：渲染节点、端点、连线，并绑定交互事件。
- `getGraphData()`：获取当前图数据（节点坐标和连线信息）。
- `addNode(nodeData)`：动态添加节点。
- `deleteNode(nodeId)`：删除节点及相关连线。
- `highlightNode(nodeId)`：高亮指定节点。
- `getMaxNodeId()` / `getNextAvailablePageId()`：用于生成新页面 ID。

#### `static/js/story_api.js`
- 所有 `async` 方法，如 `getPage`、`updatePage`、`addOption`、`removeOption`、`updateOption`、`getStories`、`getTrash` 等，对应后端 API。

#### `static/js/creator_index.js`（工作台）
- `fetchStories(params)`：获取故事列表（支持状态筛选、搜索、分页）。
- `createStory()`：新建故事并跳转到编辑器。
- `deleteStory(id)`：软删除故事（移到回收站）。
- `editStory(story)`：弹出编辑故事模态框。
- `saveStoryEdit()`：保存故事名称和描述。
- `fetchTrash()`：加载回收站列表。
- `restoreStory(id)`：恢复已删除故事。
- `permanentDeleteStory(id)`：永久删除故事。
- `changePassword()`：修改管理员密码。
- `exportBackup()` / `importBackup(event)`：导出/导入数据。

#### `static/js/reader.js`
- `loadPage(localId)`：加载指定页面内容，渲染 Markdown，显示选项。
- `chooseOption(opt)`：选择分支，记录历史并跳转。
- `goBack()`：返回上一步。

#### `static/js/index.js`
- `fetchStories()`：获取已发布故事列表（分页、搜索）。

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
### 5. 启动服务
```bash
python app.py
```
### 访问：

读者首页：http://localhost:5000/

创作者工作台：http://localhost:5000/creator （需登录，默认密码：storygame）

### 📡 API 接口文档（简要）
故事管理
| 方法 | 路径 | 描述 |
| :--- | :--- | :--- |
|GET	|/api/stories	|故事列表（支持 status, q, page, per_page）|
|GET	|/api/story/<story_id>	|故事详情|
|POST	|/api/story	|创建新故事（默认草稿）|
|PUT	|/api/story/<story_id>	|更新故事名称和描述|
|DELETE	|/api/story/<story_id>	|软删除故事|
|POST	|/api/story/<story_id>/publish	|发布故事|
页面管理
| 方法 | 路径 | 描述 |
|GET	|/api/page/<story_id>/<page_id>?mode=edit	|获取页面详情（含选项）|
|PUT	|/api/page/<global_id>	|更新页面内容、类型、选项文本|
|POST	|/api/page/<story_id>	|新增页面|
|DELETE	|/api/page/<global_id>	|删除页面（清理引用）|
分支选项与连线
| 方法 | 路径 | 描述 |
|POST	|/api/story/<story_id>/option	|添加选项（分支/连线）|
|DELETE	|/api/story/<story_id>/option	|删除选项（双向匹配）|
|PUT	|/api/option/<option_id>	|更新锚点方向或标签|
图数据
| 方法 | 路径 | 描述 |
|GET	|/api/graph/<story_id>?mode=edit	|获取图数据（节点+边）|
|PUT	|/api/story/<story_id>/graph	|保存节点坐标和所有连线|
回收站
| 方法 | 路径 | 描述 |
|GET	|/api/trash	|获取已删除故事|
|POST	|/api/story/<story_id>/restore	|恢复故事|
|DELETE	|/api/story/<story_id>/permanent	|永久删除|
备份
| 方法 | 路径 | 描述 |
|GET	|/api/backup/export	|导出所有数据为 JSON|
|POST	|/api/backup/import	|导入 JSON 数据（覆盖）|

### 🔧 配置说明
修改数据库
默认使用 SQLite，如需切换到 MySQL/PostgreSQL，修改 app.py 中的 SQLALCHEMY_DATABASE_URI。

默认密码
登录密码存储在 admin_config 表中，默认 MD5 值为 storygame（可通过 AdminConfig.hash_password 更新）。

### 🤝 贡献指南
欢迎提交 Issue 或 Pull Request！

### 📄 许可证
MIT License

🎉 祝你创作愉快！



