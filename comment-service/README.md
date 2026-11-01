# 匿名评论服务部署与管理

题库继续放在 GitHub Pages；这里把评论 API 和管理员后台放在 Netlify，把评论放在 Neon PostgreSQL。发布后，个人电脑关机不影响题库或评论。访客不注册，每条评论显示“匿名同学”；站长单独登录管理后台。

## 先准备云端，再打开题库评论开关

本目录是待部署的服务源码，不代表云端已经启用。必须完成数据库初始化、管理员创建以及下面的真实联调，才把题库 `comments-config.js` 的 `serverURL` 填成服务地址并启用。绝不能把数据库连接串、密码、JWT_TOKEN 或 BOOTSTRAP_TOKEN 放进 GitHub、前端配置、聊天或构建日志。

### 1. Neon 数据库

使用 Sucena-Ove 的 GitHub 账号在 [Neon 官方控制台](https://console.neon.tech/) 创建项目。选择可用免费方案；页面若要求付款或升级，先停在该页面核实费用。

在项目 SQL Editor 中，依次执行以下两个文件的全部内容：

1. `sql/waline.pgsql`：原样保留的 Waline 官方表结构，创建 Comment、Users 和 Counter 表。
2. `sql/service-guards.sql`：增加原子限频表和索引。

官方第一份 SQL 只在全新数据库执行一次，不要重复运行或为了消除“已存在”报错而删除表。随后从 Neon Connect 复制连接信息到 Netlify 的服务端环境变量，按下文区分秘密与普通配置。推荐 Neon pooled hostname（名称含 `-pooler`），端口默认 5432；不要把整条连接串粘进公开文件。

### 2. Netlify 项目

在 [Netlify 官方控制台](https://app.netlify.com/) 用同一个 GitHub 账号登录，Import an existing project，选择 `Sucena-Ove/actuary-study`。GitHub App 只授权这一个仓库即可。

| 配置 | 值 |
| --- | --- |
| Production branch | `main` |
| Base directory | `comment-service` |
| Build command | `npm run build` |
| Publish directory | `public`（相对于 Base directory） |
| Functions directory | `netlify/functions`（相对于 Base directory） |
| Node | 24，由 `netlify.toml` 固定 |

Netlify 应检测本目录的 `netlify.toml` 和 `package-lock.json`。安装禁用生命周期脚本；build 只校验题号清单并复制锁定版本的管理员 JavaScript 到本站。没有自动买域名或付费动作。

函数包使用 `included_files` 的负向匹配排除 `node_modules/@mathjax/**`：服务端已经强制关闭 TeX，相关引擎和字体不会执行，避免完整依赖树超过 Netlify/Lambda 的 250 MiB 解压大小限制。该配置只影响部署包，不删除安装目录或原始文件。不要顺手排除 SQLite、CloudBase、LeanCloud 或 IP 地区库；Waline 启动时或后台仍会加载相关模块。将来若启用服务端 TeX，必须同时重新设计打包并重新验收，不能只改环境变量。

取得 `https://项目名.netlify.app` 后，在 Netlify Project configuration → Environment variables 设置下面字段，作用域为 Functions（或全部作用域），Production 环境。不要给公开部署预览共享生产库和初始化密钥。

只把凭据类字段标为 **Secret**：`PG_PASSWORD`、`JWT_TOKEN`、`BOOTSTRAP_TOKEN`，以及启用人机验证后的 `TURNSTILE_SECRET`。公开网址、端口、布尔开关等非敏感配置不要标为 Secret；它们可能正常出现在文档或默认代码中，误标会触发 Netlify secrets scan 并阻止发布。不要为了绕过这种配置误报关闭秘密扫描，也不要把真正的密码改成普通公开配置。

| 字段 | 内容 |
| --- | --- |
| `SERVER_URL` | `https://项目名.netlify.app/.netlify/functions/comment`，末尾不要额外路径；普通配置，不标 Secret |
| `NODE_OPTIONS` | 必填 `--experimental-require-module`；普通配置，不标 Secret，必须作用于 Production Functions（免费方案可选全部作用域） |
| `SITE_URL` | 可不填；默认 `https://sucena-ove.github.io/actuary-study/`。若填写，使用普通配置，不标 Secret |
| `PG_HOST` | Neon 的 pooled hostname，不含 `https://` |
| `PG_PORT` | 可不填；默认 `5432`。若填写，使用普通配置，不标 Secret |
| `PG_DB` | Neon 数据库名 |
| `PG_USER` | Neon 数据库用户名 |
| `PG_PASSWORD` | Neon 数据库密码，仅服务端秘密 |
| `PG_SSL` | `true`，本项目强制 TLS 且验证服务器证书 |
| `JWT_TOKEN` | 自行生成的至少 32 字符随机秘密，用于管理员登录签名；不要与数据库密码相同 |
| `BOOTSTRAP_TOKEN` | 另一条至少 32 字符随机秘密，仅首次创建管理员用 |
| `COMMENT_AUDIT` | `false` 立即显示；希望先审核则设 `true` |

随机秘密可用密码管理器生成。不要使用这里的字段名或测试文件中的测试字符串作为真正密码。环境变量改完需要重新部署。

Netlify Functions 使用 AWS Lambda Node.js 运行时。Lambda 默认关闭 `require()` 加载 ES Module，而当前 Waline 的依赖需要该能力，因此仅设置 Node 24 还不够，必须配置上述 `NODE_OPTIONS`。缺少它会在 `waline-init` 阶段出现 `ERR_REQUIRE_ESM` 并返回 503；这是运行时兼容设置，不是数据库密码错误。参见 [AWS 官方 Node.js 运行时说明](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)。

### 3. 由你本人创建唯一管理员

访问 `https://项目名.netlify.app/.netlify/functions/comment/setup`。在该服务自己的页面输入 Netlify 中的 `BOOTSTRAP_TOKEN`，验证成功后会跳转到 Waline 注册页。此时你自己输入管理员邮箱和 **12–128 位**密码；不需要告诉助手。

初始化秘密不进 URL。服务会签发仅该站可用、15 分钟过期的 HttpOnly/Secure/SameSite=Strict cookie。公开 `/api/user` 注册接口一直关闭；只有持有该 cookie 且用户表为空的请求才可创建第一个账号。数据库事务锁防止两个并发请求同时抢占管理员。已有任何账号时，后续注册全部拒绝。

创建后，正常登录管理后台确认可以管理评论，再清空 Netlify 中 `BOOTSTRAP_TOKEN` 的 Production 值并重新部署。不要删除或清空 `JWT_TOKEN`。日常后台地址为 `https://项目名.netlify.app/.netlify/functions/comment/ui`，可以在手机或其他电脑使用；不依赖这台电脑开机。未登录时，后台会通过登录页的 `redirect=/ui` 等已验证站内路径返回原页面；外部跳转及 URL 中的 `token`、`state`、`code` 登录参数仍被拒绝。日常请直接打开上述后台地址。

管理员可查看、编辑、删除、审核评论。所有通过题目评论框和回复框提交的新内容都显示匿名；后台管理权限仍由登录凭据核实。访客不能自选“管理员”昵称或发送身份字段。无登录匿名访客没有永久身份，因此不提供自行删除跨设备评论；有删除需求可向作者说明题号和评论内容。

### 4. 真正联调通过后再启用

- 打开 `SERVER_URL/health`，应返回 `ok:true`；这只证明函数能初始化，不证明数据库读写成功。
- 无初始化 cookie 直接访问 `/ui/register` 或向 `/api/user` 提交，应返回 403。
- 管理员登录成功，空评论列表可打开。
- 题库测试配置中填写服务 URL；在两种浏览器对同一题测试：一个匿名发言，另一个能看到；不同题互不混合，回复保持同题。
- 60 秒内再次发言返回限频提示；刷新后首次评论仍存在。管理后台删除后，另一浏览器刷新应不再显示。
- 验证已有管理员后不能再注册；清空 BOOTSTRAP_TOKEN 的 Production 值并重新部署后，旧初始化 cookie 也失效。
- 最后启用生产题库的公开评论开关。

题库构建会自动刷新 `question-ids.json`；每次增加题目后，需让 Netlify 从同一最新提交重新部署，否则新增题号暂不能评论。线程固定为 `/actuary-study/questions/{题号}.html`，练习进度、URL 查询参数、设备和昵称不参与线程标识。

## 数据、安全与维护

评论服务只接受生产题库和评论服务本身的浏览器 Origin。评论最长 2000 字，同 IP 每 60 秒一条，限频写入使用 PostgreSQL 原子 UPSERT，跨函数实例生效。只允许合法题号；回复的父评论必须属于同题且已公开。跨域限制不是机器人身份验证，大量恶意流量仍需平台限额、审核或人机验证。

评论经 Waline 的 DOMPurify 渲染净化，禁远程图片、iframe、视频等媒体。Markdown 基本格式可用，暂不启用服务端 TeX 运算。关闭公开地区、设备信息、外部头像、第三方 OAuth 与 Akismet 内容上报。所有访客显示匿名，不代表云端绝不记录网络信息：Waline 评论表仍保存 IP 供防刷和后台管理，Netlify 也有请求日志。不要在评论里提交个人隐私。

前端关闭访客登录、注册、评论点赞、全站最近评论、文章计数等功能；服务端同样拒绝这些 Waline 额外写入接口。独立的题目赞踩功能见下文。管理员 UI 使用锁定版本的本地脚本，不加载浮动 CDN。数据库导入/导出 API 关闭，备份请通过 Neon 控制台或 PostgreSQL 官方工具完成，并只保存在私密位置。没有配置 SMTP，所以暂不提供邮箱找回密码；请把管理员密码保存在密码管理器里。

需要审核时将 `COMMENT_AUDIT=true`，重新部署，再同步修改前端提示。需要人机验证时可在 Cloudflare 官方申请 Turnstile，配置 `TURNSTILE_KEY` 与 `TURNSTILE_SECRET`；公开 key 可以给前端，secret 只能给服务端。访客仍不需要注册。首次部署未配置此第三方服务。

## 本地验收与依赖

### 题目赞踩与密钥榜单

每道题的赞数、踩数公开可读，任何游客可以匿名投一票、切换赞踩或撤销。无登录设备用本机随机的 32 字节标识（64 位小写 hex）表示；同设备同题只保存一条记录。它不是实名身份：换浏览器、清除本地数据或更换设备仍可能再次投票，不能声称彻底阻止刷票。服务器同时对平台提供的真实连接 IP 和设备各做 1 秒限频，不信任调用者的 `x-forwarded-for`。两类限频键和投票设备标识都保存为服务端 HMAC，不保存原始设备标识或新增投票 IP 字段；现有 Waline 评论 IP 规则不变。多人共用出口时，可能需要间隔一秒操作。

新增投票数据只写 `wl_question_vote`，唯一键为题号和设备 HMAC，`vote` 为 `1`、`-1`、`0`；限频复用 `wl_request_limit` 的独立命名空间。撤销改成 0 并保留记录，不删除其他访客的数据。运行时首次访问自动以事务与 advisory lock 执行 `CREATE TABLE IF NOT EXISTS`；也可预先执行 `sql/question-votes.sql`。既有评论、用户表无需迁移。建表或投票连接失败只令评价接口返回 503，不关闭原评论及管理后台。写入按题串行化并在同一事务计数，重复请求不会叠加票数。HMAC 使用现有 `JWT_TOKEN` 配合独立上下文；轮换该秘密会使同一浏览器产生新的设备摘要，旧票仍保留，需要在轮换前单独规划投票身份迁移。

| 接口 | 输入 | 成功响应中的 `data` |
| --- | --- | --- |
| `GET /api/question-vote?questionId=587` | 可选 `X-Study-Voter`，不传则 `myVote=0` | `{questionId, likes, dislikes, myVote}` |
| `PUT /api/question-vote` | 必填 `X-Study-Voter`，JSON `{questionId:587,vote:1}`；`vote` 可为 `-1` 或 `0` | `{questionId, likes, dislikes, myVote}` |
| `GET /api/question-rank?sort=likes&limit=20` | 必填 `X-Study-Access`；`sort` 可为 `likes`/`dislikes`，`limit` 为 1–100 | `{sort, limit, items:[{questionId,likes,dislikes}]}` |

接口成功返回 `{errno:0,data:...}`；错误返回 `{errno:HTTP状态码,errmsg:提示}`，均 `Cache-Control:no-store`。429 带 `Retry-After:1`。榜单只包含对应票数大于零且仍在题库清单里的题，票数降序、平票题号升序。只允许既有生产站点跨域；前端请求不携带管理员 cookie 或 Waline 令牌。URL、响应和应用日志不包含凭证或设备标识。

榜单要求真实解锁凭证，不信任前端的 unlocked 布尔值或公开 key-slot ID。前端解密原有题库的 32 字节内容密钥后，通过 `HKDF-SHA256(IKM=rawContentKey,salt=manifest.salt,info=UTF8(manifest.bankId+':question-rank-access:v1'),L=32)` 派生独立凭证，用小写 hex 放在 `X-Study-Access` 请求头。后端只持有 `study-access-verifiers.json` 中 `SHA256(UTF8(hexProof))` 的值，使用定长常量时间比较校验。该 JSON 是单向验证值，可随源码发布，不能拿它本身当凭证；禁止把原密钥、内容密钥或可用 proof 写入源码、构建日志或 URL。

持有有效密钥的人仍可主动分享自己的授权凭证，也可整理公开的逐题计数。这里保护的是内置榜单入口，不声称对公开赞踩数提供反抓取保密。更强的真人去重、个人权限回收需另建账号体系。本模块的内存数据库替身测试覆盖语义及事务边界，不替代上线后对真实 Neon 的有限验收。

```sh
npm ci --ignore-scripts
npm run build
npm test
node --experimental-require-module --test tests/handler.test.cjs
```

测试覆盖匿名身份、注册门禁、签名 cookie/过期、Origin、多值头和 query 别名、题号、跨题回复、长度、限频、管理员读写边界，以及真实 Waline HTTP handler 的注册、密码哈希、登录和脚本净化。测试数据库是隔离的内存替身，不是 Neon；数据库连接、SQL 执行与公网跨设备共享必须按上面的联调步骤单独验收。

直接依赖锁定 `@waline/vercel 1.43.4`、`@waline/admin 0.36.0`、`serverless-http 4.0.0`、`pg 8.23.1`。服务端渲染使用兼容补丁 `dompurify 3.4.17`，query 解析使用 `qs 6.16.1`，均通过 npm overrides 锁定并回归测试。

2026-10-27 安装审计仍有 15 条依赖告警（4 moderate、8 high、3 critical），位于 Waline 的 CloudBase/LeanCloud/Akismet 分支及其传递依赖（axios、lodash.set/unset、protobufjs、request/form-data/tough-cookie/uuid）。本部署只启用 PostgreSQL并关闭 Akismet/OAuth，未把这些服务的输入/API开放给访客；这不是“所有依赖无漏洞”的保证。不要直接运行 `npm audit fix --force`，它目前建议降级整个 Waline。升级应重新检查依赖链并重跑安全测试。

## 上游来源与许可

- [Waline 官方 Netlify 部署说明](https://waline.js.org/en/guide/deploy/netlify.html)
- [官方 Netlify starter](https://github.com/walinejs/netlify-starter)，保留 `LICENSE.netlify-starter`（MIT）。
- [Waline PostgreSQL 文档](https://waline.js.org/en/guide/database.html#postgresql)
- [官方 waline.pgsql](https://github.com/walinejs/waline/blob/main/assets/waline.pgsql)，本目录 `sql/waline.pgsql` 原样保留。
- [Waline 服务端配置与 hooks](https://waline.js.org/en/reference/server/config.html)
- [Waline 环境变量](https://waline.js.org/en/reference/server/env.html)

上游 npm package.json 的 license 字段标 MIT，但该版本包内 LICENSE 和仓库 LICENSE 是 GPL-2.0。这里保留实际 `LICENSE.waline` 全文，不把上游代码或 SQL 重标为 MIT；本目录源码按 GPL-2.0-only 提供。管理员脚本从锁定 npm 包在 build 时生成，来源与许可证一并保留。

2026-10-27 本地管理员脚本补丁：`scripts/build.cjs` 对 `@waline/admin 0.36.0` 的题目链接拼接函数作一处精确替换。仅 `/actuary-study/questions/{正整数题号}.html` 使用标准 URL 解析，避免 `SITE_URL` 与线程路径重复拼入项目目录；其他路径保留上游行为。题目线程、数据库内容及来源校验不变。原片段必须恰好出现一次，否则构建停止；`tests/admin-link.test.cjs` 覆盖普通题、难题链接及补丁匹配失败情形。升级管理员包时需重新检查补丁。
