# 提案：StoryForge 平台基线（壳层、对话、媒体与积分）

## Why
产品需要把已确定的平台行为写成可验收规格：登录用户在壳层内完成发现、对话与创作；模型能力由平台统一供给；媒体生成可中断刷新而不丢任务；消费走积分而不是用户自备密钥。

## What Changes
- 建立 `platform`、`chat`、`ai-media`、`credits` 四条 capability spec
- 约定未读通知、创作者看板、对话配图/配视频、会话媒体 ZIP、积分扣费与开发者发放的验收场景
- 模型密钥仅存在服务端环境变量；设置页不再暴露 API 配置

## Capabilities
### New Capabilities
- `platform`：壳层、通知、我的看板
- `chat`：会话工作台、检查点、导出
- `ai-media`：平台配图 / 配视频与任务持久化
- `credits`：积分余额、套餐展示、开发者发放

### Modified Capabilities
- 无（首次建库）

## Impact
- 后续功能必须 `/opsx-propose` 出 delta，禁止无记录地改主 spec
