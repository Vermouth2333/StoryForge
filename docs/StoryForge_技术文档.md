# StoryForge — 交互式小说创作平台 技术文档

## 一、项目概述

StoryForge AI — 基于 SillyTavern 的 AI 交互式小说创作平台。

将 SillyTavern 强大的多模型角色扮演引擎改造为面向大众的 AI 小说创作工具，让每个人都能通过"与 AI 对话"的方式创作出结构完整、风格多样的长篇/短篇小说，并一键导出为可发布的电子书格式。

---

## 二、用户系统

### 2.1 Google 登录

平台使用 Google OAuth 2.0 作为唯一登录方式，通过 Google 账号标识用户身份。

- **登录流程**：用户点击"使用 Google 登录"按钮，跳转 Google 授权页面，授权后回调获取用户信息
- **用户标识**：以 Google 账号的唯一 ID 作为平台用户主键，关联所有用户数据（创作、收藏、存档等）
- **会话管理**：登录成功后签发 JWT Token，前端存储于 HttpOnly Cookie，后续请求携带 Token 鉴权
- **首次登录**：自动创建用户档案，引导用户完善个人设置

#### 2.1.1 登录异常处理（MVP）

- **授权失败**：前端提示"Google 授权失败，请重试"，保留当前页面状态并提供一键重试按钮
- **Token 过期**：服务端优先使用 Refresh Token 自动续期；续期失败则清理会话并跳转登录页
- **多端登录冲突**：MVP 采用"最后登录端生效"，新端登录后旧端 Access Token 失效
- **风控限制**：同 IP 高频失败登录触发短时限流（如 10 分钟内最多 10 次）

### 2.2 用户设置（侧边栏 — 设置）

用户可在"设置"页面管理和修改个人信息。

- **用户名**：自定义昵称，平台内展示名称
- **性别**：可选填
- **年龄**：可选填
- **联系方式**：手机号或其他联系方式，可选填
- **头像**：支持上传自定义头像，默认使用 Google 账号头像
- **作者简介**：个人简介文本，展示在作者主页

#### 2.2.1 用户资料技术约束（MVP）

- **头像上传**
  - 文件格式：仅支持 `JPG/JPEG/PNG`
  - 文件大小：单文件 `<= 5MB`
  - 存储路径：`/storage/users/{user_id}/avatar/original/`
  - 缩略图：自动生成 `200x200` 预览图，路径 `/storage/users/{user_id}/avatar/thumb_200x200/`
- **联系方式（手机号）**
  - 展示值：仅展示脱敏值，如 `138****1234`
  - 存储策略：MVP 仅存储脱敏值 `phone_masked`，预留 `phone_verified_at` 字段用于后续短信验证
  - 格式校验：仅允许中国大陆手机号格式 `^1[3-9]\d{9}$`
- **输入安全**
  - 简介字段最大长度建议 `500` 字
  - 所有文本字段服务端统一做 XSS 过滤

### 2.3 用户注销与数据处理（合规）

- **注销确认**：需二次确认（输入"确认注销"）后执行
- **账户状态**：`users.status` 更新为 `deleted`，会话立即失效
- **故事作品处理**：用户可选择
  1) 匿名保留发布（作者名显示"已注销用户"）  
  2) 下架并删除作品
- **互动数据处理**：点赞、关注、通知等与该账号相关的个人互动数据清空
- **日志保留**：安全审计日志按合规要求保留最短周期（如 180 天）

---

## 三、页面布局与导航

平台采用左侧固定侧边栏 + 右侧内容区的布局结构。

### 侧边栏结构

```
┌──────────────┐
│  StoryForge  │  ← Logo
├──────────────┤
│  📖 市场     │  ← 首页/默认页
│  ✏️ 创作     │
│  ⚙️ 设置     │
├──────────────┤
│              │
│  用户头像     │
│  用户名       │
│  退出登录     │
└──────────────┘
```

### 3.1 UI 视觉规范（白色 + 浅蓝主色）

为保证产品一致性，MVP 阶段统一采用浅色系设计，整体风格为"白底、浅蓝强调、低饱和中性色"。

- **主色（Primary）**：`#5B9DFF`（按钮、链接、关键操作）
- **主色悬浮（Primary Hover）**：`#7FB4FF`
- **主色按下（Primary Active）**：`#3F86F5`
- **浅蓝背景（Info Background）**：`#EEF6FF`（卡片高亮、提示条、选中态）
- **页面背景（Background）**：`#F8FBFF`
- **面板背景（Surface）**：`#FFFFFF`
- **边框色（Border）**：`#DCE9FF`
- **主文字（Text Primary）**：`#1F2A44`
- **次文字（Text Secondary）**：`#5B6B8C`

**组件规范：**
- 侧边栏选中项使用浅蓝底 `#EEF6FF` + 左侧 3px 主色条
- 主按钮统一主色实底，次按钮白底描边 `#DCE9FF`
- 卡片阴影保持轻量：`0 6px 18px rgba(66, 133, 244, 0.10)`
- 输入框聚焦边框使用 `#5B9DFF`，并增加浅蓝外发光

**可访问性要求：**
- 正文文字与背景对比度不低于 WCAG AA（4.5:1）
- 仅颜色不可作为唯一状态区分，需配合图标/文案（如"已点赞"）

### 3.2 响应式适配策略（MVP）

- **优先端**：MVP 优先支持 PC 端（`>=1024px`）
- **平板端**：`768px~1023px` 保留核心功能，侧边栏折叠为图标栏
- **移动端**：`<768px` 仅做基础可用适配，侧边栏折叠为顶部导航抽屉
- **网格策略**：
  - 市场卡片：PC 4 列 / 平板 2 列 / 移动端 1 列
  - 创作工作台：移动端默认切换为"编辑区全屏 + 面板抽屉"

### 3.3 核心页面原型逻辑（MVP）

1. **创作工作台**
   - 左侧：章节大纲树（新增/拖拽/折叠）
   - 中间：正文编辑区（AI 流式生成 + 手动改写）
   - 右侧：角色卡 / 世界卡快捷面板（引用与设定预览）

2. **故事体验页**
   - 顶部：剧情节点导航（存档点）
   - 中间：对话交互区（用户输入与 AI 回复）
   - 底部：指令输入框（支持快捷指令模板）

3. **市场列表页**
   - 顶部：筛选栏（标签/排序/关键词）
   - 主体：卡片网格（响应式列数）
   - 卡片交互：点赞、收藏、关注作者、进入体验

