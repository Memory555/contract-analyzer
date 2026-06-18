# Cloudflare 部署说明

本项目的前端是 Next.js App Router 应用，并包含 `/api/analyze` 和 `/api/model-test` 两个服务端接口。因此 Cloudflare 部署建议使用 **Cloudflare Workers + OpenNext**，而不是纯静态 Pages。

## 已完成的代码适配

- `frontend/package.json`：新增 `cf:build`、`cf:preview`、`cf:deploy`、`cf:upload`、`cf:typegen` 脚本。
- `frontend/wrangler.jsonc`：新增 Cloudflare Worker 配置，启用 `nodejs_compat`。
- `frontend/open-next.config.ts`：新增 OpenNext Cloudflare 适配配置。
- `frontend/public/_headers`：为 Next.js 静态资源增加长期缓存头。
- `frontend/next.config.mjs`：接入 OpenNext 本地开发初始化。
- `frontend/.gitignore` 和根目录 `.gitignore`：忽略 `.open-next/` 构建产物。

## 本地预检

进入前端目录：

```bash
cd frontend
npm install
npm run build
npm run cf:build
```

本地模拟 Cloudflare Workers 运行环境：

```bash
npm run cf:preview
```

如果只需要常规本地开发，继续使用：

```bash
npm run dev
```

## Cloudflare 控制台配置流程

1. 登录 Cloudflare Dashboard。
2. 进入 `Workers & Pages`。
3. 选择 `Create`。
4. 选择 `Import a repository`，连接当前 Git 仓库。
5. 项目类型选择 Workers 或支持 Workers 构建的 Next.js/OpenNext 配置。
6. Root directory 填：

```text
frontend
```

7. Build command 填：

```bash
npm run cf:build
```

8. Deploy command 如控制台要求单独填写，可填：

```bash
npx wrangler deploy
```

如果控制台只提供一个构建命令入口，可使用：

```bash
npm run cf:deploy
```

9. Output directory 通常不需要手动填写；OpenNext 会根据 `wrangler.jsonc` 使用 `.open-next/worker.js` 和 `.open-next/assets`。

## 环境变量

在 Cloudflare 项目的 `Settings -> Variables and Secrets` 中配置：

```text
OPENAI_API_KEY=你的模型服务 Key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_DEMO_MODE=true
```

建议：

- `OPENAI_API_KEY` 使用 Secret 类型，不要提交到代码仓库。
- 如果使用第三方 OpenAI 兼容服务，把 `OPENAI_BASE_URL` 改为对应服务地址。
- `NEXT_PUBLIC_DEMO_MODE` 是公开变量，不要放敏感信息。

## 命令行部署

首次部署前登录 Cloudflare：

```bash
npx wrangler login
```

部署：

```bash
cd frontend
npm run cf:deploy
```

部署完成后，Cloudflare 会返回 `*.workers.dev` 地址。后续如果要绑定自定义域名，在项目的 `Settings -> Domains & Routes` 中添加域名或路由。

## 自定义域名

1. 确认域名已经托管在 Cloudflare，或至少 DNS 可由 Cloudflare 管理。
2. 进入 Worker 项目的 `Settings -> Domains & Routes`。
3. 添加自定义域名，例如：

```text
contract.example.com
```

4. 等待证书签发完成。
5. 访问自定义域名，测试首页、DOCX 上传、模型连通性和分析接口。

## 发布后验证

建议逐项验证：

- 首页能正常打开。
- Logo 和样式资源能正常加载。
- 上传 DOCX 后能提取文本。
- 未配置 API Key 时提示明确。
- 配置 API Key 后，`模型服务联通测试` 能返回成功。
- 合同分析接口能返回付款计划、质保明细和问题提示。

## 常见问题

### 只用 Cloudflare Pages 可以吗？

不建议。本项目有服务端 API Route，需要运行 Next.js 服务端逻辑。纯静态 Pages 无法直接承载这些接口。

### Vercel 部署会受影响吗？

不会。`vercel.json` 和原有 `npm run build` 保持不变，Cloudflare 相关配置是新增路径。

### Windows 本地构建失败怎么办？

OpenNext 官方说明中提到 Windows 支持不如 Linux/macOS 稳定。如果本地 `npm run cf:build` 异常，建议优先让 Cloudflare 的 Linux 构建环境执行，或在 WSL 中预检。
