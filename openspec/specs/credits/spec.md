# credits

## Purpose
描述平台积分余额、消费、套餐展示与开发者发放。

## Requirements

### Requirement: Spend credits on AI usage
对话生成、配图、配视频 SHALL 在执行前扣除对应积分并写入流水。余额不足时 SHALL 拒绝请求（HTTP 402）。新注册用户 SHALL 获得初始积分。

#### Scenario: 对话扣费
- GIVEN 用户积分不少于对话单价
- WHEN 发送一条会触发模型续写的消息
- THEN 余额减少对话单价，流水记录原因 `chat`

### Requirement: Recharge catalog without payment
`/credits` SHALL 展示当前余额与积分套餐。套餐购买 SHALL NOT 调用真实支付，SHALL 提示测试环境请由开发者发放。

#### Scenario: 点击套餐
- GIVEN 用户打开积分页
- WHEN 点击某个套餐的「充值」
- THEN 余额不变，并提示当前环境不支持在线支付

### Requirement: Developer grant
用户名 `nastume`（大小写不敏感）SHALL 访问 `/developer` 按用户名发放积分。其他账号访问该页或发放接口 SHALL 得到 403。

#### Scenario: 发放成功
- GIVEN 开发者已登录为 nastume
- WHEN 向用户 `alice` 发放 200 积分
- THEN alice 余额增加 200，流水记录原因 `grant` 与操作者
