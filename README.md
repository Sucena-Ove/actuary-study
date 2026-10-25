# 精算随身练 · 公开学习站

免费静态学习站，面向概率论与数理统计。包含首页、知识点目录、可搜索题目目录、每题独立 HTML 页面、学习笔记和保留本机进度的刷题区。

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
