# OpenSpec 工作流（StoryForge）

本仓库用 OpenSpec 做规格驱动开发。实现前先写变更，落地后再归档。

## 循环
1. `/opsx-propose`：写 `proposal.md`、delta specs、`design.md`、`tasks.md`
2. `/opsx-apply`：按 `tasks.md` 改代码
3. `/opsx-archive`：delta 合并进 `openspec/specs/`，变更移到 `openspec/changes/archive/`

## 目录
- `openspec/specs/`：当前系统行为（source of truth）
- `openspec/changes/`：进行中的变更
- `openspec/changes/archive/`：已归档、已落地的变更

基线变更 `changes/archive/2026-08-28-bootstrap-storyforge-sdd/` 记录了平台壳层、对话工作台与媒体能力的首版规格。新功能继续走 propose，不要直接改主 spec（除非 hotfix）。
