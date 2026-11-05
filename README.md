# 精算随身练 · 公开学习站

免费静态学习站，面向概率论与数理统计。包含首页、知识点目录、可搜索题目目录、每题独立 HTML 页面、学习笔记和保留本机进度的刷题区。

本次题库修订在原有 580 题基础上新增 31 题，共 611 题（新增题号 557–587）：19 道照片回忆补充与进阶改编题、12 道两人赌博的吸收马尔可夫链专题题。第587题按用户补充重建给定样本最大值的条件概率。统一标签为“回忆补充20261027”；此前 517–556 的 40 道回忆改编题仍保留。已逐项比对照片，未能可靠辨认的条件不擅自声称还原。新增题明确参数、独立性、停止规则与吸收边界，均附推导、易错提醒与来源。未解锁时，每日按北京时间掷一次 1–120 面骰子，随机抽取固定数量的不同题目，只能练习或回顾当日这组题；刷新不会重新抽取。有效密钥解除每日题数和自由选题限制。小游戏存档与学习记录独立。

学习网页由 GitHub Pages 托管，**不提供学习用户注册、登录或进度同步服务**。匿名评论、题目赞踩与受保护榜单通过独立 Netlify 服务保存到 Neon；管理员后台单独鉴权。刷题进度保存在访问者当前浏览器；可在“我的”中导出、导入。不要向此仓库加入用户进度、数据库数据、密钥、签名文件或原始 PDF。

## 主页知识导图

首页 `#knowledge-map` 按学习顺序组织 9 个模块、32 个知识分组、95 个精选考点入口，并提供 UMVUE、区间与检验、随机过程三条复习路线。`content/knowledge-map.json` 保存人工整理的层级和说明；构建时由 `tools/knowledge_map.py` 按题库的精确模块与标签计算相关题数，并校验所有入口存在。精选考点会交叉，不能相加；完整 611 题仍可由各模块入口访问。

导图支持展开、收起和搜索，清空搜索恢复原展开状态。无 JavaScript 时仍能展开原生目录并访问链接。所有知识点链接采用 `questions.html?module=...&tag=...` 精确过滤，旧关键词 `q` 搜索保留；当前专题会显示在结果页，可单独清除。导图不改变每日抽题、密钥验证和投票权限。

## 构建

仅需 Python 3 标准库，无需 Node 安装、CDN 或第三方网络资源：

```text
python build_site.py --site-url https://sucena-ove.github.io/actuary-study/
python check_site.py
```

更新题库时可指定兼容的题库和公式资源目录。资源目录应包含 `app.js`、`style.css`、`math-map.json` 与 `math/`：

```text
python build_site.py --bank /absolute/path/bank.json --assets /absolute/path/web --site-url https://sucena-ove.github.io/actuary-study/
```

输入将复制到 `source-data/`，网站输出到 `docs/`，之后可以独立重建。`source-data/app.js` 是输入版本；生成器仅在 `docs/practice/app.js` 做静态站适配。

## 密钥与本机解锁

首批 50 个随机密钥仍保存在仓库外，不进入 Git。`source-data/vault.json` 与公开解密程序用于验证有效密钥；其中原有 24 题已按作者要求并入普通题库，不再作为密钥专属内容。验证成功后开启自由练习和题目榜单，不重复追加题目。`tools/build_vault.py` 需要本地安装 `cryptography`，普通网站构建不需要它。

发布者可指定仓库外的题库 JSON 和私有 CSV，生成或更新密文：

```text
python tools/build_vault.py --bank /private/advanced-bank.json --codes /private/codes.csv --output source-data/vault.json --count 50
```

CSV 已存在时会复用其中的密钥，不覆盖发放记录。密钥有 160 位随机熵；每个密钥通过 HKDF-SHA-256 派生包装密钥，AES-256-GCM 保护内容密钥与题库。公开的 SHA-256 索引用于定位密钥槽，不是解密密码。

浏览器只请求验证文件，在本地验证密钥。按作者要求，成功验证的密钥单独保存在当前浏览器，下次打开自动验证恢复；不进入网址、网络请求或学习进度备份。共享电脑可点击“清除本机解锁”，清理网站数据或更换浏览器后需重新输入。浏览器须支持 WebCrypto，并使用 HTTPS 或 localhost 预览。

静态模式允许同一密钥重复使用或分享，不能保证一次性兑换、绑定用户或远程撤销。全部 611 题的原始文件仍公开可下载；修改或清除本机数据可以绕过每日限制。这是普通网页操作中的练习规则，不是服务器端付费权限控制。不要发布私有密钥 CSV 或生产密钥测试数据。

