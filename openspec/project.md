# StoryForge

## 这是什么
StoryForge 是面向中文创作者的 AI 角色扮演平台。用户在市场获取故事、角色与世界卡，戴上人设面具进入对话；平台统一提供 DeepSeek 续写、硅基流动配图与配视频，用户以积分消费能力，无需自行配置模型密钥。

## 技术栈
- Next.js 16 App Router、React 19、TypeScript strict
- SQLite（WAL）+ `storage/` 文件；JWT Cookie 鉴权
- 对话：平台 DeepSeek `/chat/completions` SSE
- 图片：SiliconFlow Kolors；视频：SiliconFlow Wan T2V（异步 submit/status，任务状态落库）
- 计费：用户积分余额 + 流水；充值页仅展示套餐，发放由开发者账号完成
- 导出：Markdown / TXT / PDF / EPUB，以及会话图片 / 视频 ZIP

## 约定
- API 响应 `{ code, data?, msg }`；入参 zod；`getCurrentUserId()` / `getDb()` / `id()` / `nowIso()`
- 表结构变更走 `lib/db.ts` 幂等迁移
- 模型密钥只放服务端 `.env`，禁止写入源码、git 与用户设置页
- 开发者账号用户名固定为 `nastume`，用于发放积分
- UI 主色 `#5B9DFF`，白 + 浅蓝

## 领域
市场发现与下载、我的作品与通知看板、对话与检查点、积分与充值、会话导出、开发者发放积分。

## 源码入口
- 页面：`app/(main)/`
- API：`app/api/`
- 领域：`lib/`
- 约束：`docs/AGENTS.md`、`docs/StoryForge_技术文档.md`
