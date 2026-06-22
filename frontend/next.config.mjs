import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 模式用于 CloudBase 容器部署；Vercel 和 Cloudflare 构建流程不依赖此产物，不受影响
  output: "standalone",
  reactStrictMode: true
};

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

export default nextConfig;