---

## 四、核心功能设计

### 4.1 市场（侧边栏 — 首页）

市场是平台的首页和默认页面，展示其他用户发布的作品。页面顶部设有三个分类 Tab 切换：

#### 4.1.1 故事

展示已发布的完整故事作品，用户可直接体验。

- **卡片展示**：封面图、标题、作者、简介摘要、标签、评分
- **直接体验**：点击故事卡片进入冒险体验模式，使用作者发布的世界卡和角色卡，以对话式交互驱动 AI 生成专属剧情
- **角色选择**：进入体验前，从作者提供的角色卡中选择一个角色扮演，或创建自定义角色加入该世界
- **剧情分支探索**：在关键节点自由选择，探索不同于原作的故事走向
- **冒险存档**：每次体验自动保存为独立存档，支持多存档并行、回溯到任意节点

#### 4.1.2 角色

展示其他用户发布的独立角色卡，用户可引入到自己的创作中。

- **角色卡片展示**：角色头像、名称、性格标签、简介
- **角色详情预览**：查看角色的基本属性、性格、背景故事、能力设定
- **引入到创作**：一键将他人发布的角色卡导入到自己的故事项目中，作为故事中的角色使用
- **独立对话**：可直接与该角色卡进行对话体验，无需创建故事项目

#### 4.1.3 世界

展示其他用户发布的独立世界卡，用户可引入到自己的创作中。

- **世界卡片展示**：世界名称、封面图、类型标签、简介
- **世界详情预览**：查看世界的背景设定、规则体系、历史大事件、知识库条目
- **引入到创作**：一键将他人发布的世界卡导入到自己的故事项目中，作为故事的世界观背景
- **独立对话**：可直接与该世界卡进行对话体验，探索世界观细节

#### 市场通用功能

- **搜索与筛选**：支持按关键词、标签、作者、评分等多维度筛选
- **排序方式**：热度、最新、推荐
- **点赞与关注**：支持点赞作品、关注作者并接收更新通知
- **收藏**：收藏感兴趣的作品，便于后续继续阅读/体验
- **默认推荐**：首页默认展示平台精选和热门作品

### 4.2 创作（侧边栏 — 创作）

创作页面是用户的创作工作台，分为三个子功能入口：

#### 4.2.1 创作角色卡

独立创建和管理角色卡，角色卡可独立存在、独立对话，也可被引入到故事项目中。

- **角色卡创建**：为角色创建独立的角色卡
- **基本属性**：姓名、性别、年龄、外貌描述、身份/职业
- **性格与动机**：性格特质、说话风格、口头禅、核心动机、内心冲突
- **背景故事**：角色的过往经历、关键记忆
- **能力与技能**：角色拥有的能力、特长、弱点
- **角色头像**：上传或 AI 生成角色形象图
- **独立对话**：角色卡创建后可直接与其对话，测试角色表现、调整设定
- **发布到市场**：将角色卡发布到市场的"角色"分类，供其他用户引入使用

#### 4.2.2 创作世界卡

独立创建和管理世界卡，世界卡可独立存在、独立对话，也可被引入到故事项目中。

- **世界卡创建**：定义一个完整的世界观设定
- **基础信息**：世界名称、时代背景、地理环境、科技/魔法体系等级
- **社会体系**：政治制度、势力阵营、经济体系、文化习俗、语言风格
- **规则与约束**：物理法则（如魔法规则）、禁忌设定、力量等级划分
- **历史大事件**：世界观中的关键历史节点
- **知识库条目**：以词条形式维护世界观细节（地名、组织、物品、术语等）
- **独立对话**：世界卡创建后可直接与其对话，探索和完善世界观细节
- **发布到市场**：将世界卡发布到市场的"世界"分类，供其他用户引入使用

#### 4.2.3 创作故事

创作完整的故事项目，可引入多张角色卡和一张世界卡。

- **创建故事项目**：设定书名、类型（玄幻/言情/科幻/悬疑等）、目标字数、风格基调
- **引入世界卡**：为故事绑定一张世界卡（可选自己创建的或从市场导入的），AI 写作时自动注入世界观约束
- **引入角色卡**：为故事添加多张角色卡（可选自己创建的或从市场导入的），AI 写作时自动参考角色设定
- **额外设定**：除世界卡和角色卡外，可添加其他自定义设定（如特殊剧情规则、叙事视角、特定场景约束等）
- **章节大纲编辑器**：可视化章节树，支持拖拽排序、折叠展开，每章可附注大纲要点
- **人物关系图谱**：可视化编辑故事中引入的各角色之间的关系（敌对/盟友/亲属/恋人等）
- **对话式创作**：以"导演"身份与 AI 协同，通过自然语言指令驱动剧情推进
- **智能续写与改写**：基于大纲、世界卡和角色卡设定，AI 自动生成段落级内容，用户可逐段审核/修改/重新生成
- **多分支叙事**：支持在关键剧情节点创建分支，探索不同走向后选择最优路径
- **风格锁定**：内置多种文风预设（严肃文学/网文爽文/古风/现代都市等），全篇保持一致
- **一致性管理**：AI 自动检查人物性格、时间线、场景是否与世界卡/角色卡矛盾
- **导出**：一键导出为 EPUB / PDF / TXT / Markdown 格式
- **发布到市场**：将完成的故事（连同世界卡、角色卡）发布到市场的"故事"分类

##### 创作模块技术细节补充（MVP）

1. **章节大纲编辑器（数据结构）**
   - 节点结构：`id + parent_id + title + type(chapter/branch/note) + sort_order + content`
   - 排序规则：同级节点按 `sort_order` 升序展示；拖拽后仅更新同级 `sort_order`
   - 折叠/展开：仅影响前端展示状态，不修改数据库结构

2. **人物关系图谱**
   - 关系类型：`敌对 / 盟友 / 亲属 / 恋人 / 上下级 / 合作`
   - 存储表：`character_relations(id, story_id, character_a_id, character_b_id, relation_type, description)`
   - 可视化选型：MVP 使用轻量 `d3.js`，支持节点拖拽与连线标签显示

