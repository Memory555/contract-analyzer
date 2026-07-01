FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# pip 使用阿里云镜像
ENV PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ENV PIP_TRUSTED_HOST=mirrors.aliyun.com

WORKDIR /app

# 替换 apt 源为阿里云镜像（兼容 Bookworm 和 Trixie 两种格式）
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
      sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi && \
    if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
      sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi

# 安装系统依赖（分两步：先装小包，再装大包，便于重试和缓存）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      poppler-utils \
      libmagic1 \
      fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# LibreOffice 单独装（包很大，加 --fix-missing 防止偶发断连）
RUN apt-get update && \
    apt-get install -y --no-install-recommends --fix-missing \
      libreoffice \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
