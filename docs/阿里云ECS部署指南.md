# 合同智能分析平台 — 阿里云 ECS 部署指南

版本：v1.0.0  
日期：2026-06-30  
适用版本：合同智能分析平台 v6+

---

## 目录

1. [概述](#1-概述)
2. [方案对比：2核4GB vs 4核8GB](#2-方案对比2核4gb-vs-4核8gb)
3. [第一步：购买云服务器](#3-第一步购买云服务器)
4. [第二步：服务器初始化](#4-第二步服务器初始化)
5. [第三步：安装基础环境](#5-第三步安装基础环境)
6. [第四步：克隆并构建项目](#6-第四步克隆并构建项目)
7. [第五步：配置环境变量](#7-第五步配置环境变量)
8. [第六步：数据库配置](#8-第六步数据库配置)
9. [第七步：Docker 容器化部署](#9-第七步docker-容器化部署)
10. [第八步：配置 Nginx 反向代理](#10-第八步配置-nginx-反向代理)
11. [第九步：配置 SSL 证书](#11-第九步配置-ssl-证书)
12. [第十步：启动服务与验证](#12-第十步启动服务与验证)
13. [第十一步：配置 DNS 解析](#13-第十一步配置-dns-解析)
14. [第十二步：监控与日志](#14-第十二步监控与日志)
15. [第十三步：日常运维](#15-第十三步日常运维)
16. [附录：完整文件清单](#16-附录完整文件清单)

---

## 1. 概述

本文档指导你在阿里云 ECS（云服务器）上部署合同智能分析平台，包含完整的前后端服务、Nginx 反向代理和 PostgreSQL 数据库。

### 1.1 平台架构（单机部署）

```text
                         ┌─────────────────────────────────────────┐
                         │           阿里云 ECS 实例                 │
                         │                                          │
   Internet ────► 443 ───┤  Nginx (反向代理 + SSL)                   │
                         │    ├── /api/ ─────► frontend:3000        │
                         │    │   (Next.js standalone)              │
                         │    └── /backend/ ─► backend:8000         │
                         │        (FastAPI + Uvicorn)               │
                         │                │                         │
                         │                ├── LibreOffice (DOC→DOCX)│
                         │                ├── PyMuPDF (PDF 解析)     │
                         │                └── 腾讯云 OCR API         │
                         │                                          │
                         │  ┌──────────────────────────────────┐    │
                         │  │ PostgreSQL 数据库 (Neon 或自建)    │    │
                         │  │  · analysis_feedback 表           │    │
                         │  │  · 运行时模型配置                   │    │
                         │  └──────────────────────────────────┘    │
                         └─────────────────────────────────────────┘
```

### 1.2 服务端口规划

| 服务 | 容器内端口 | 宿主机端口 | 外部访问 |
|------|-----------|-----------|---------|
| Nginx | 80 / 443 | 80 / 443 | ✅ 对外 |
| Frontend (Next.js) | 3000 | 127.0.0.1:3000 | ❌ 仅内部 |
| Backend (FastAPI) | 8000 | 127.0.0.1:8000 | ❌ 仅内部 |

---

## 2. 方案对比：2核4GB vs 4核8GB

### 2.1 核心差异

| 维度 | 2核4GB | 4核8GB |
|------|--------|--------|
| 月费（参考） | ¥120–180 | ¥250–380 |
| 前后端同机部署 | ✅ 需要精细调优 | ✅ 从容运行 |
| LibreOffice 转换 | ⚠️ 需开启 Swap，单任务串行 | ✅ 正常 |
| 并发分析任务数 | 1（必须串行） | 2–3 |
| 适合场景 | 个人试用 / Demo / 低并发 | 小团队内部使用 / 正式环境 |
| Docker 内存限制 | 后端 2.5G / 前端 512M | 后端 5G / 前端 1G |
| Swap | **必须** 开启 2GB | 可选 2GB（做安全缓冲） |

### 2.2 资源预算

```
2核4GB 分配：
├── 操作系统预留    ~500MB
├── Docker 守护进程  ~200MB
├── Nginx           ~50MB
├── Frontend 容器   ~300MB (限制 512MB)
├── Backend 容器    ~2.0GB (限制 2.5GB)
│   └── 其中 LibreOffice 峰值 ~800MB
├── 余量            ~400MB
└── Swap（必须）    2GB

4核8GB 分配：
├── 操作系统预留    ~500MB
├── Docker 守护进程  ~200MB
├── Nginx           ~50MB
├── Frontend 容器   ~500MB (限制 1GB)
├── Backend 容器    ~3.5GB (限制 5GB)
│   └── 其中 LibreOffice 峰值 ~800MB
├── 余量            ~3.0GB
└── Swap（可选）    2GB
```

> **⚠️ 重要**：如果选择 2核4GB，务必按照本文档的「资源限制」章节严格配置，否则 LibreOffice 转换大文件时可能导致 OOM（内存耗尽）被系统杀死。

---

## 3. 第一步：购买云服务器

### 3.1 登录阿里云

1. 打开浏览器访问 [https://ecs.console.aliyun.com](https://ecs.console.aliyun.com)
2. 登录你的阿里云账号（如无账号先注册并完成实名认证）
3. 在左侧导航栏点击「实例」，然后点击「创建实例」

### 3.2 方案 A：2核4GB（轻量应用服务器，推荐新手）

轻量应用服务器已将计算、存储和带宽打包，购买和配置更简单。

**购买路径**：[https://swas.console.aliyun.com](https://swas.console.aliyun.com) → 创建服务器

| 配置项 | 选择 |
|--------|------|
| 地域 | 选择离用户最近的（如 华东1·杭州 或 华南1·深圳） |
| 镜像类型 | 系统镜像 → **Ubuntu 22.04** |
| 套餐规格 | **2核4GB**，60GB ESSD，5Mbps 峰值带宽 |
| 时长 | 按需选择（建议先买 1 个月测试） |
| 数据盘 | 不添加（60GB 系统盘足够） |

参考价格：约 ¥120–180/月（含 5Mbps 带宽）。

### 3.3 方案 B：4核8GB（ECS 云服务器，推荐正式使用）

**购买路径**：[https://ecs.console.aliyun.com](https://ecs.console.aliyun.com) → 创建实例

#### 3.3.1 基础配置

| 配置项 | 选择 |
|--------|------|
| 付费模式 | 按量付费（测试）或 包年包月（长期） |
| 地域 | 选择离用户最近的 |
| 可用区 | 随机分配即可 |
| 实例规格 | **计算型 c7 / c8** 或 **通用型 g7 / g8** 系列 |
| vCPU | **4 核** |
| 内存 | **8 GB** |
| 架构 | **X86 计算** |

> **选型说明**：
> - `ecs.c7.xlarge`：4核8GB，计算优化，适合 CPU 密集型（LibreOffice 转换）
> - `ecs.g7.xlarge`：4核8GB，通用型，性价比更高
> - 如果预算宽裕，可以选择最新 `c8`/`g8` 系列，性能更好

#### 3.3.2 镜像配置

| 配置项 | 选择 |
|--------|------|
| 镜像类型 | 公共镜像 |
| 操作系统 | **Ubuntu 22.04 LTS 64位** |
| 镜像版本 | 选择最新的 minor 版本 |

#### 3.3.3 存储配置

| 配置项 | 选择 |
|--------|------|
| 系统盘 | **ESSD 云盘 PL0**（入门）或 **PL1**（推荐） |
| 系统盘大小 | **60 GB** |
| 是否随实例释放 | ✅ 勾选（按量付费） |
| 数据盘 | **不添加** |

> 60GB 估算：Ubuntu ~10G + Docker ~3G + 镜像 ~3G + 日志/临时文件 ~10G → 剩余约 34GB。

#### 3.3.4 网络与安全组

| 配置项 | 选择 |
|--------|------|
| 网络 | **默认专有网络（VPC）** |
| 公网 IP | ✅ **分配公网 IPv4 地址** |
| 带宽计费 | **按固定带宽**，5 Mbps（初期） |
| 安全组 | 创建新安全组，规则见下方 ↓ |

**安全组入方向规则**：

| 优先级 | 协议 | 端口 | 源地址 | 说明 |
|--------|------|------|--------|------|
| 1 | TCP | 22 | 你的办公 IP/32 | SSH 登录（⚠️ 不要设为 0.0.0.0/0） |
| 1 | TCP | 80 | 0.0.0.0/0 | HTTP |
| 1 | TCP | 443 | 0.0.0.0/0 | HTTPS |

> **安全提醒**：SSH 22 端口**强烈建议**只对你的办公网络 IP 开放。如果需要从多处登录，事后可以使用跳板机或 VPN。

#### 3.3.5 登录凭证

| 配置项 | 选择 |
|--------|------|
| 登录凭证 | **密钥对**（推荐，更安全） |
| 密钥对名称 | 如 `contract-analyzer-key` → **立即创建并下载 .pem 文件** |

> **⚠️ 密钥文件（.pem）只在创建时能下载一次，务必保存好。**

如果选择「自定义密码」：
- 密码须包含大小写字母、数字、特殊字符
- 长度 8–30 位

#### 3.3.6 确认下单

1. 检查右侧「配置费用」预估
2. 设置「实例名称」为 `contract-analyzer-prod`
3. 勾选「同意服务条款」
4. 点击「确认下单」→ 完成支付

### 3.4 获取服务器信息

创建完成后，在 ECS 控制台记下：

```text
实例 ID        ：i-xxxxxxxxxxxxx
公网 IP        ：xxx.xxx.xxx.xxx
内网 IP        ：172.16.x.x
操作系统        ：Ubuntu 22.04
```

---

## 4. 第二步：服务器初始化

### 4.1 SSH 登录

```bash
# 如果用密钥对登录（替换为你的 .pem 文件路径）
chmod 400 ~/Downloads/contract-analyzer-key.pem
ssh -i ~/Downloads/contract-analyzer-key.pem root@你的公网IP

# 如果用密码登录
ssh root@你的公网IP
```

### 4.2 基础配置（两个方案通用）

```bash
# 1. 更新系统
apt update && apt upgrade -y

# 2. 设置时区为中国时区
timedatectl set-timezone Asia/Shanghai

# 3. 设置主机名
hostnamectl set-hostname contract-analyzer

# 4. 确认时区和时间
date
# 输出应包含 CST 字样
```

### 4.3 创建非 root 用户（安全最佳实践）

```bash
# 创建用户（使用密钥）
useradd -m -s /bin/bash deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# 添加 sudo 权限
usermod -aG sudo deploy

# 验证
su - deploy
sudo whoami
# 应输出 root，表示 sudo 权限正常
exit
```

### 4.4 配置 Swap（两个方案都必须）

#### 方案 A：2核4GB — **必须** 配置 2GB Swap

在 2核4GB 上，LibreOffice 单次转换就可能消耗 800MB+，没有 Swap 会直接 OOM。

```bash
# 创建 2GB 的 Swap 文件
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# 写入 fstab 持久化
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 验证
free -h
swapon --show
```

#### 方案 B：4核8GB — 推荐配置 2GB Swap（安全缓冲）

```bash
# 同上操作，作为安全缓冲
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 降低 swappiness 值，优先使用物理内存
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf
```

### 4.5 配置防火墙（UFW）

```bash
# 安装 UFW
apt install ufw -y

# 默认策略：拒绝入站，允许出站
ufw default deny incoming
ufw default allow outgoing

# 开放必要端口
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS

# 启用防火墙
ufw enable
ufw status verbose
```

---

## 5. 第三步：安装基础环境

以下步骤**两个方案通用**，以 `deploy` 用户执行（需要 `sudo`）。

### 5.1 安装 Docker

```bash
# 卸载旧版本（如果存在）
sudo apt remove docker docker-engine docker.io containerd runc -y

# 安装依赖
sudo apt install ca-certificates curl gnupg lsb-release -y

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 添加 Docker 稳定版仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

# 将 deploy 用户加入 docker 组（免 sudo 执行）
sudo usermod -aG docker deploy

# 重新登录生效
exit
ssh deploy@你的公网IP

# 验证
docker --version
docker run hello-world
```

### 5.2 安装 Docker Compose

Docker Compose 已作为 Docker 插件安装，使用 `docker compose`（注意中间是空格，不是连字符）。

```bash
docker compose version
# 应输出 Docker Compose version v2.x.x
```

### 5.3 安装 Git 和基础工具

```bash
sudo apt install git curl wget vim htop -y
```

---

## 6. 第四步：克隆并构建项目

### 6.1 创建项目目录

```bash
# 创建应用目录
sudo mkdir -p /opt/contract-analyzer
sudo chown deploy:deploy /opt/contract-analyzer
cd /opt/contract-analyzer

# 构建镜像的工作目录
mkdir -p builds
```

### 6.2 上传项目代码

由于后端含 LibreOffice、PyMuPDF 等重量依赖，**不建议在服务器上构建后端镜像**（构建过程会安装大量依赖，内存需求高）。推荐在本地构建并推送镜像，或在服务器上使用 Docker Hub / 阿里云容器镜像服务。

#### 方式一：本地构建 + 推送镜像（推荐）

在本地 Windows/Mac 机器上：

```bash
# === 后端镜像 ===
cd backend
docker build -t contract-analyzer-backend:v6 .
docker tag contract-analyzer-backend:v6 your-registry/contract-analyzer-backend:v6
docker push your-registry/contract-analyzer-backend:v6

# === 前端镜像 ===
cd ../frontend
docker build -t contract-analyzer-frontend:v2 .
docker tag contract-analyzer-frontend:v2 your-registry/contract-analyzer-frontend:v2
docker push your-registry/contract-analyzer-frontend:v2
```

> 如果没有私有镜像仓库，可以用 **阿里云容器镜像服务**（免费个人版）：
> 1. 登录 [https://cr.console.aliyun.com](https://cr.console.aliyun.com)
> 2. 创建命名空间（如 `contract-analyzer`）
> 3. 创建仓库（`backend`、`frontend`）
> 4. 按照控制台指引登录并 push

#### 方式二：Git 拉取 + 服务器构建（备选）

```bash
# 从 Git 仓库拉取（替换为你的仓库地址）
cd /opt/contract-analyzer
git clone https://github.com/your-org/contract-analyzer.git src
cd src

# ====== 构建后端镜像 ======
cd backend
# 为节省服务器内存，使用 --memory 限制构建过程
docker build --memory=2g -t contract-analyzer-backend:v6 .
cd ..

# ====== 构建前端镜像 ======
cd frontend
docker build -t contract-analyzer-frontend:v2 .
cd ..
```

> ⚠️ 在 2核4GB 服务器上构建后端镜像，必须加 `--memory=2g` 限制，否则构建阶段可能耗尽系统内存。

---

## 7. 第五步：配置环境变量

### 7.1 创建环境变量文件

在服务器上创建 `/opt/contract-analyzer/.env`：

```bash
cd /opt/contract-analyzer
vim .env
```

填入以下内容（替换 `xxx` 为实际值）：

```bash
# ====== LLM 模型配置 ======
# 必填：LLM API Key（推荐使用 DeepSeek，性价比高）
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# 必填：LLM API 地址
OPENAI_BASE_URL=https://api.deepseek.com/v1
# 必填：模型名称
OPENAI_MODEL=deepseek-chat
# 可选：演示模式（模型不可用时返回假数据，生产环境设为 false）
NEXT_PUBLIC_DEMO_MODE=false

# ====== 腾讯云 OCR 配置（可选，不配则跳过扫描件 OCR）======
TENCENTCLOUD_SECRET_ID=你的腾讯云SecretId
TENCENTCLOUD_SECRET_KEY=你的腾讯云SecretKey
TENCENTCLOUD_OCR_REGION=ap-guangzhou

# ====== PostgreSQL 数据库配置 ======
# 推荐使用 Neon（免费层 500MB 足够）：https://neon.tech
PG_HOST=ep-xxxx.us-east-2.aws.neon.tech
PG_PORT=5432
PG_USER=neondb_owner
PG_PASSWORD=xxxxxxxxxxxxxxxx
PG_DATABASE=neondb

# ====== 后端管理 Token（用于管理接口鉴权）======
BACKEND_ADMIN_TOKEN=生成一个随机字符串作为管理密码

# ====== 上传限制 ======
MAX_UPLOAD_MB=20
MAX_BATCH_FILES=20
```

> **生成随机 Token**：`openssl rand -hex 32`

### 7.2 设置文件权限

```bash
chmod 600 /opt/contract-analyzer/.env
```

---

## 8. 第六步：数据库配置

### 8.1 推荐：使用 Neon PostgreSQL（免费）

[Neon](https://neon.tech) 提供免费托管 PostgreSQL，无需在服务器上自建数据库：

1. 访问 [https://neon.tech](https://neon.tech) 注册
2. 创建一个 Project
3. 在 Dashboard → Connection Details 中复制连接参数
4. 填入上面 `.env` 文件的 `PG_*` 变量

### 8.2 备选：自建 PostgreSQL

如果需要自建（不推荐，增加运维负担），4核8GB 可自建，2核4GB 不建议：

```bash
# 仅适合 4核8GB 方案
sudo apt install postgresql postgresql-client -y

# 创建数据库和用户
sudo -u postgres psql <<EOF
CREATE USER contract_user WITH PASSWORD '替换为强密码';
CREATE DATABASE contract_analyzer OWNER contract_user;
GRANT ALL PRIVILEGES ON DATABASE contract_analyzer TO contract_user;
EOF

# 修改 .env 中的 PG_HOST 为 localhost, PG_PORT 为 5432
```

### 8.3 初始化数据库表

```bash
cd /opt/contract-analyzer/src/frontend

# 使用 psql 连接数据库并建表
psql "postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DATABASE" <<EOF
CREATE TABLE IF NOT EXISTS analysis_feedback (
    id            VARCHAR(32) PRIMARY KEY,
    "contractId"  VARCHAR(64) NOT NULL,
    "contractName" VARCHAR(256),
    "userId"      VARCHAR(64),
    category      VARCHAR(32) NOT NULL,
    rating        INTEGER NOT NULL,
    comment       TEXT,
    "contractText" TEXT,
    metadata      JSONB,
    status        VARCHAR(16) DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_feedback_contract_id ON analysis_feedback ("contractId");
CREATE INDEX IF NOT EXISTS idx_feedback_category   ON analysis_feedback (category);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at  ON analysis_feedback (created_at DESC);
EOF
```

验证：

```bash
psql "postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DATABASE" -c "\dt"
```

---

## 9. 第七步：Docker 容器化部署

### 9.1 创建 docker-compose.yml

```bash
cd /opt/contract-analyzer
vim docker-compose.yml
```

#### 方案 A：2核4GB 版本（严格资源限制）

```yaml
version: "3.8"

services:
  # ====== 后端服务 ======
  backend:
    image: contract-analyzer-backend:v6
    container_name: ca-backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000"
    env_file:
      - .env
    environment:
      - OPENAI_API_KEY
      - OPENAI_BASE_URL
      - OPENAI_MODEL
      - TENCENTCLOUD_SECRET_ID
      - TENCENTCLOUD_SECRET_KEY
      - TENCENTCLOUD_OCR_REGION
      - BACKEND_ADMIN_TOKEN
      - MAX_UPLOAD_MB=20
      - MAX_BATCH_FILES=20
    volumes:
      - backend_uploads:/app/tmp/uploads
      - /opt/contract-analyzer/data:/app/data
    # ====== 2核4GB 关键配置：严格内存和 CPU 限制 ======
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 2500M
        reservations:
          cpus: "1.0"
          memory: 1500M
    # 启动 Uvicorn，单 worker
    command:
      [
        "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--workers", "1",
        "--limit-concurrency", "5",
        "--timeout-keep-alive", "30"
      ]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ====== 前端服务 ======
  frontend:
    image: contract-analyzer-frontend:v2
    container_name: ca-frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      - OPENAI_API_KEY
      - OPENAI_BASE_URL
      - OPENAI_MODEL
      - PG_HOST
      - PG_PORT
      - PG_USER
      - PG_PASSWORD
      - PG_DATABASE
      - NEXT_PUBLIC_DEMO_MODE
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode===200?0:1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

volumes:
  backend_uploads:
```

#### 方案 B：4核8GB 版本（从容配置）

```yaml
version: "3.8"

services:
  # ====== 后端服务 ======
  backend:
    image: contract-analyzer-backend:v6
    container_name: ca-backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000"
    env_file:
      - .env
    environment:
      - OPENAI_API_KEY
      - OPENAI_BASE_URL
      - OPENAI_MODEL
      - TENCENTCLOUD_SECRET_ID
      - TENCENTCLOUD_SECRET_KEY
      - TENCENTCLOUD_OCR_REGION
      - BACKEND_ADMIN_TOKEN
      - MAX_UPLOAD_MB=20
      - MAX_BATCH_FILES=20
    volumes:
      - backend_uploads:/app/tmp/uploads
      - /opt/contract-analyzer/data:/app/data
    # ====== 4核8GB：从容配置 ======
    deploy:
      resources:
        limits:
          cpus: "3.0"
          memory: 5000M
        reservations:
          cpus: "2.0"
          memory: 3000M
    # 启动 Uvicorn，2 worker，利用多核
    command:
      [
        "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--workers", "2",
        "--limit-concurrency", "10",
        "--timeout-keep-alive", "30"
      ]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ====== 前端服务 ======
  frontend:
    image: contract-analyzer-frontend:v2
    container_name: ca-frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      - OPENAI_API_KEY
      - OPENAI_BASE_URL
      - OPENAI_MODEL
      - PG_HOST
      - PG_PORT
      - PG_USER
      - PG_PASSWORD
      - PG_DATABASE
      - NEXT_PUBLIC_DEMO_MODE
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1024M
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode===200?0:1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

volumes:
  backend_uploads:
```

### 9.2 创建数据目录

```bash
mkdir -p /opt/contract-analyzer/data
```

### 9.3 在服务器上拉取/加载镜像

#### 方式一：从镜像仓库拉取

```bash
# 登录阿里云容器镜像服务
docker login --username=你的阿里云账号 registry.cn-hangzhou.aliyuncs.com

# 拉取镜像
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/backend:v6
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/frontend:v2

# 打本地标签
docker tag registry.cn-hangzhou.aliyuncs.com/你的命名空间/backend:v6 contract-analyzer-backend:v6
docker tag registry.cn-hangzhou.aliyuncs.com/你的命名空间/frontend:v2 contract-analyzer-frontend:v2
```

#### 方式二：本地导出 → 服务器导入（没有镜像仓库时）

在本地机器上：

```bash
# 导出镜像为 tar 文件
docker save contract-analyzer-backend:v6 -o backend-v6.tar
docker save contract-analyzer-frontend:v2 -o frontend-v2.tar

# 上传到服务器
scp backend-v6.tar frontend-v2.tar deploy@你的公网IP:/opt/contract-analyzer/
```

在服务器上：

```bash
docker load -i /opt/contract-analyzer/backend-v6.tar
docker load -i /opt/contract-analyzer/frontend-v2.tar
```

### 9.4 启动服务

```bash
cd /opt/contract-analyzer

# 启动（后台运行）
docker compose up -d

# 查看启动状态
docker compose ps

# 查看日志（确认没有错误）
docker compose logs -f --tail=50
```

---

## 10. 第八步：配置 Nginx 反向代理

### 10.1 安装 Nginx

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
```

### 10.2 创建 Nginx 配置文件

```bash
sudo vim /etc/nginx/sites-available/contract-analyzer
```

填入以下内容（替换 `your-domain.com` 为你的域名或公网 IP）：

```nginx
# ====== HTTP → HTTPS 重定向 ======
server {
    listen 80;
    server_name your-domain.com;

    # 临时 ACME 验证用
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # 其余请求重定向到 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# ====== HTTPS 主配置 ======
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # ---- SSL 证书（先注释，配好证书后取消注释）----
    # ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    # ssl_protocols       TLSv1.2 TLSv1.3;
    # ssl_ciphers         HIGH:!aNULL:!MD5;

    # ---- 安全头 ----
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # ---- 上传大小限制 ----
    client_max_body_size 30M;

    # ---- 前端页面 ----
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # ---- 后端 API ----
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # ---- 健康检查端点（不记录日志）----
    location /api/health {
        proxy_pass http://127.0.0.1:8000/api/health;
        access_log off;
    }
}
```

> **暂时保持 SSL 证书部分注释**，先验证 HTTP 访问正常，再去配 HTTPS。

### 10.3 启用站点并重启 Nginx

```bash
# 创建符号链接启用站点
sudo ln -s /etc/nginx/sites-available/contract-analyzer /etc/nginx/sites-enabled/

# 删除默认站点（避免冲突）
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置语法
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 10.4 验证 HTTP 访问

在浏览器访问 `http://你的公网IP` 或 `http://your-domain.com`，应能看到合同分析平台页面。

---

## 11. 第九步：配置 SSL 证书

### 11.1 安装 Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 11.2 申请证书（HTTP 验证方式）

```bash
# 先确保域名 DNS 已解析到服务器 IP
# 然后执行：

sudo certbot --nginx -d your-domain.com
```

交互流程：

1. 输入邮箱（用于证书到期提醒）
2. 同意服务条款（输入 Y）
3. 是否接收推广邮件（输入 N）

### 11.3 验证自动续期

```bash
# 测试续期流程
sudo certbot renew --dry-run

# 确认定时任务已创建
sudo systemctl status certbot.timer
```

### 11.4 取消注释 SSL 配置

Certbot 会自动修改 Nginx 配置添加 SSL，但建议手动检查：

```bash
sudo vim /etc/nginx/sites-available/contract-analyzer
```

确认 SSL 相关行已正确解除注释并指向正确的证书路径。

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 11.5 验证 HTTPS 访问

在浏览器访问 `https://your-domain.com`，应看到安全锁标志。

---

## 12. 第十步：启动服务与验证

### 12.1 检查 Docker 容器

```bash
docker compose -f /opt/contract-analyzer/docker-compose.yml ps
```

预期输出（两个容器均为 `Up` 且 `healthy`）：

```
NAME          STATUS                    PORTS
ca-backend    Up 20 seconds (healthy)   127.0.0.1:8000->8000/tcp
ca-frontend   Up 20 seconds (healthy)   127.0.0.1:3000->3000/tcp
```

### 12.2 功能验证清单

| 编号 | 验证项 | 操作 | 预期结果 |
|------|--------|------|----------|
| V-01 | 前端页面 | 浏览器访问 `https://域名` | 显示合同分析工作台 |
| V-02 | 健康检查 | `curl https://域名/api/health` | 返回 `{"ok":true,"service":"contract-analyzer-backend","version":"v6.0.0"}` |
| V-03 | DOCX 上传分析 | 上传一份 DOCX 合同，点击开始分析 | 正常提取文本并返回分析结果 |
| V-04 | DOC 转换 | 上传一份 DOC 格式合同 | LibreOffice 转换 → 正常分析 |
| V-05 | PDF 解析 | 上传一份 PDF 合同 | PyMuPDF 提取文本 → 正常分析 |
| V-06 | Excel 导出 | 分析完成后点击导出 | 下载包含分析结果的 Excel |
| V-07 | 反馈提交 | 对分析结果评分/评论 | 数据写入 PostgreSQL |
| V-08 | 反馈查询 | 切换到云端总览 Tab | 显示已提交的反馈列表 |

### 12.3 查看资源使用（关键）

```bash
# 实时查看 CPU 和内存
docker stats ca-backend ca-frontend

# 查看系统总体资源
htop
```

**2核4GB 特别注意**：上传一份 DOC 格式合同后观察内存峰值，如果 `ca-backend` 内存接近 2500M 限制，说明 Docker limit 生效了，Swap 在兜底。

### 12.4 压力测试（可选）

```bash
# 连续上传 5 份合同，观察稳定性
# 在 2核4GB 上，应能完成串行处理（稍慢但不应崩溃）
# 在 4核8GB 上，应流畅完成
```

---

## 13. 第十一步：配置 DNS 解析

### 13.1 获取服务器公网 IP

```bash
curl ifconfig.me
```

### 13.2 在域名管理后台添加 A 记录

以阿里云 DNS 为例：

| 记录类型 | 主机记录 | 记录值 | TTL |
|----------|----------|--------|-----|
| A | @ | 你的公网 IP | 600 |
| A | www | 你的公网 IP | 600 |

> 如果用 `contract.your-company.com`，主机记录填 `contract`。

### 13.3 验证 DNS 生效

```bash
# 替换为你的域名
nslookup your-domain.com
# 应返回你的公网 IP
```

---

## 14. 第十二步：监控与日志

### 14.1 Docker 容器日志

```bash
# 查看后端日志
docker logs -f ca-backend --tail=100

# 查看前端日志
docker logs -f ca-frontend --tail=100

# 日志持久化（写入文件）
docker logs -f ca-backend --tail=0 >> /var/log/ca-backend.log 2>&1 &
```

### 14.2 日志轮转（防止磁盘占满）

创建 Docker 日志轮转配置：

```bash
sudo vim /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

```bash
sudo systemctl restart docker
cd /opt/contract-analyzer && docker compose up -d
```

### 14.3 设置 CPU/内存告警（4核8GB 推荐）

#### 使用阿里云云监控（免费）

1. 登录 [https://cms.console.aliyun.com](https://cms.console.aliyun.com)
2. 创建报警规则：
   - **CPU 使用率 > 80%** 持续 5 分钟 → 短信/邮件通知
   - **内存使用率 > 85%** 持续 5 分钟 → 短信/邮件通知
   - **磁盘使用率 > 80%** → 短信/邮件通知

#### 使用轻量脚本监控（2核4GB 推荐）

```bash
# 创建监控脚本
cat > /opt/contract-analyzer/monitor.sh << 'SCRIPT'
#!/bin/bash
THRESHOLD=90
MEM_USAGE=$(free | awk '/Mem/{printf("%.0f", $3/$2*100)}')
if [ "$MEM_USAGE" -gt "$THRESHOLD" ]; then
  echo "[$(date)] WARNING: Memory usage at ${MEM_USAGE}%" >> /var/log/ca-monitor.log
  # 可选：发送钉钉/企业微信告警
fi
SCRIPT

chmod +x /opt/contract-analyzer/monitor.sh

# 添加到 crontab（每5分钟检查）
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/contract-analyzer/monitor.sh") | crontab -
```

### 14.4 Nginx 访问日志

```bash
# 查看最近的访问
sudo tail -f /var/log/nginx/access.log

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

---

## 15. 第十三步：日常运维

### 15.1 常用运维命令速查

```bash
# ==== 服务管理 ====
cd /opt/contract-analyzer
docker compose up -d              # 启动所有服务
docker compose down               # 停止所有服务
docker compose restart            # 重启所有服务
docker compose ps                 # 查看服务状态

# ==== 查看资源 ====
docker stats                      # 实时资源使用
free -h                           # 系统内存
df -h                             # 磁盘使用

# ==== 更新镜像 ====
docker compose pull               # 拉取最新镜像
docker compose up -d --force-recreate  # 重建容器

# ==== 清理 ====
docker system prune -a -f         # 清理无用镜像和容器（谨慎）
docker volume prune -f            # 清理无用数据卷

# ==== 紧急恢复 ====
# 如果服务挂了，自动重启（已配置 restart: unless-stopped）
# 如果还是挂了：
docker compose down && docker compose up -d
```

### 15.2 定期维护清单

| 频率 | 操作 |
|------|------|
| **每天** | 看一眼 `docker compose ps`，确认两个容器健康 |
| **每周** | 检查 `df -h` 确认磁盘未满；查看日志有无异常 |
| **每月** | `apt update && apt upgrade` 系统安全更新；SSL 证书自动续期（certbot）确认 |
| **按需** | 清理 Docker 无用镜像（`docker system prune`） |

### 15.3 备份策略

#### PostgreSQL 备份（如果使用 Neon 等云数据库，平台自动备份，无需操作）

#### 上传文件备份

```bash
# optional: 定期备份上传临时目录中的文件
tar -czf /opt/backups/uploads-$(date +%Y%m%d).tar.gz \
  /var/lib/docker/volumes/contract-analyzer_backend_uploads/_data/
```

#### 配置文件备份

```bash
tar -czf /opt/backups/config-$(date +%Y%m%d).tar.gz \
  /opt/contract-analyzer/.env \
  /opt/contract-analyzer/docker-compose.yml \
  /etc/nginx/sites-available/contract-analyzer
```

---

## 16. 附录：完整文件清单

部署完成后，以下是你服务器上的关键文件：

```text
/opt/contract-analyzer/
├── .env                          ← 环境变量（机密）
├── docker-compose.yml            ← 容器编排配置
├── data/                         ← 运行时数据（模型配置等）
├── monitor.sh                    ← 内存监控脚本
└── builds/                       ← 镜像 tar 文件（可删除）

/etc/nginx/sites-available/
└── contract-analyzer             ← Nginx 站点配置

/etc/nginx/sites-enabled/
└── contract-analyzer → ../sites-available/contract-analyzer

/etc/letsencrypt/live/你的域名/
├── fullchain.pem                 ← SSL 证书
└── privkey.pem                   ← SSL 私钥

/var/lib/docker/volumes/
└── contract-analyzer_backend_uploads/_data/  ← 上传文件临时目录
```

---

## 附录 A：2核4GB 专属注意事项

| # | 注意事项 | 详细说明 |
|---|---------|---------|
| 1 | **串行处理** | `docker-compose.yml` 中必须设 `workers=1`，避免并发 LibreOffice 转换导致 OOM |
| 2 | **不运行其他服务** | 这台机器专用于合同分析平台，不要再装数据库、Redis 等 |
| 3 | **Swap 是生命线** | 不配 Swap 不可上线，LibreOffice 峰值内存 + PyMuPDF 渲染会接近 2.5G |
| 4 | **监控内存** | 建议配置内存告警，当使用率 > 85% 时通知 |
| 5 | **文件上传限制** | 后端 max_upload_mb=20，Nginx client_max_body_size=30M |
| 6 | **不要在服务器上构建镜像** | 后端构建过程会消耗大量内存，在本地构建后 push/pull |

## 附录 B：常见问题排查

### 问题 1：容器反复重启

```bash
docker logs ca-backend --tail=50
```

常见原因：
- 环境变量未配置或拼写错误
- PostgreSQL 连接失败（检查 PG_HOST/PG_PORT 等）
- LibreOffice 未找到（检查 Dockerfile 是否正确安装）

### 问题 2：DOC 转换失败

```bash
# 进容器确认 LibreOffice 是否可用
docker exec -it ca-backend libreoffice --version
# 应输出版本号

# 手动测试转换
docker exec -it ca-backend libreoffice --headless --convert-to docx /path/to/test.doc --outdir /tmp/
```

### 问题 3：内存不足（2核4GB）

症状：`ca-backend` 容器状态为 `exited (137)`，137 是 OOMKilled。

解决：
1. 确认 Swap 已启用：`free -h`
2. 确认 `docker-compose.yml` 中 backend memory limit 为 `2500M`
3. 如果仍频繁 OOM，考虑升级到 4核8GB

### 问题 4：SSL 证书过期

```bash
# 手动续期
sudo certbot renew

# 查看证书到期时间
sudo certbot certificates
```

### 问题 5：磁盘空间不足

```bash
# 检查占用
du -sh /var/lib/docker/*
du -sh /var/log/*

# 清理 Docker
docker system prune -a -f

# 清理旧日志
sudo journalctl --vacuum-size=200M
```

---

> **文档维护**：此文档适用于合同智能分析平台 v6+。架构或部署方式变更时请同步更新。
