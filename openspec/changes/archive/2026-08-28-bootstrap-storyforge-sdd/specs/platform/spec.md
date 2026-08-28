# platform

## ADDED Requirements

### Requirement: Authenticated shell
登录用户 SHALL 通过 `AppShell` 访问市场、创作、我的、历史、积分、设置。未读通知入口 SHALL 跳转到 `/my#notifications`。

#### Scenario: 点击未读通知
- GIVEN 用户已登录
- WHEN 点击「未读通知」
- THEN 进入 `/my` 通知中心

### Requirement: Settings exclude model keys
设置页 SHALL NOT 提供用户侧模型或 API Key 配置。

#### Scenario: 打开设置
- GIVEN 已登录用户进入 `/settings`
- WHEN 浏览页面
- THEN 仅见资料、安全与积分入口
