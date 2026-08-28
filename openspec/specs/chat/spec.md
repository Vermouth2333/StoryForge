# chat

## Purpose
描述故事 / 角色 / 世界对话会话、流式生成与检查点。

## Requirements

### Requirement: Shared workspace
角色对话、世界探索、故事体验 SHALL 复用 `ChatWorkspace`，支持多会话、停止生成、重新生成最后一条助手消息。续写 SHALL 使用平台 DeepSeek 密钥，不读取用户设置中的 Key。

#### Scenario: 重新生成
- GIVEN 最新一条可见消息是助手回复且未在生成中
- WHEN 用户点击「重新生成」
- THEN 系统用同一用户上一轮指令替换该助手消息，不插入新用户消息，并扣除对话积分

### Requirement: Session history export
`/history` SHALL 支持将会话导出为 Markdown、TXT、PDF、EPUB；若会话含配图或视频，SHALL 分别打成 ZIP。

#### Scenario: 导出图片包
- GIVEN 会话中至少有一条带 `image_asset_id` 的助手消息
- WHEN 用户选择「图片 ZIP」
- THEN 下载包含这些图片文件的 zip

#### Scenario: 无视频时导出
- GIVEN 会话没有任何视频资源
- WHEN 用户选择「视频 ZIP」
- THEN 返回错误提示「该会话暂无视频」
