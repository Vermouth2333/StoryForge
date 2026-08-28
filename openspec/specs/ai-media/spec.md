# ai-media

## Purpose
描述对话配图、配视频的平台供给、展示与任务持久化。

## Requirements

### Requirement: Image generation from assistant reply
用户 SHALL 能对已落库的助手消息请求配图。系统 SHALL 使用平台 SiliconFlow Kolors，将结果存为 `assets` 并写入 `chat_messages.image_asset_id`。缩略图 SHALL 为 100×100 黑底居中；hover 显示放大镜，点击后弹窗查看大图。

#### Scenario: 积分不足
- GIVEN 用户积分低于配图单价
- WHEN 请求生成图片
- THEN API 返回 402，提示积分不足并引导充值

### Requirement: Video generation continues after leave
用户 SHALL 能按当前助手回复生成短视频。系统 SHALL 在写入 `video_status=generating` 后立即返回，于后台轮询 SiliconFlow；用户刷新或离开页面 SHALL NOT 取消任务。再次进入会话时，若任务未完成 SHALL 仍显示「视频生成中」。

#### Scenario: 刷新后仍在生成
- GIVEN 用户已点击「生成视频」且任务未完成
- WHEN 用户刷新对话页
- THEN 该消息下仍显示生成中，完成后缩略图可点击弹窗播放

#### Scenario: 文生视频成功
- GIVEN 平台已配置硅基流动密钥且助手消息有正文、积分充足
- WHEN 视频任务完成
- THEN MP4 写入 `chat_messages.video_asset_id`，`video_status=ready`，气泡下 100×100 黑底缩略图可弹窗播放

### Requirement: Platform SiliconFlow credentials
图片与视频 SHALL 共用服务端 `SILICONFLOW_API_KEY`。密钥 SHALL NOT 出现在设置页或仓库源码。

#### Scenario: 未配置平台密钥
- GIVEN 环境变量无 `SILICONFLOW_API_KEY`
- WHEN 请求生成图片或视频
- THEN API 返回 503，提示媒体服务暂不可用
