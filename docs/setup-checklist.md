# BOSS Today 配置清单

更新：2026-10-16。按顺序做，每步做完再做下一步。密钥只填进 Vercel 和 Cloudflare，不要发给任何人。

## 总览：所有环境变量

**Vercel**（项目 → Settings → Environment Variables）

| 变量                                                                        | 状态        | 用途                   |
| --------------------------------------------------------------------------- | ----------- | ---------------------- |
| `DATABASE_URL`                                                              | 已有        | Neon 数据库            |
| `PAYLOAD_SECRET`                                                            | 已有        | 登录加密               |
| `SUPER_ADMIN_EMAILS`                                                        | 已有        | 超级管理员             |
| `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`                                  | 已有        | Google 登录            |
| `SITE_EXPORT_TOKEN`                                                         | 已有        | Cloudflare 拉取文章用  |
| `PUBLIC_SITE_URL`                                                           | 已有        | 读者网站地址           |
| `CLOUDFLARE_DEPLOY_HOOK_URL`                                                | 已有        | 触发网站重建           |
| `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_PAGES_PROJECT` | 已有        | 部署进度、KV、阅读数据 |
| `CLOUDFLARE_KV_NAMESPACE_ID`                                                | 已有        | 横幅和阅读排行         |
| `GITHUB_IMAGES_REPO`                                                        | **第 1 步** | 公开图片仓库           |
| `GITHUB_DRAFTS_REPO`                                                        | **第 1 步** | 私有草稿图片仓库       |
| `GITHUB_IMAGES_TOKEN`                                                       | **第 1 步** | 读写这两个仓库         |
| `TURNSTILE_SECRET_KEY`                                                      | **第 2 步** | 投稿页人机验证         |
| `CLOUDFLARE_ANALYTICS_SITE_TAG`                                             | **第 3 步** | 阅读数据               |
| `CRON_SECRET`                                                               | **第 3 步** | 每日自动任务           |

**Cloudflare Pages**（Workers & Pages → bosstoday → Settings → Variables and Secrets）

| 变量                                                              | 状态        |
| ----------------------------------------------------------------- | ----------- |
| `CMS_URL`、`SITE_EXPORT_TOKEN`、`PUBLIC_SITE_URL`、`NODE_VERSION` | 已有        |
| KV 绑定 `BANNER`（Settings → Bindings）                           | 已有        |
| `TURNSTILE_SITE_KEY`                                              | **第 2 步** |

## 第 1 步：GitHub 图片仓库

> 图片功能还要等程序改好才能用，但现在就可以先建好仓库和令牌。

**A. 建两个仓库**（github.com 右上角 **+** → **New repository**）

1. 私有仓库：名字 `BOSS-Today-media-drafts`，选 **Private**，勾 **Add a README file**，Create。
2. 公开仓库：名字 `BOSS-Today-images`，选 **Public**，勾 **Add a README file**，Create。

**B. 打开公开仓库的 GitHub Pages**

1. 进 `BOSS-Today-images` → **Settings** → 左侧 **Pages**。
2. **Source** 选 **Deploy from a branch**，Branch 选 **main**、文件夹选 **/ (root)**，Save。
3. 一两分钟后，页面上方会显示网址，形如 `https://你的用户名.github.io/BOSS-Today-images/`。

**C. 生成令牌**

1. GitHub 右上角头像 → **Settings** → 左侧最下面 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
2. 填写：
   - Token name：`BOSS Today images`
   - Expiration：选最长（一年）。到期前要重新生成，记得在日历里提醒自己。
   - Repository access：**Only select repositories**，选上这两个仓库。
   - Permissions → Repository permissions → **Contents** 选 **Read and write**（Metadata 会自动变成 Read）。
3. 点 **Generate token**，复制那串 `github_pat_...`（只显示一次）。

**D. 填进 Vercel**

| Key                   | Value                                |
| --------------------- | ------------------------------------ |
| `GITHUB_IMAGES_REPO`  | `你的用户名/BOSS-Today-images`       |
| `GITHUB_DRAFTS_REPO`  | `你的用户名/BOSS-Today-media-drafts` |
| `GITHUB_IMAGES_TOKEN` | 刚复制的令牌                         |

不用再接 Vercel Blob。

## 第 2 步：投稿页人机验证（Turnstile）

1. dash.cloudflare.com → 左侧 **Turnstile** → **Add widget**：
   - Widget name：`BOSS Today contact`
   - Hostnames：添加 `bosstoday.pages.dev`
   - Widget Mode：**Managed**
   - Create。页面上会显示 **Site Key** 和 **Secret Key**。
2. **Site Key** → Cloudflare Pages 环境变量 `TURNSTILE_SITE_KEY`，Save。
3. **Secret Key** → Vercel 环境变量 `TURNSTILE_SECRET_KEY`，Save。

## 第 3 步：阅读数据

1. Cloudflare → Workers & Pages → bosstoday → **Metrics** → **Web Analytics** → 打开（Enable）。
2. 左侧 **Analytics & Logs** → **Web Analytics** → 点进 `bosstoday.pages.dev`。浏览器地址栏里有 `siteTag~in=` 加一串字母数字，复制这一串（不要后面的 `&`），填进 Vercel 的 `CLOUDFLARE_ANALYTICS_SITE_TAG`。
3. 右上角头像 → **My Profile** → **API Tokens** → 之前那个令牌右边 **⋯** → **Edit** → **+ Add more** → 依次选 **Account**、**Account Analytics**、**Read** → Continue to summary → Update Token。（令牌的值不变，Vercel 不用改。）
4. 打开 Mac 的"终端"，运行 `openssl rand -hex 32`，复制输出的那串，填进 Vercel 的 `CRON_SECRET`。

## 第 4 步：让 Vercel 用上新设置

Vercel → **Deployments** → 最上面那条右边 **⋯** → **Redeploy**，等它变成绿色 **Ready**。

## 第 5 步：重建读者网站并检查

1. 后台仪表盘 → **Public website** 卡片 → **Rebuild site**，等进度走完。
2. 打开 `https://bosstoday.pages.dev/contact/`，能看到投稿表单 → 第 2 步成功。
3. Cloudflare → bosstoday → **Deployments** → 最新那次的构建日志，搜 `Print editions`：
   - `PDF made`：PDF 正常；
   - `Could not make…`：把这行发给我；
   - 搜不到：还没有纸质版期刊，正常。
4. 后台仪表盘的 **Readership** 卡片不再显示 "Not set up yet" → 第 3 步成功。数据要一两天才会有。

## 第 6 步：清理 Vercel

1. **Deployments**：旧的部署逐个 **⋯** → **Delete**。**标着 Current 的不能删。**
2. **Settings** 里找 **Deployment Retention**（一般在 Security 下），全部选最短，保存。
3. 右上角头像 → **Account Settings** → **Notifications**：确认用量（Usage）提醒是打开的。

## 第 7 步：撤下测试横幅

后台 → Site → **Banner** → 清空文字 → **Save Draft** → **Publish banner now**，原因写 `remove test`。

## 遇到问题

截图发给我。界面上的名字和这里写的不一样，也截图。不要发密钥。
