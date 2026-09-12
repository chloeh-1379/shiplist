# 🚢 ShipList

[English](./README.md) | 简体中文

一个**本地优先、完全离线**的 idea 追踪器，为创造者而生。记录每一个想法，跟踪它走完整个生命周期，直到 **ship**——发布为 GitHub 仓库、App、Web 服务、CLI，或者卖出去。

- **零依赖**——纯 Node.js（18+），无需 `npm install`，完全离线可用
- **轻量美观的 UI**——卡片看板、状态筛选、全文搜索、整窗详情视图，内置 Markdown 渲染（默认阅读模式，需要时才进入编辑）
- **数据在你选的文件夹里**——idea 存放在你指定的 workspace 目录，与代码仓库完全分离
- **为 Agent 而设计**——纯 JSON 存储 + REST API + `AGENTS.md` 约定，AI coding agent 可以自主地读取、新增、更新 idea
- **一键导出**——Markdown 摘要或完整 JSON，方便分享或直接喂给 agent

## 快速开始

```bash
git clone https://github.com/chloeh-1379/shiplist.git
cd shiplist
node server.js          # → http://127.0.0.1:4520
```

就这样——没有安装步骤。macOS 上也可以直接双击 `start.command`。

可选参数：

```bash
node server.js --port 8080              # 自定义端口
node server.js --data ~/my-ideas        # 自定义数据目录
SHIPLIST_DATA=~/my-ideas node server.js # 同上，用环境变量
```

## 数据存放在哪

Idea **绝不存放在本代码仓库内**。数据目录（"workspace"）按以下顺序解析：

1. `--data <dir>` 命令行参数
2. `SHIPLIST_DATA` 环境变量
3. 已保存的配置 `~/.config/shiplist/config.json`（可在 UI 右上角 ⚙️ Settings 里修改）
4. 默认：`~/ShipList/ideas.json`

数据就是一个可读性很好的 `ideas.json` 文件——可以备份、用 git 管理、同步、甚至手动编辑。在 UI 里切换 workspace 时，如果新目录为空，会自动把现有 idea 复制过去。

## Idea 生命周期

```
idea → planned → building → shipped / released / sold
                     ↘ parked（暂停）   ↘ stopped（停止）
```

每个 idea 包含：标题、简介、Markdown 详细描述、状态、ship 目标
（github / app / web / cli / library / other）、标签、优先级、链接，以及带署名的进展日志。

## 配合 AI agent 使用

ShipList 的设计目标就是让 agent **能读也能写**：

- **API**（默认端口 `4520`）：`GET/POST /api/ideas`、`PATCH /api/ideas/:id`、
  `POST /api/ideas/:id/log`、`GET /api/export.md`——带上 `X-Agent` 请求头，
  写入会在日志里署名。
- **数据文件**：服务器没启动时，agent 可以直接编辑 workspace 里的 `ideas.json`。
- **约定**：见 [AGENTS.md](./AGENTS.md)——数据结构、规则和示例。
- **Agent Skill**：现成的 `shiplist` skill（适用于 Codex/Cursor 类 agent），
  教 agent 在聊天中主动捕获 idea：
  [skills/shiplist/SKILL.md](./skills/shiplist/SKILL.md)。拷到 agent 的 skills
  目录即可（如 `~/.agents/skills/` 或 `~/.cursor/skills/`）。

```bash
# 示例：agent 新增一个 idea
curl -s -X POST http://127.0.0.1:4520/api/ideas \
  -H 'Content-Type: application/json' -H 'X-Agent: my-agent' \
  -d '{"title":"番茄钟 CLI","summary":"极简专注计时器","shipTarget":"cli"}'
```

## 导出

- UI：头部按钮 `⬇︎ Markdown` / `⬇︎ JSON`
- CLI：`curl http://127.0.0.1:4520/api/export.md > ideas.md`

## 快捷键

| 按键 | 作用 |
| --- | --- |
| `/` | 聚焦搜索框 |
| `Esc` | 关闭弹窗 / 退出编辑模式 |
| `⌘/Ctrl + Enter` | 编辑中保存 |

## 项目结构

```
shiplist/
├── server.js            # 零依赖 Node 服务器：REST API + 静态服务
├── public/index.html    # 单文件 UI（无构建步骤、无 CDN）
├── start.command        # macOS 双击启动器
├── AGENTS.md            # 给 AI agent 的约定
├── skills/shiplist/     # 用于聊天中捕获 idea 的 Agent Skill
└── （你的数据在别处——见「数据存放在哪」）
```

## License

MIT
