# platform

## Purpose
描述 StoryForge 的账号、导航与「我的」工作台。

## Requirements

### Requirement: Authenticated shell
登录用户 SHALL 通过 `AppShell` 访问市场、创作、我的、历史、积分、设置。未读通知入口 SHALL 跳转到 `/my#notifications`，文案 SHALL 为白色以衬托蓝色底。用户名 `nastume` 额外可见「发放积分」。

#### Scenario: 点击未读通知
- GIVEN 用户已登录且侧边栏展示未读数
- WHEN 点击「未读通知」
- THEN 进入 `/my` 通知中心

### Requirement: Creator dashboard
`/my` SHALL 展示按日 / 月 / 年统计的下载、阅读、点赞、关注、收藏人数。

#### Scenario: 切换周期
- GIVEN 作者打开「我的」
- WHEN 选择「月」
- THEN 看板刷新为本月及近 6 个月序列

### Requirement: Notifications copy
点赞、收藏、关注通知 SHALL 使用「用户{昵称}点赞/收藏/关注了你」，且 SHALL NOT 展示「查看」按钮。

#### Scenario: 关注通知
- GIVEN 用户 A 关注了作者 B
- WHEN B 打开通知中心
- THEN 看到「用户A关注了你」

### Requirement: Settings exclude model keys
设置页 SHALL 仅管理个人资料与账号安全，SHALL NOT 提供 DeepSeek 或硅基流动的 API Key / 模型 ID 表单。

#### Scenario: 打开设置
- GIVEN 已登录用户进入 `/settings`
- WHEN 浏览页面
- THEN 看不到模型或密钥配置项，能看到积分入口
