# ai-media

## ADDED Requirements

### Requirement: Platform media jobs
助手消息 SHALL 支持生成配图与配视频；密钥来自服务端环境变量。视频任务状态落库，刷新后仍显示生成中。

#### Scenario: 生成配图
- GIVEN 平台已配置硅基流动 Key 且积分充足
- WHEN 用户点击「生成图片」
- THEN 图片写入 `chat_messages.image_asset_id`，以 100×100 黑底缩略图展示
