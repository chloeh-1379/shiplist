# 🚢 ShipList

本地的 idea 孵化器：记录每一个想法，跟踪它直到 **ship**（发布到 GitHub）或 **release**（发布为 app）。

- ✅ 完全本地、离线可用 —— 零依赖 Node.js，无需 `npm install`
- ✅ Light 风格 UI，卡片 + 状态看板 + 搜索
- ✅ 一键导出 JSON / Markdown
- ✅ Agent 友好：REST API + 纯 JSON 数据文件 + `AGENTS.md` 约定，未来的 agent 可以快速读懂、追加内容

## 启动

```bash
node server.js            # 默认端口 4520
node server.js --port 8080
```

然后打开 <http://127.0.0.1:4520>

macOS 也可以双击 `start.command`。

## 数据（与代码分离）

Idea 数据**不存放在代码目录**，而是存放在你选定的 workspace 文件夹：

- 默认：`~/ShipList/ideas.json`
- 在 UI 右上角 ⚙️ 设置中可切换 workspace（切换时会自动复制现有数据）
- 也可用 `node server.js --data ~/my-ideas` 或环境变量 `SHIPLIST_DATA` 指定
- 生效路径见 `GET /api/health` 返回的 `dataDir`；持久配置在 `~/.config/shiplist/config.json`

数据是纯文本 JSON，可直接查看/编辑/进你自己的 git。代码仓库（本目录）通过 `.gitignore` 排除了所有用户数据。

## 导出

- UI 右上角按钮：导出 Markdown / JSON
- API：`GET /api/export.md`、`GET /api/export.json`

## 给 Agent 用

见 [AGENTS.md](./AGENTS.md)。摘要：

```bash
curl -s http://127.0.0.1:4520/api/ideas                 # 读全部
curl -s -X POST http://127.0.0.1:4520/api/ideas ...     # 新增
curl -s -X PATCH http://127.0.0.1:4520/api/ideas/<id>   # 更新状态
```

## Idea 生命周期

`idea` → `planned` → `building` → `shipped`（代码发布）/ `released`（对用户发布）/ `sold`（项目售出），或 `parked`（暂停）/ `stopped`（停止）。