3. **多分支叙事**
   - 分支创建：关键节点点击"创建分支"，生成新的 `story_branches` 记录并关联 `parent_id`
   - 分支合并：支持两种模式
     - **覆盖主线**：分支节点替换主线对应节点内容
     - **插入主线**：分支内容插入到主线指定节点后
   - 分支归档：未采用分支可标记 `archived`，默认不在主编辑视图显示
  - 历史保留：覆盖主线时原内容不物理删除，写入 `snapshots` 并标记 `replaced_by_branch_id`
  - 排序更新：插入主线时，目标节点之后同级 `sort_order` 批量 +N（事务内完成）
  - 续写衔接：分支合并后自动触发一次"过渡段建议生成"，由用户确认是否插入
  - 归档恢复：作者可在"分支管理"中查看并恢复 `archived` 分支；MVP 暂不开放管理员代操作入口

4. **导出规则**
   - 命名规则：`{故事标题}_{作者昵称}_{YYYYMMDD_HHMM}.{格式}`
   - 分支策略：导出弹窗支持 `仅主线 / 选中分支 / 所有分支（章节标注）`
   - EPUB：包含封面、目录（按章节大纲生成）
   - PDF：自动分页，页眉页脚显示故事标题与页码
  - EPUB 封面：优先使用用户上传封面；无封面时自动生成默认封面（标题+作者+浅蓝背景）
  - PDF 分页：优先按章节分页；单章超长时按段落自动分页
  - PDF 页眉页脚：页眉左对齐标题（12px），页脚居中页码（10px）
  - 多分支标注：采用章节前缀格式 `[分支: 分支标题]`
  - 导出失败判定：超时（>60s）/ 格式渲染异常 / 文件超过阈值（如 50MB）
  - 重试策略：自动重试 2 次（指数退避 1s/2s），仍失败则回退 Markdown 并提示用户
  - 用户提示文案：`导出失败，已为你生成 Markdown 备份，可稍后重试目标格式。`

### 4.3 设置（侧边栏 — 设置）

详见"二、用户系统 — 2.2 用户设置"。

---

## 五、技术方案

### 5.1 当前阶段范围（MVP）

结合你当前目标，第一阶段以"酒馆式对话 + 创作核心能力"为主，暂不建设数据治理与平台治理、计费、完整互动社区。

**本阶段保留：**
- Google 登录与基础用户设置
- 角色卡 / 世界卡创建与管理
- 角色卡 / 世界卡独立对话
- 故事项目创建、对话式续写、章节编辑、分支存档
- 故事发布到市场（仅基础展示，不做社区互动）
- 点赞 / 关注 / 通知 / 基础推荐流
- EPUB / PDF / TXT / Markdown 导出

**本阶段下掉（仅作为历史记录）：**
- 计费、会员、积分、配额系统
- 平台治理中台（复杂审计、举报工单体系、策略平台）

**本阶段新增实现（社区功能增强）：**
- 评论区功能 - 支持故事/角色/世界卡评论与互动
- 作者社交主页 - 展示作者作品、粉丝、二创关系
- 二创关系链 - 展示作品衍生关系和二创引用链

---

### 5.2 技术架构（MVP）

建议采用"四层最小闭环架构"：

```
┌──────────────────────────────────────────────────────────────┐
│                        体验接入层                            │
│  Web(Next.js) / 创作工作台 / 基础管理页                        │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                        业务服务层                            │
│ 用户中心 / 创作中心 / 市场发布 / 推荐分发 / 轻互动 / 通知 / 导出服务 │
└──────────────┬─────────────────────────────┬─────────────────┘
               │                             │
┌──────────────▼──────────────┐  ┌───────────▼─────────────────┐
│       AI 编排与对话引擎       │  │         内容资产层           │
│ Prompt模板 / RAG / 流式输出   │  │ 故事/章节/角色/世界/存档       │
│ 多模型适配 / 超时重试         │  │ 版本快照 / 导出打包            │
└──────────────┬──────────────┘  └───────────┬─────────────────┘
               │                             │
┌──────────────▼───────────────────────────────────────────────┐
│                          存储层                               │
│               SQLite（MVP）+ 文件系统（封面与导出产物）       │
└──────────────────────────────────────────────────────────────┘
```

---

### 5.3 核心子系统详细设计

#### 5.3.1 创作引擎（Story Composer）

- **输入层**：用户指令 + 当前章节上下文 + 世界卡约束 + 角色卡行为约束 + 文风约束
- **编排层**：
  - Prompt 模板分层：系统层（硬约束）/项目层（世界观）/章节层（当前目标）/用户层（即时指令）
  - 冲突检测：当用户要求与世界规则冲突时，触发解释式改写（保留创作自由并提示风险）
- **生成层**：
  - 流式输出（SSE/WebSocket）
  - 段落级再生成（只重写选中段，保留上下文一致性）
  - 文风保持器（Style Anchor，抽取历史语料特征）
- **后处理层**：
  - 一致性校验（角色设定、时间线、地点逻辑）
  - 违规内容过滤（涉政涉黄涉暴等策略）

**冲突检测与解释式改写（MVP 规则）**

1. **判定方式（两段式）**
   - 第一段：规则引擎快速判定（关键词/正则/枚举规则）
   - 第二段：AI 辅助判定（仅在规则引擎命中"疑似冲突"时触发）
2. **冲突分级**
   - `P0` 强冲突：直接违反世界硬规则（如无魔法世界要求角色施法）
   - `P1` 中冲突：与角色核心人设冲突（明显 OOC）
   - `P2` 弱冲突：语气/情绪偏移，可接受但需提示
3. **MVP 处理策略**
   - `P0/P1`：拦截并返回解释式改写建议
   - `P2`：放行并在响应中附提示
4. **解释式改写输出模板（固定）**
   - `冲突点`：{命中规则}
   - `原因说明`：{为何冲突}
   - `改写建议`：{1-2 条可执行指令}
   - `改写后指令`：{可直接发送给模型的替代指令}

**文风保持器（Style Anchor）落地规则（MVP）**

1. **特征维度**
   - 用词偏好（高频词、禁用词）
   - 句式特征（短句/长句比例、对话占比）
   - 情感强度（紧张/舒缓分布）
   - 叙事节奏（动作描写密度、信息揭示速度）
2. **抽取时机**
   - 初次：第 3 段生成完成后首次抽取
   - 增量：每新增 5 段或用户手动触发"更新文风锚点"
3. **注入方式**
   - 将风格摘要写入章节层 Prompt 的 `style_constraints`
   - 仅注入摘要向量（不回灌完整历史文本），控制 token 成本

**一致性校验边界与失败处理（MVP）**

