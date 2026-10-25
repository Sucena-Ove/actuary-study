# 精算随身练 · 公开学习站

免费静态学习站，面向概率论与数理统计。包含首页、知识点目录、可搜索题目目录、每题独立 HTML 页面、学习笔记和保留本机进度的刷题区。

本次题库修订保留原有 516 道公开题，另提供 24 道原创加密进阶题、每日 1–120 骰子练习目标与“荒野套牛”小游戏。目标按北京时间在本机记录，不限制公开题库使用。游戏存档与学习记录独立。

这是静态网站，**不提供用户注册、登录或账号同步服务**。刷题进度保存在访问者当前浏览器；可在“我的”中导出、导入。不要向此仓库加入用户进度、后端数据库、密钥、签名文件或原始 PDF。

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

## 加密进阶题库

公开仓库只保存 `source-data/vault.json` 的密文和公开解密程序，构建时复制到刷题目录。首批 50 个随机密钥和题库制作明文保存在仓库外，不进入 Git。`tools/build_vault.py` 需要本地安装 `cryptography`，普通网站构建不需要它。

发布者可指定仓库外的题库 JSON 和私有 CSV，生成或更新密文：

```text
python tools/build_vault.py --bank /private/advanced-bank.json --codes /private/codes.csv --output source-data/vault.json --count 50
```

CSV 已存在时会复用其中的密钥，不覆盖发放记录。密钥有 160 位随机熵；每个密钥通过 HKDF-SHA-256 派生包装密钥，AES-256-GCM 保护内容密钥与题库。公开的 SHA-256 索引用于定位密钥槽，不是解密密码。

浏览器只请求密文文件，在本地解密；密钥不进入网址、学习备份或持久存储。刷新、离开或手动锁定后需要重新输入；错题题号与学习进度保留。浏览器须支持 WebCrypto，并使用 HTTPS 或 localhost 预览。

静态模式允许同一密钥重复使用或分享，不能保证一次性兑换、绑定用户、远程撤销或阻止持有效密钥者另存题目。历史公开的 516 题仍然公开；本功能不声称防止全部抓取。不要在此仓库发布私有 CSV、明文题库或生产密钥测试数据。

## 验证

```text
python -m pytest tests/test_vault_crypto.py
node tests/test_static_practice.cjs
```

第一项检查密钥隔离、全部测试密钥解密与密文篡改；第二项检查每日目标、旧进度兼容和锁定题库后的记录恢复。

## 本地预览

```text
python -m http.server 8765 --directory docs
```

浏览 `http://localhost:8765/`。刷题区通过 HTTP 读取题库，不建议直接用 `file://` 打开。

## GitHub Pages

拟使用仓库 `Sucena-Ove/actuary-study`，默认目标地址为 `https://sucena-ove.github.io/actuary-study/`；只有 GitHub Pages 实际部署成功后，该地址才可访问。

将此目录的内容推送到仓库的 `main` 分支，进入仓库 **Settings → Pages → Build and deployment → Source**，选择 **Deploy from a branch**，分支选择 **main**，目录选择 **/docs** 并保存。发布已经生成并检查过的 `docs/`，无需给自动化工作流额外授权。修改仓库名称或自定义域名时，先用新的 `--site-url` 重建，再发布。

所有站内页面和资源使用相对路径，兼容 `/actuary-study/` 项目子路径。每道题有稳定 URL，如 `questions/501.html`。正文、解析和公式替代文本直接在 HTML 中，阅读时不依赖 JavaScript。网站提供 canonical、基础 Open Graph 字段、`sitemap.xml` 和 `.nojekyll`。

## 搜索引擎

允许公开访问和提供 sitemap 只是抓取基础，不保证收录、排名或收录时间。发布后可以在 Google Search Console 和 Bing Webmaster Tools 中验证站点并提交 sitemap。项目站点里的 `robots.txt` 位于 `/actuary-study/robots.txt`；机器人通常只读取域名根目录 `/robots.txt`，因此项目目录中的文件主要是说明，**不能替代域名级 robots 控制**。网页未设置禁止索引，网站地图的 URL 均采用目标站点地址。

## 来源与范围

题目来源、回忆重建和原创改编范围见网站“关于与来源”及每题出处。零截断泊松笔记包含独立推导，未据模糊回忆宣称恢复官方原题。题库修订版不代表官方考试试卷。
