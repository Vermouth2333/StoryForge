# chat

## ADDED Requirements

### Requirement: Shared workspace
角色 / 世界 / 故事对话 SHALL 复用 `ChatWorkspace`，续写走平台 DeepSeek。

#### Scenario: 打开角色对话
- GIVEN 用户拥有角色卡且积分充足
- WHEN 进入对话页并发送消息
- THEN 可流式看到助手回复并扣除对话积分
