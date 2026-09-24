# 超级管家 SuperButler

**订阅提醒 · 网站监控 · 个人导航** —— 你的云端生活管家，一个部署在单个 Cloudflare Worker 上的全栈个人工具。

前端深色星空风格，后端零服务器、零数据库运维，免费额度即可长期自用。

## 功能特性

- **订阅提醒**：域名续费、家人生日（支持农历，内置 1900–2109 年农历数据）；可设提前 N 天开始，之后每天推送一次，点击「续期」后停止
- **网站监控**：定时 HTTP 检测，记录响应耗时与历史可用率，正常 / 失效一目了然
- **个人导航**：多级分类、顶部搜索、内置多个搜索引擎一键切换，支持手机端
- **消息推送**：PushPlus（微信）与 SMTP（邮件）两种通知渠道，可自由启用

## 在线演示

<https://lover.tuu.qzz.io>

> 如不希望公开自己的站点地址，删除本行即可。

## 技术栈

- **前端**：Vue 3 + Vite + TailwindCSS + Element Plus + vue-router
- **后端**：Cloudflare Workers（Hono 路由）+ Workers Static Assets
- **数据**：Cloudflare D1（SQLite）+ KV（会话 / Logo / 缓存）
- **定时**：Workers Cron Triggers（每 5 分钟）

---

## 一键部署到 Cloudflare（推荐）

无需本地安装任何东西，点击下面的按钮，**D1 数据库、KV 命名空间、定时任务全部自动创建**：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/7txx/SuperButler)

操作步骤：

1. 点击按钮，按提示登录 / 授权 **GitHub** 与 **Cloudflare** 账号（免费注册即可）
2. 在配置页确认仓库名、Worker 名、资源名称（保持默认即可）
3. Cloudflare 自动 fork 仓库到你的 GitHub → 自动创建 D1 与 KV 并绑定 → 构建部署 → 自动初始化数据库表与默认数据
4. 部署完成后打开分配的网址，首次访问会进入**初始化**页面，设置管理员用户名和密码即可开始使用

以后你向 fork 后的仓库 `main` 分支推送代码，会自动构建部署，无需任何本地操作。

---

## 手动部署（进阶 / 本地操作）

更习惯在本地用命令行控制每一步，可以按下面的流程操作。整个过程约 5 分钟，**无需购买服务器或数据库**，Cloudflare 免费额度足够个人使用。

### 准备工作

1. 注册一个 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费）
2. 本地安装 **Node.js 18+**（推荐 20 / 22 LTS）：<https://nodejs.org/>

### 1. 获取项目并安装依赖

```bash
git clone https://github.com/7txx/SuperButler.git
cd SuperButler
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

执行后会自动打开浏览器，点击 **Allow** 授权即可。

### 3. 创建 D1 数据库

```bash
npx wrangler d1 create superbutler
```

执行成功后会输出类似下面的内容，**复制其中的 `database_id`**：

```toml
[[d1_databases]]
binding = "DB"
database_name = "superbutler"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # ← 复制这个
```

### 4. 创建 KV 命名空间

```bash
npx wrangler kv namespace create KV
```

输出里会包含一个 **`id`**：

```toml
[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"   # ← 复制这个
```

### 5. 修改 wrangler.toml

打开项目根目录的 [wrangler.toml](wrangler.toml)，把上两步复制的 ID 填进去：

```toml
[[d1_databases]]
binding = "DB"
database_name = "superbutler"
database_id = "第 3 步得到的 database_id"

[[kv_namespaces]]
binding = "KV"
id = "第 4 步得到的 id"
```

其余内容（`name`、`[assets]`、`[triggers]`）保持默认即可。

### 6. 部署上线（自动初始化数据库）

```bash
npm run deploy
```

部署过程会先把表结构和默认数据写入远程 D1（`schema.sql` 可重复执行，不会覆盖已有数据），再发布 Worker。

部署成功后，终端会输出你的访问地址，形如：

```
https://superbutler.<你的子域名>.workers.dev
```

### 7. 创建管理员账号

用浏览器打开上面的地址。因为是首次使用、还没有管理员，页面会显示 **初始化** 表单，填写用户名和密码（至少 6 位）提交即可，之后会自动登录进入后台。

至此部署完成，开始使用吧。

---

## 绑定自定义域名（可选）

`workers.dev` 的默认域名在国内可能无法直接访问，绑定自己的域名体验更好：

1. 先在 Cloudflare 中添加你的域名（或将域名 DNS 托管到 Cloudflare）
2. 在 [wrangler.toml](wrangler.toml) 中加入（把域名换成你自己的）：

   ```toml
   [[routes]]
   pattern = "nav.yourdomain.com"
   custom_domain = true
   ```

3. 重新执行 `npm run deploy`，Cloudflare 会自动创建 DNS 记录和 SSL 证书

也可以在 Cloudflare 控制台 **Workers & Pages → 对应 Worker → Settings → Domains & Routes** 中图形化绑定。

---

## 本地开发

```bash
# 前端开发服务器（热更新）
npm run dev

# 本地运行完整 Worker（含 D1 / KV 模拟）
npm run dev:worker

# 把 schema.sql 初始化到本地模拟数据库
npm run db:local
```

---

## 后台配置指引

登录后台后，建议按以下顺序完善：

1. **通知渠道**：添加 PushPlus 或 SMTP（邮箱）并启用，订阅提醒才会送达
   - PushPlus：前往 <https://www.pushplus.plus/> 注册获取 token，可推送到微信
2. **订阅提醒**：添加域名续费 / 生日，选择周期与「提前 N 天开始」
3. **网站监控**：添加需要监控的网址与检测间隔
4. **导航管理**：创建分类、添加书签，前台立即生效
5. **系统设置**：可上传站点 Logo、备份 / 恢复全部数据

定时任务已由 `wrangler.toml` 中的 Cron 自动启用，无需额外配置。

---

## 目录结构

```
SuperButler/
├─ worker/              # Cloudflare Worker 后端
│  ├─ index.js          # 入口（路由 + 静态资源 + 定时任务）
│  ├─ routes/           # 各业务 API 路由
│  ├─ lib/              # 认证、检测、农历、订阅等核心逻辑
│  ├─ jobs/cron.js      # 定时任务（监控检测 + 订阅推送）
│  └─ notify/           # PushPlus / SMTP 推送实现
├─ src/                 # Vue 3 前端
│  ├─ views/            # 页面（前台 Home + 后台各页）
│  ├─ components/       # 分类树、侧边栏等组件
│  ├─ layouts/          # 后台布局
│  └─ router/           # 路由配置
├─ schema.sql           # D1 数据库结构与默认数据
├─ wrangler.toml        # Cloudflare Worker 配置
└─ package.json
```

---

## 常见问题

**Q：部署后打开是旧页面 / 白屏？**
浏览器按 `Ctrl + F5` 强制刷新，或清除缓存后重试。

**Q：可以监控这个站点自己的域名吗？**
可以。系统检测到监控地址是本站时会自动走内部通道，不会因 Worker 回环而误报。

**Q：检测结果和我本地访问不一致？**
检测是从 Cloudflare 全球机房发起的，反映的是公网整体可达性；本地运营商网络问题可能与之不同。

**Q：数据会丢吗？如何迁移？**
在「系统设置」中可导出全量备份（JSON），换新环境后导入即可恢复。

---

## License

本项目基于 [MIT License](https://opensource.org/licenses/MIT) 开源，欢迎自由使用与二次开发。