1. **校验范围**
   - 仅覆盖显性设定：角色身份/关系、时间顺序、地点约束
   - 不强制校验隐性文学逻辑（如象征隐喻）
2. **校验方式**
   - 规则库校验为主（高确定性）
   - AI 校验为辅（仅处理规则无法判定的跨段冲突）
3. **失败处理**
   - 轻微冲突：提示用户并允许继续
   - 明显冲突：提供"自动修正草案"与"保持原文"二选一
   - 每次校验结果写入 `basic_logs` 便于回溯

**Prompt 模板分层示例：**

```plaintext
# 系统层（硬约束）
你是 StoryForge 的小说创作助手，需遵守以下规则：
1) 输出内容符合中国法律法规，禁止涉政/涉黄/涉暴违规内容；
2) 角色发言需符合其人设，禁止明显 OOC；
3) 世界观需遵循用户设定，禁止自相矛盾。

# 项目层（世界观）
世界名称：赛博朋克 2077
核心规则：
- 科技水平：人体改造普及，网络空间可意识接入；
- 社会规则：企业掌控城市，底层人员无社会保障；
- 地理环境：夜之城，常年阴雨，霓虹密集。

# 章节层（当前目标）
本章目标：主角 V 与强尼银手初次相遇，触发芯片冲突；风格紧张、悬疑。

# 用户层（即时指令）
让强尼银手台词更暴躁，允许粗口但需符合角色设定。
```

#### 5.3.2 酒馆对话会话系统（Chat Session）

- **会话模型**：一个故事项目可有多个会话（创作会话/角色独聊/世界独聊）
- **消息结构**：用户消息、系统提示、模型回复、工具消息（如重写指令）统一落库
- **上下文组装**：按 token 预算动态拼接最近消息 + 关键设定摘要
- **存档机制**：关键节点自动快照，可回滚到任意节点继续创作
- **中断编辑**：流式输出中允许"停止生成 -> 手动改写 -> 从改写点续写"

#### 5.3.3 发布与推荐系统（轻量版）

- 故事发布只包含：标题、封面、简介、标签、正文/分支选择
- 列表排序支持：最新、更新时间、基础推荐
- 基础推荐策略：标签匹配 + 关注作者优先 + 热度信号（点赞/收藏）加权
- 展示页保留"开始体验"与"导入卡片"，支持点赞、关注与通知触发

#### 5.3.4 轻互动与通知系统（非社区化）

- 支持 `点赞`、`关注`、`收藏` 三个最小互动动作
- 通知类型：被点赞、关注作者更新、作品发布成功/下架提醒
- 不做评论楼层、私信聊天、活动广场和二创社交关系链
- 互动数据只用于推荐排序与基础运营，不扩展为社区关系网络

#### 5.3.5 基础安全与内容过滤

- **上线前过滤**：发布时进行基础敏感词和高风险内容检测
- **对话时过滤**：输入输出双向策略拦截（轻量规则 + 模型安全提示）
- **异常保护**：超长输入、频繁请求、异常 token 消耗限流
- **人工处理**：MVP 先采用手动处理入口，不做完整举报工单系统

---

### 5.4 数据模型设计（核心表）

> MVP 阶段使用 SQLite + 文件系统，后续用户量上来再迁移 PostgreSQL。

1. **用户域**
   - `users`：基础档案、OAuth 信息、状态
   - `user_profiles`：扩展信息（简介、头像、联系方式）

2. **创作域**
   - `stories`：故事元数据（标题、状态、标签、可见性）
   - `story_chapters`：章节正文、版本号、字数、发布时间
   - `story_branches`：分支树结构（父节点、分支说明）
   - `characters` / `worlds`：角色卡、世界卡主体
   - `knowledge_entries`：世界知识库词条
   - `assets`：封面图、插图、附件

3. **会话与存档域**
   - `chat_sessions`：会话主表（类型、关联故事/角色/世界）
   - `chat_messages`：消息明细（角色、内容、token、耗时）
   - `snapshots`：节点快照（用于回滚和分支续写）

4. **最小运营域**
   - `publish_records`：发布记录（版本、发布时间、状态）
   - `basic_logs`：基础运行日志（错误、接口耗时）
   - `likes`：点赞记录
   - `follows`：关注关系（用户-作者）
   - `notifications`：通知中心
   - `feed_impressions`：推荐曝光日志
   - `feed_clicks`：推荐点击日志

#### 5.4.1 关键表字段建议（MVP）

1. `chat_sessions`
   - `id`、`user_id`、`session_type`（story/character/world）
   - `story_id`、`character_id`、`world_id`（按类型可空）
   - `title`、`summary`、`last_message_at`、`created_at`、`updated_at`

2. `chat_messages`
   - `id`、`session_id`、`role`（system/user/assistant）
   - `content`、`token_input`、`token_output`、`latency_ms`
   - `model_name`、`created_at`

3. `stories`
   - `id`、`author_id`、`title`、`summary`、`cover_asset_id`
   - `status`（draft/published/archived）、`tags_json`（JSON 数组，如 `["赛博朋克","悬疑","长篇"]`）
   - `like_count`、`favorite_count`、`publish_at`、`updated_at`

4. `likes`
   - `id`、`user_id`、`target_type`（story/character/world）、`target_id`、`created_at`
   - 唯一约束：`(user_id, target_type, target_id)`

5. `follows`
   - `id`、`user_id`、`author_id`、`created_at`
   - 唯一约束：`(user_id, author_id)`

6. `notifications`
   - `id`、`receiver_user_id`、`type`（liked/followed/author_update/system）
   - `payload_json`、`is_read`、`created_at`
   - 索引：`(receiver_user_id, is_read, created_at DESC)`

---

### 5.5 关键业务流程（端到端）

#### 5.5.1 创作发布流程

1. 用户创建故事并绑定角色卡/世界卡  
2. AI 辅助生成章节（流式）  
3. 本地草稿自动保存 + 版本快照  
4. 用户提交发布，触发基础安全过滤  
5. 通过后写入市场列表（最新/更新时间/推荐流）  

#### 5.5.2 体验冒险流程

1. 用户在市场选择故事并选定角色  
2. 系统加载该故事世界规则与角色约束  
3. 用户输入行动指令，AI 生成个性化分支剧情  
4. 关键节点形成可回溯存档  
5. 用户可将分支内容合并回主线章节  

#### 5.5.3 轻互动触发流程

