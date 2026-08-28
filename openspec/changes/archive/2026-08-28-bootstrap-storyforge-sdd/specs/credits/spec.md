# credits

## ADDED Requirements

### Requirement: Developer grant
用户名 `nastume` SHALL 能给任意用户发放积分；充值页不走真实支付。

#### Scenario: 发放积分
- GIVEN 开发者 nastume 已登录
- WHEN 按用户名发放积分
- THEN 目标用户余额增加并记入流水
