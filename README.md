# 世界杯球队志

纯静态网站，介绍多支世界杯代表性国家队的历史、风格、文化与球星。适合托管在 **GitHub Pages** 或任意静态文件托管服务。

## 本地预览

本站通过 `fetch` 加载 `data/teams.json`，请使用本地 HTTP 服务打开（不要直接用浏览器双击打开 `index.html`，否则可能无法加载数据）。

在项目根目录执行：

```bash
npx --yes serve .
```

浏览器访问终端里提示的地址（一般为 `http://localhost:3000`）。

## 部署到 GitHub Pages

1. 在 GitHub 上新建仓库，将本目录全部文件推送到默认分支（如 `main`）。
2. 打开仓库 **Settings → Pages**。
3. **Build and deployment** 中：
   - **Source** 选择 **Deploy from a branch**；
   - **Branch** 选 `main`，文件夹选 **`/ (root)`**，保存。
4. 等待一两分钟，通过 `https://<你的用户名>.github.io/<仓库名>/` 访问（用户名站点则可能是根域名）。

已包含空文件 `.nojekyll`，避免 GitHub Pages 对下划线等路径做 Jekyll 处理导致异常。

## 自定义

- 球队文案与字段：编辑 `data/teams.json`。
- 样式：编辑 `css/styles.css`。
- 交互与筛选逻辑：编辑 `js/app.js`。

## 说明

内容为足球文化向整理，非实时排名或赛程数据，仅供学习与交流。