1. 用户浏览推荐流并进入作品详情  
2. 用户执行点赞或关注动作  
3. 系统写入互动记录并更新作品热度分  
4. 异步生成通知并推送到通知中心  
5. 推荐排序在下一轮刷新时吸收新互动信号  

#### 5.5.4 通知投递流程

1. 业务事件入队（点赞、关注、作者发布更新）
2. 通知服务根据事件类型构建通知文案与 payload
3. 写入 `notifications` 表并更新未读计数
4. 前端通过轮询或 SSE 拉取增量通知
5. 用户点击后标记已读并跳转目标页

#### 5.5.5 内容人工处理入口（MVP）

1. 提供基础管理页 `/admin/moderation`（仅管理员可见）
2. 列表字段：`内容类型`、`触发原因`、`提交用户`、`创建时间`、`状态`
3. 处理动作：`通过`、`下架`、`驳回并备注`
4. 所有处理动作写入 `basic_logs` 与 `audit_remark`
5. MVP 暂不做复杂工单流转，仅单级管理员处理

---

### 5.6 非功能性设计（性能、稳定性、安全）

#### 5.6.1 性能目标（建议指标）

- 首屏渲染：P95 < 2.5s
- 创作流式首 token 延迟：P95 < 2s
- 市场列表接口：P95 < 300ms（命中缓存）
- 推荐流接口：P95 < 350ms（含轻量排序）
- 发布基础过滤平均耗时：< 5s

#### 5.6.2 稳定性目标

- 核心 API 可用性：99.9%
- 关键链路（登录、对话、发布、导出）监控
- 故障降级：模型超时时自动重试 1 次并提示用户切换模型

#### 5.6.3 安全与合规

- OAuth + HttpOnly Cookie + CSRF 防护
- 数据分级与最小权限访问控制（RBAC）
- PII 加密（联系方式、敏感资料）
- 内容合规：基础敏感内容过滤 + 人工兜底处理

#### 5.6.4 备份与恢复策略（MVP）

- **SQLite 备份**
  - 每日凌晨自动备份：`db_backup_YYYYMMDD.sqlite`
  - 备份目录：`/storage/backups/db/`
  - 保留策略：保留最近 7 天
  - 运行模式：启用 WAL（`PRAGMA journal_mode=WAL;`）
  - 数据库体积阈值：超过 `2GB` 触发迁移预警（进入 PostgreSQL 迁移流程）
- **文件系统备份**
  - 目录结构：`/storage/users/{user_id}/{asset_type}/`
  - 文件命名：`{asset_type}_{resource_id}_{timestamp}_{rand6}.{ext}`（避免重名与非法字符）
  - 每周清理无主文件（已删除故事/头像的残留资源）
  - 清理判定：仅当 `resource_id` 在业务表不存在或状态为 `deleted` 才删除
  - 清理日志：写入 `basic_logs`（删除数量、路径、任务 ID、执行时间）
- **恢复流程**
  - 数据库：停写 -> 选定备份 -> 覆盖恢复 -> 回放当日增量日志（如有）
  - 文件：按目录回滚最近快照

---

### 5.7 技术选型升级建议

| 层级 | 当前方案 | 升级建议 | 原因 |
|------|---------|---------|------|
| 前端 | React + Ant Design + Next.js | 维持 | 快速交付酒馆式对话 UI |
| 后端 | Next.js API Routes + Node.js | 维持 | 与 SillyTavern 能力快速整合 |
| AI 接入 | OpenAI / Claude / Ollama | 维持（先 1-2 个模型） | 控制复杂度与调试成本 |
| 存储 | SQLite + 文件系统 | 维持 | 单人项目初期最轻量 |
| 缓存 | 无 | 可选 Redis（第二阶段） | 推荐流与通知读性能优化 |
| 流式通信 | SSE | 维持 | 实现成本低，满足打字机效果 |
| 导出 | epub-gen / pdfkit | 维持 | 满足小说交付需求 |

---

### 5.8 API 设计（MVP 建议）

#### 5.8.1 对话与创作
- `POST /api/chat/sessions`：创建会话（story/character/world）
- `GET /api/chat/sessions/:id/messages`：获取历史消息（分页）
- `POST /api/chat/sessions/:id/generate`：流式生成回复（SSE）
- `POST /api/stories`：创建故事
- `PATCH /api/stories/:id`：更新故事元数据
- `POST /api/stories/:id/publish`：发布故事（含基础内容过滤）

**接口示例：创建会话**

```plaintext
# POST /api/chat/sessions
请求体：
{
  "user_id": "google_123456",
  "session_type": "story",
  "story_id": "story_789",
  "character_id": null,
  "world_id": "world_456",
  "title": "赛博朋克2077-初次相遇"
}

响应体：
{
  "code": 200,
  "data": {
    "session_id": "session_101",
    "title": "赛博朋克2077-初次相遇",
    "created_at": "2024-05-01 10:00:00"
  },
  "msg": "创建成功"
}
```

**SSE 协议（`POST /api/chat/sessions/:id/generate`）**

```plaintext
事件格式：
data: {"type":"content","content":"...","seq":1}
data: {"type":"heartbeat","ts":1714548000}
data: {"type":"done","message_id":"msg_123"}
```

- 服务端空闲心跳：每 15s 发送一次 `heartbeat`
- 连接超时：60s 无有效生成则断开并返回 `timeout`
- 客户端中断：用户点击"停止生成"调用 `POST /api/chat/sessions/:id/stop`，服务端终止模型请求并将消息标记 `incomplete`

**鉴权与权限边界（MVP）**

- Token 携带：默认 HttpOnly Cookie；内部调试接口可选 `Authorization: Bearer`
- 资源权限：作者仅可操作本人故事/角色/世界；管理员可操作全部内容
- 防重放：发布/注销等敏感接口要求 `x-timestamp + x-nonce`，服务端校验 5 分钟时窗内 nonce 不可重复

#### 5.8.2 轻互动与推荐
- `POST /api/likes/toggle`：点赞/取消点赞
- `POST /api/follows/toggle`：关注/取消关注
- `GET /api/feed`：获取推荐流（支持 `latest|updated|recommended`）
- `POST /api/feed/impression`：上报曝光
- `POST /api/feed/click`：上报点击

#### 5.8.3 通知中心
- `GET /api/notifications`：通知列表（分页）
- `POST /api/notifications/read`：标记单条/批量已读
- `GET /api/notifications/unread-count`：未读数

#### 5.8.4 推荐打分（轻量公式）