## 题目评价与受保护目录

每题公开赞踩总数；核对答案后，匿名访客可赞、踩、改投或撤销。同一浏览器使用随机标识，服务端仅存 HMAC；每题唯一记录保证重复请求不重复加票。匿名不能保证每个自然人一票，清理本机数据或换浏览器会产生新身份。写入同时按浏览器标识和网络来源限频。评论与题目评价分别存储，投票不会清除评论草稿。

有效密钥解锁后，首页的“全部题目”以及模块、专题入口打开完整目录。每行显示原题号、知识点和云端好评/差评总数，包含零票题；可按题号、好评数、差评数升降序排列，再按模块与专题交集筛选。先对完整筛选结果排序，再分页；支持直接做某题或按当前顺序练习整组，返回目录保留筛选、顺序与页码。当前题号不连续，保留原有编号以维持评论和记录对应关系。

目录一次请求受保护的 `GET /api/question-catalog`，服务端按合法题号清单聚合全部票数，未投票题补零。浏览器仅在内存处理这些总数与目录状态，不缓存解锁凭证到文件或学习备份；离开目录取消请求，返回时重新读取云端票数。原 `GET /api/question-rank` 接口保留兼容。

榜单仅在本机密钥解锁后展示，服务器还会验证独立的解锁凭证。浏览器从已通过认证解密的内容密钥派生 HKDF-SHA-256 凭证（salt 为现有 vault.salt，info 为 bankId + `:question-rank-access:v1`），只在内存保留，并通过专用请求头传递。服务端仅存该十六进制凭证的 SHA-256 校验值；这个公开校验值本身不能访问榜单。原密钥和内容密钥不上传。清除解锁或失败验证会清除凭证。

首次部署或重建 vault 后，使用原发放 CSV 同步生成服务端校验文件；此过程不改发放密钥或现有 vault：

```text
python tools/build_rank_verifier.py --vault source-data/vault.json --codes /private/codes.csv --output comment-service/study-access-verifiers.json
```

同一 vault 的密钥共享榜单权限，不支持按用户单独撤销。榜单入口和批量接口受保护，但单题票数公开，访客仍可自行整理这些公开数据。后台部署、表结构、鉴权与限频说明见 `comment-service/README.md`。

## 验证

```text
python -m pytest tests/test_vault_crypto.py
node tests/test_static_practice.cjs
node --test tests/test_rank_access.cjs tests/test_question_votes.cjs tests/test_question_catalog.cjs
```

第一项检查密钥隔离、测试密钥解密与密文篡改；第二项检查固定抽题范围、所有练习入口、北京时间换日、旧进度兼容及记住密钥。

## 本地预览

```text
python -m http.server 8765 --directory docs
```

浏览 `http://localhost:8765/`。刷题区通过 HTTP 读取题库，不建议直接用 `file://` 打开。

## GitHub Pages

拟使用仓库 `Sucena-Ove/actuary-study`，默认目标地址为 `https://sucena-ove.github.io/actuary-study/`；只有 GitHub Pages 实际部署成功后，该地址才可访问。

将此目录的内容推送到仓库的 `main` 分支，进入仓库 **Settings → Pages → Build and deployment → Source**，选择 **Deploy from a branch**，分支选择 **main**，目录选择 **/docs** 并保存。发布已经生成并检查过的 `docs/`，无需给自动化工作流额外授权。修改仓库名称或自定义域名时，先用新的 `--site-url` 重建，再发布。

所有站内页面和资源使用相对路径，兼容 `/actuary-study/` 项目子路径。旧题目 URL（如 `questions/501.html`）保留，但只引导进入刷题页统一检查；静态目录只展示题号、考点等元数据，不展示题干和答案。网站提供 canonical、基础 Open Graph 字段、`sitemap.xml` 和 `.nojekyll`。

## 搜索引擎

允许公开访问和提供 sitemap 只是抓取基础，不保证收录、排名或收录时间。发布后可以在 Google Search Console 和 Bing Webmaster Tools 中验证站点并提交 sitemap。项目站点里的 `robots.txt` 位于 `/actuary-study/robots.txt`；机器人通常只读取域名根目录 `/robots.txt`，因此项目目录中的文件主要是说明，**不能替代域名级 robots 控制**。单题入口设置 noindex 并移出网站地图，首页、知识点目录和学习笔记仍可索引。

## 来源与范围

题目来源、回忆重建和原创改编范围见网站“关于与来源”及每题出处。零截断泊松笔记包含独立推导，未据模糊回忆宣称恢复官方原题。题库修订版不代表官方考试试卷。
