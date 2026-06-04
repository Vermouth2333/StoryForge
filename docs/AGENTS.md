<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# StoryForge — Agent / 开发约束

> 本文件是 AI Agent 与开发者在本仓库工作的统一约束。落地细节以 `docs/StoryForge_技术文档.md` 为权威来源；本文件与之冲突时以技术文档为准。

## 0. 工作前置（必须）

1. 先阅读 `docs/StoryForge_技术文档.md` 对应章节，再动手写代码。
2. 涉及数据库时，先看 `docs/sqlite_schema.sql` 与 `lib/db.ts` 的实际建表/迁移逻辑。
3. 涉及对外接口时，先看 `docs/openapi.yaml`，保持接口契约一致。
4. Next.js 行为以 `node_modules/next/dist/docs/` 为准，不要凭训练记忆假设 API。
5. 不确定时先搜索现有实现，复用既有模式，不要新造风格。

## 1. 技术栈与版本（不得擅自更换）

- Next.js `16.2.3`（App Router）+ React `19.x` + TypeScript `5.x`（`strict: true`）。
- 数据层：SQLite（WAL 模式，`sqlite` + `sqlite3`）+ 文件系统存储；迁移计划见 `docs/postgresql-migration.md`。
- 参数校验：`zod`。鉴权：`jose`（JWT，HttpOnly Cookie）。缓存/限流：`ioredis`。
- 导出：`pdfkit`、`jszip`；图像处理：`sharp`。
- 路径别名：`@/*` 映射仓库根目录。
- 新增依赖需有明确理由；优先使用现有依赖，避免引入能力重复的库。

## 2. 目录与分层约定

- `app/(main)/**`：登录后用户页面。`app/admin/**`：后台。`app/api/**`：API 路由。
- `lib/**`：业务逻辑、数据访问、领域服务。API 路由保持“薄”，业务逻辑下沉到 `lib`。
- `components/**`：可复用 UI 组件。
- `storage/**`：运行时生成（数据库、用户文件、导出物），**不要提交**也不要手改。
- 命名沿用现有风格：`lib` 用 kebab-case（如 `model-manager.ts`），组件用 PascalCase。

## 3. API 路由约定

- 统一响应结构：`{ code: number, data?: unknown, msg: string }`，HTTP 状态码与 `code` 对应。
  - 成功：`{ code: 200, data, msg: "ok" }`；参数错误：`{ code: 400, msg: "参数错误" }`（HTTP 400）。
- 所有入参用 `zod` 的 `safeParse` 校验，失败即返回 400，不要信任客户端输入。
- 通过 `getCurrentUserId()`（`lib/auth.ts`）获取用户身份；不要自行解析 Cookie/JWT。
- 数据库通过 `getDb()` 获取，ID 用 `id(prefix)` 生成，时间用 `nowIso()`（均来自 `lib/db.ts`）。
- SQL 一律使用参数化查询（`?` 占位），禁止字符串拼接 SQL。
- 写接口（POST/PUT/DELETE）依赖 `middleware.ts` 的跨站变更防护，保持从本站发起。

## 4. 数据库约定

- 表结构变更必须通过 `lib/db.ts` 的迁移逻辑（`addColumnIfMissing` / `CREATE TABLE IF NOT EXISTS`），保证幂等、可重复执行。
- 同步更新 `docs/sqlite_schema.sql`，使其与实际结构一致。
- 数组/结构化字段以 JSON 文本存储（如 `tags_json`），读写时显式序列化/反序列化。
- 状态字段使用既有枚举语义（如 `draft` / `published` / `deleted`），不要新增同义状态。
- 编写 SQL 时兼顾未来的 PostgreSQL 迁移（见 `docs/postgresql-migration.md`），避免滥用 SQLite 特有语法。

## 5. 安全与合规（强约束）

- 所有用户文本字段服务端统一做 XSS 过滤；长度限制遵循技术文档（如简介 ≤ 500 字）。
- 手机号仅存脱敏值 `phone_masked`，展示如 `138****1234`；校验 `^1[3-9]\d{9}$`。
- 头像上传：仅 `JPG/JPEG/PNG`，单文件 ≤ 5MB，按技术文档的存储路径与缩略图规则处理。
- 账户注销走 `lib/account-deletion.ts` 既有流程；遵守日志保留与作品处理合规要求。
- 不在日志/响应中输出密钥、Token、完整手机号等敏感信息。
- 鉴权失败统一返回 401/403，不泄露内部细节。

## 6. UI 视觉约束（白 + 浅蓝）

- 主色 `#5B9DFF`（hover `#7FB4FF`，active `#3F86F5`）；浅蓝背景 `#EEF6FF`；页面背景 `#F8FBFF`；面板 `#FFFFFF`；边框 `#DCE9FF`。
- 主文字 `#1F2A44`，次文字 `#5B6B8C`。
- 侧边栏选中：浅蓝底 + 左侧 3px 主色条；主按钮实底，次按钮白底描边。
- 可访问性：正文对比度 ≥ WCAG AA（4.5:1）；状态不可仅用颜色区分，需配合图标/文案。
- 响应式：优先 PC（≥1024px），平板侧边栏折叠为图标栏，移动端折叠为顶部抽屉。

## 7. 代码质量

- 通过 TypeScript 严格类型检查，避免 `any`；公共边界处显式标注类型。
- 提交前运行 `npm run lint`，遵循 `eslint-config-next` 规则。
- 只做被要求或明确必要的改动；不顺手重构、不加无关注释/文档。
- 复用现有工具函数与服务，不重复造轮子。
- 错误在边界处处理并返回规范响应，不吞异常。

## 8. 常用命令

```bash
npm install     # 安装依赖
npm run dev     # 本地开发（http://localhost:3000）
npm run build   # 生产构建
npm run lint    # 代码检查
```

## 9. 禁止事项

- 不提交/修改 `storage/**` 运行时数据。
- 不绕过 `zod` 校验、`middleware` 防护或鉴权。
- 不在 API 路由内直接拼接 SQL 或硬编码用户身份。
- 不擅自升级/替换核心框架与依赖版本。
- 不引入与技术文档冲突的接口契约或数据结构。