`score = 0.45 * like_score + 0.25 * follow_score + 0.20 * tag_match + 0.10 * freshness`

- `like_score`：点赞数经时间衰减后的归一化分
- `follow_score`：作者被关注热度（可平滑）
- `tag_match`：用户偏好标签命中率（无用户画像时降级为全局热标签）
- `freshness`：发布时间衰减分（避免旧内容长期霸榜）

#### 5.8.5 多模型适配与重试策略

1. **统一抽象接口**
   - `generate(prompt, modelConfig, streamConfig)`
   - 统一返回结构：`{content, usage, finish_reason, latency_ms, model}`
2. **参数映射**
   - 统一参数：`temperature, max_tokens, top_p, presence_penalty`
   - 各模型适配层完成字段映射与默认值兜底
3. **降级策略**
   - 主模型不可用 -> 自动切换备模型（同能力档位）
   - 备模型仍失败 -> 返回可读错误并建议用户稍后重试或手动切换
4. **超时重试边界（MVP）**
   - 重试次数：1 次
   - 重试间隔：指数退避（首轮 800ms）
   - 最终提示：`当前模型繁忙，请稍后重试或切换模型。`

### 5.9 里程碑规划（建议）

#### 阶段 A（MVP，4-6 周）
- Google 登录、故事/角色/世界创作、独立对话、故事对话续写、发布、导出
- 单模型接入 + 基础安全过滤 + 会话存档 + 点赞/关注/通知 + 基础推荐流

#### 阶段 B（增长，6-8 周）
- 多模型切换、RAG 优化、长文本一致性增强
- PostgreSQL 迁移预案与 Redis 缓存接入（推荐流/通知）

#### 阶段 C（生态，8-12 周）
- 再按实际增长决定是否引入完整社区能力（评论/活动/二创关系链）
- 再按商业化需求决定是否引入计费与会员

---

### 5.10 风险清单与应对

1. **模型输出不稳定**：固定 Prompt 模板 + 关键角色设定锁定 + 段落级重写  
2. **上下文过长导致质量下降**：摘要压缩 + 关键设定置顶 + token 预算裁剪  
3. **SQLite 并发瓶颈**：写操作经单队列串行执行（`p-queue` 并发=1，最大等待 1000，单任务超时 8s）+ 文件锁（`flock`）+ 高频读接口进程内缓存（key: `{type}:{id}:{queryHash}`，TTL=5 分钟，写后主动失效）+ 预留 PostgreSQL 迁移脚本  
4. **内容风险**：输入输出双向敏感过滤 + 人工兜底  
5. **导出失败或格式错乱**：章节结构校验 + 导出任务重试 + 失败回退到 Markdown  

---

## 六、功能实现详细方案

### 6.1 创作引擎高级特性

#### 6.1.1 文风保持器（Style Anchor）

**实现位置**：
- `lib/style-anchor.ts` - 文风特征抽取与注入模块
- `lib/ai-generator.ts` - 集成文风约束到 Prompt

**核心功能设计**：
```typescript
interface StyleFeatures {
  wordPreferences: { highFreq: string[], forbidden: string[] };
  sentencePatterns: { shortRatio: number, dialogueRatio: number };
  emotionalIntensity: { tension: number, relaxation: number };
  narrativeRhythm: { actionDensity: number, infoRevealRate: number };
}

class StyleAnchor {
  // 初次抽取：第3段生成完成后
  // 增量更新：每新增5段或用户手动触发
  async extractStyle(
    storyId: string,
    recentMessages: ChatMessage[]
  ): Promise<StyleFeatures>;
  
  // 仅注入摘要向量，不回灌完整历史文本
  injectStylePrompt(basePrompt: string, features: StyleFeatures): string;
}
```

**数据库设计**：
```sql
CREATE TABLE IF NOT EXISTS story_style_anchors (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  features_json TEXT NOT NULL, -- StyleFeatures JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id)
);
```

**API 接口**：
- `POST /api/stories/:id/style/extract` - 抽取文风锚点
- `POST /api/stories/:id/style/update` - 手动更新文风锚点
- `GET /api/stories/:id/style` - 获取当前文风设置

#### 6.1.2 冲突检测与解释式改写

**实现位置**：
- `lib/conflict-detector.ts` - 冲突检测引擎
- `lib/rewrite-suggestion.ts` - 改写建议生成

**核心功能设计**：
```typescript
enum ConflictLevel { P0 = "强冲突", P1 = "中冲突", P2 = "弱冲突" }

interface ConflictResult {
  level: ConflictLevel;
  conflictPoint: string;
  reason: string;
  rewriteSuggestions: string[];
  rewrittenInstruction: string;
}

class ConflictDetector {
  // 两段式判定：规则引擎快速判定 + AI辅助判定
  async detect(
    content: string,
    worldCard: World,
    characters: Character[]
  ): Promise<ConflictResult | null>;
  
  // 解释式改写输出模板
  formatRewriteSuggestion(result: ConflictResult): string;
}
```

**冲突分级与处理策略**：
- `P0` 强冲突：直接违反世界硬规则 → 拦截并返回改写建议
- `P1` 中冲突：与角色核心人设冲突 → 拦截并返回改写建议
- `P2` 弱冲突：语气/情绪偏移 → 放行并附提示

**数据库设计**：
```sql
CREATE TABLE IF NOT EXISTS conflict_detection_logs (
  id TEXT PRIMARY KEY,
  story_id TEXT,
  character_id TEXT,
  world_id TEXT,
  content TEXT,
  conflict_level TEXT, -- P0/P1/P2
  conflict_details_json TEXT, -- ConflictResult JSON
  created_at TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id),
  FOREIGN KEY (character_id) REFERENCES characters(id),
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);
```

**API 接口**：
- `POST /api/stories/:id/check-conflict` - 检测内容冲突
- `GET /api/stories/:id/conflict-logs` - 获取检测历史

#### 6.1.3 一致性校验

**实现位置**：
- `lib/consistency-checker.ts` - 一致性校验器

**核心功能设计**：
```typescript
class ConsistencyChecker {
  // 校验范围：角色身份/关系、时间顺序、地点约束
  // 校验方式：规则库校验为主，AI校验为辅
  
  async checkConsistency(
    chapterContent: string,
    context: {
      story: Story,
      characters: Character[],
      previousChapters: Chapter[]
    }
  ): Promise<{
    violations: { severity: "warning" | "error", description: string }[],
    autoFixDraft: string | null
  }>;
}
```

