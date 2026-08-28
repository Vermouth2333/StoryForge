# 设计：StoryForge 平台基线

## Context
运行时为 Next.js App Router + SQLite。对话、媒体与积分都落在现有 `lib/` 与 `app/api/` 分层上。

## Goals
- 平台统一调用 DeepSeek 与 SiliconFlow，用户不配置密钥
- 视频任务状态写入 `chat_messages`，请求返回后继续执行，刷新仍显示「生成中」
- 对话 / 配图 / 配视频按次扣积分；测试环境由用户名 `nastume` 发放积分

## Non-Goals
- 不接入真实支付通道
- 不引入独立消息队列中间件（视频任务在本进程 `after()` 中继续，状态以数据库为准）

## Decisions
- 对话 UI 集中在 `ChatWorkspace`；配图/配视频缩略图 100×100 黑底居中，点击弹窗查看
- 图片：Kolors 同步 `images/generations`
- 视频：Wan T2V，`video/submit` + `video/status`；`video_status` 为 generating / ready / failed
- 密钥：`DEEPSEEK_API_KEY`、`SILICONFLOW_API_KEY` 仅 `.env`
- 开发者：用户名等于 `nastume`（大小写不敏感）即可打开发放页

## Risks
- 进程重启会使内存中的轮询中断；以 `video_request_id` 恢复或超时失败并退积分
- 硅基流动模型名可能调整，通过环境变量覆盖，不开放给普通用户
