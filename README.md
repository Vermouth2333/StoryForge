# StoryForge MVP

根据 `StoryForge_技术文档.md` 搭建的 MVP 工程骨架，聚焦：

- 酒馆式对话与会话存档
- 创作与发布基础链路
- 点赞/关注/通知/基础推荐流
- 白色 + 浅蓝主视觉页面结构

## 技术栈

- Next.js App Router + TypeScript
- SQLite（WAL 模式）+ 文件系统存储
- Zod 参数校验

## 本地启动

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 目录说明

- `app/page.tsx`: 首页工作台原型（白+浅蓝风格）
- `app/api/**`: MVP API 路由（会话、故事、推荐、互动、通知）
- `lib/db.ts`: SQLite 初始化与建表
- `storage/`: 运行后自动生成（数据库与后续导出文件）

## 示例 API

- `POST /api/chat/sessions`
- `POST /api/chat/sessions/:id/generate`（SSE）
- `POST /api/stories`
- `POST /api/stories/:id/publish`
- `GET /api/feed?sort=recommended`
- `POST /api/likes/toggle`
- `POST /api/follows/toggle`
- `GET /api/notifications`

## 上传到 GitHub

仓库地址（根据你提供的信息）：

- `git@github.com:Vermouth2333/StoryForge.git`

首次推送命令：

```bash
git init
git add .
git commit -m "init StoryForge MVP scaffold"
git branch -M main
git remote add origin git@github.com:Vermouth2333/StoryForge.git
git push -u origin main
```

如果已存在 `origin`，先执行：

```bash
git remote set-url origin git@github.com:Vermouth2333/StoryForge.git
```