**数据库设计**：
```sql
CREATE TABLE IF NOT EXISTS consistency_check_logs (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  chapter_id TEXT,
  violations_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id)
);
```

#### 6.1.4 段落级再生成

**实现位置**：
- `lib/ai-generator.ts` - 新增段落重写方法
- `app/api/chat/sessions/:id/rewrite/route.ts` - 重写 API

**核心功能设计**：
- 用户选择需要重写的段落
- 保留段落之前的上下文
- 只重新生成目标段落
- 提供"自动修正"与"保持原文"二选一

---

### 6.2 世界探索增强

#### 6.2.1 世界探索对话模式

**实现位置**：
- `app/api/chat/sessions/route.ts` - 新增 `explore` 会话类型
- `app/(main)/worlds/[id]/explore/page.tsx` - 世界探索页面

**核心功能设计**：
```typescript
// 探索模式 Prompt 示例
const explorePrompt = `
# 世界探索模式
你是《${worldName}》的世界引导者。
- 用户可以询问关于世界的任何问题
- 你需严格遵循知识库词条回答
- 如果问题超出已知范围，诚实地说明
- 可以主动提出相关探索方向
`;
```

**数据库设计**：
```sql
-- 知识库词条已存在于 knowledge_entries
-- 探索会话与普通会话结构相同
```

#### 6.2.2 知识图谱可视化

**实现位置**：
- `lib/knowledge-graph.ts` - 图谱构建模块
- `components/KnowledgeGraphViewer.tsx` - 图谱展示组件

**核心功能设计**：
- 使用 `d3.js` 或 `react-force-graph` 实现
- 展示实体（角色、地点、物品、组织）
- 展示实体间关系

---

### 6.3 故事体验增强

#### 6.3.1 剧情分支探索

**实现位置**：
- `app/api/stories/[id]/branches/route.ts` - 分支管理 API
- `app/api/stories/[id]/branches/[branchId]/route.ts` - 分支操作 API
- `app/(main)/stories/[id]/play/page.tsx` - 故事体验页扩展

**数据库设计**：
```sql
CREATE TABLE IF NOT EXISTS story_branches (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  parent_branch_id TEXT, -- null 表示主线
  fork_chapter_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active', -- active/archived
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id),
  FOREIGN KEY (parent_branch_id) REFERENCES story_branches(id)
);

CREATE TABLE IF NOT EXISTS branch_nodes (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  parent_node_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES story_branches(id)
);
```

**分支合并模式**：
- **覆盖主线**：分支节点替换主线对应节点内容
- **插入主线**：分支内容插入到主线指定节点后
- **归档**：未采用分支可标记 archived

**API 接口**：
- `POST /api/stories/:id/branches` - 创建分支
- `GET /api/stories/:id/branches` - 获取分支列表
- `PATCH /api/stories/:id/branches/:branchId` - 更新分支
- `POST /api/stories/:id/branches/:branchId/merge` - 合并分支
- `DELETE /api/stories/:id/branches/:branchId` - 删除/归档分支

#### 6.3.2 冒险存档系统

**实现位置**：
- `lib/archive-manager.ts` - 存档管理
- `app/api/chat/sessions/[id]/archives/route.ts` - 存档 API

**核心功能设计**：
- 自动保存关键节点存档
- 支持手动创建命名存档
- 展示存档列表和时间线
- 快速切换到任意存档

**数据库设计**：
```sql
CREATE TABLE IF NOT EXISTS session_archives (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT, -- 用户自定义命名
  message_id TEXT NOT NULL, -- 存档点的最后一条消息
  content_snapshot_json TEXT NOT NULL, -- 会话内容快照
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**API 接口**：
- `POST /api/chat/sessions/:id/archives` - 创建存档
- `GET /api/chat/sessions/:id/archives` - 获取存档列表
- `POST /api/chat/sessions/:id/archives/:archiveId/restore` - 恢复存档
- `DELETE /api/chat/sessions/:id/archives/:archiveId` - 删除存档

#### 6.3.3 自定义角色创建

**实现位置**：
- `app/api/stories/:id/custom-characters/route.ts` - 自定义角色 API
- `app/(main)/stories/[id]/play/character-creator/page.tsx` - 角色创建页面

**核心功能设计**：
- 用户可以创建自定义角色加入体验
- 角色可以有基本属性、性格、背景故事
- 支持导入现有角色卡模板

---

### 6.4 内容资产管理

#### 6.4.1 封面图/插图上传

**实现位置**：
- `app/api/assets/upload/route.ts` - 资源上传 API
- `app/api/stories/[id]/cover/route.ts` - 封面管理 API
- `app/api/chapters/[id]/illustrations/route.ts` - 插图管理 API

**核心功能设计**：
- 支持上传 JPG/PNG 图片（≤10MB）
- 自动生成缩略图
- 支持为章节添加插图
- 导出时自动嵌入封面

**数据库设计**：
```sql
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- cover/illustration/other
  target_type TEXT, -- story/chapter/character/world
  target_id TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**API 接口**：
- `POST /api/assets/upload` - 上传资源
- `GET /api/assets/:id` - 获取资源
- `DELETE /api/assets/:id` - 删除资源
- `POST /api/stories/:id/cover` - 设置封面
- `POST /api/chapters/:id/illustrations` - 上传章节插图

#### 6.4.2 角色头像 AI 生成

**实现位置**：
- `app/api/characters/[id]/generate-avatar/route.ts` - AI 生成头像 API
- `lib/avatar-generator.ts` - 头像生成模块

**核心功能设计**：
- 可以基于角色描述生成头像
- 提供多个风格选项（二次元/写实/卡通等）
- 支持用户选择并保存

---

### 6.5 市场与发现增强

#### 6.5.1 高级搜索与筛选

**实现位置**：
- `app/api/feed/route.ts` - 扩展推荐流 API
- `components/AdvancedSearchPanel.tsx` - 搜索面板组件

**核心功能设计**：
- 支持按标签筛选
- 支持按作者筛选
- 支持按评分筛选
- 支持按类型筛选（故事/角色/世界）
- 支持按时间范围筛选

**API 接口**：
- `GET /api/feed?tags=tag1,tag2&author=user1&rating=4` - 高级筛选

#### 6.5.2 评分系统

**实现位置**：
- `app/api/reviews/route.ts` - 评分/评论 API
- `app/(main)/market/reviews/[id]/page.tsx` - 评论页面

**数据库设计**：
```sql
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL, -- story/character/world
  target_id TEXT NOT NULL,
  rating INTEGER NOT NULL, -- 1-5
  content TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, target_type, target_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**API 接口**：
- `POST /api/reviews` - 提交评分/评论
- `GET /api/reviews/:targetType/:targetId` - 获取评论列表
- `PATCH /api/reviews/:id` - 更新评论
- `DELETE /api/reviews/:id` - 删除评论

#### 6.5.3 推荐算法优化

**实现位置**：
- `lib/recommendation-engine.ts` - 推荐引擎
- `app/api/feed/route.ts` - 优化推荐流

**核心功能设计**：
```typescript
// 推荐打分公式
score = 0.45 * like_score + 0.25 * follow_score + 0.20 * tag_match + 0.10 * freshness

// 用户画像构建
class UserProfile {
  preferredTags: string[];
  followedAuthors: string[];
  recentLikes: string[];
  readingHistory: string[];
}
```

---

### 6.6 社区功能

#### 6.6.1 评论区功能

**实现位置**：
- `app/api/comments/route.ts` - 评论 API
- `app/(main)/stories/[id]/comments/page.tsx` - 故事评论页面
- `app/(main)/characters/[id]/comments/page.tsx` - 角色评论页面
- `app/(main)/worlds/[id]/comments/page.tsx` - 世界评论页面

**数据库设计**：
```sql
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL, -- story/character/world
  target_id TEXT NOT NULL,
  parent_comment_id TEXT, -- 回复的评论
  content TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_comment_id) REFERENCES comments(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id, created_at DESC);
```

**核心功能**：
- 发布评论
- 回复评论
- 评论点赞
- 删除评论
- 举报评论
- 评论分页

**API 接口**：
- `POST /api/comments` - 发布评论
- `GET /api/comments/:targetType/:targetId` - 获取评论列表
- `PATCH /api/comments/:id` - 更新评论
- `DELETE /api/comments/:id` - 删除评论
- `POST /api/comments/:id/like` - 点赞评论
- `POST /api/comments/:id/report` - 举报评论

#### 6.6.2 作者社交主页

**实现位置**：
- `app/(main)/authors/[id]/page.tsx` - 作者主页
- `app/api/authors/[id]/stats/route.ts` - 作者统计 API

**数据库设计**：
```sql
-- 用户表已包含基本信息，只需补充统计视图
-- 通过查询构建统计数据
```

**核心功能**：
- 展示作者简介
- 展示作者作品列表
- 展示粉丝数/关注数
- 展示作品统计（点赞数/收藏数）
- 展示二创关系展示
- 关注/取消关注
- 查看作者通知

**API 接口**：
- `GET /api/authors/:id` - 获取作者信息
- `GET /api/authors/:id/works` - 获取作者作品
- `GET /api/authors/:id/stats` - 获取作者统计

#### 6.6.3 二创关系链

**实现位置**：
- `app/api/derivative-works/route.ts` - 二创关系 API
- `components/DerivativeChainViewer.tsx` - 二创关系图组件

**数据库设计**：
```sql
CREATE TABLE IF NOT EXISTS derivative_relations (
  id TEXT PRIMARY KEY,
  derived_work_type TEXT NOT NULL, -- story/character/world
  derived_work_id TEXT NOT NULL,
  original_work_type TEXT NOT NULL, -- story/character/world
  original_work_id TEXT NOT NULL,
  relation_type TEXT NOT NULL, -- inspired_by/remix/continuation
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (derived_work_id) REFERENCES stories(id),
  FOREIGN KEY (original_work_id) REFERENCES stories(id)
);
```

**核心功能**：
- 标注二创关系
- 展示二创关系链图
- 展示衍生作品列表
- 展示原作品列表

**API 接口**：
- `POST /api/derivative-works` - 标记二创关系
- `GET /api/derivative-works/:workType/:workId` - 获取二创关系
- `GET /api/derivative-works/chain/:workType/:workId` - 获取二创关系链

---

### 6.7 技术架构升级

#### 6.7.1 Redis 缓存层

**实现位置**：
- `lib/cache.ts` - 缓存接口
- `lib/redis-client.ts` - Redis 客户端

**缓存策略**：
- 推荐流（TTL 5分钟）
- 通知未读计数（TTL 1分钟）
- 用户资料（TTL 10分钟）
- 热门作品（TTL 30分钟）

**实现**：
```typescript
class CacheService {
  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  async del(key: string): Promise<void>;
}
```

**环境变量**：
```env
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

#### 6.7.2 PostgreSQL 迁移

**实现位置**：
- `docs/postgresql-migration.md` - 迁移文档
- `scripts/migrate-to-postgres.ts` - 迁移脚本

**迁移策略**：
- SQLite -> PostgreSQL 双写阶段
- 读流量逐步切到 PostgreSQL
- 完全切换到 PostgreSQL

#### 6.7.3 多模型切换

**实现位置**：
- `lib/model-manager.ts` - 模型管理
- `lib/providers/` - 各模型提供商适配器

**支持模型**：
- OpenAI (GPT-4/GPT-3.5)
- Claude 3
- Ollama（本地模型）
- 其他兼容 OpenAI 格式的模型

**API 接口**：
- `GET /api/models` - 获取可用模型列表
- `POST /api/settings/model` - 设置默认模型
- `POST /api/chat/sessions/:id/switch-model` - 切换会话模型

#### 6.7.4 RAG 优化

**实现位置**：
- `lib/rag-engine.ts` - RAG 引擎
- `lib/vector-store.ts` - 向量存储

**核心功能**：
- 将角色卡、世界卡、知识库向量化
- 检索相关内容注入 Prompt
- 提升一致性和准确性

---

### 6.8 里程碑更新

#### 阶段 A+（社区增强，2-3 周）
- 评论区功能
- 作者社交主页
- 二创关系链
- 封面/插图上传
- 评分系统

#### 阶段 B（增长，6-8 周）
- 文风保持器
- 冲突检测与解释式改写
- 一致性校验
- 剧情分支探索
- 冒险存档系统
- Redis 缓存
- 多模型切换
- RAG 优化

#### 阶段 C（生态，8-12 周）
- 知识图谱可视化
- 角色头像 AI 生成
- 自定义角色创建
- 世界探索对话模式
- 段落级再生成
- 高级搜索与筛选
- 推荐算法优化
- PostgreSQL 迁移  
