/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is used for container deployments.
  output: "standalone",
  reactStrictMode: true,
};

if (process.env.NODE_ENV === "development" && process.env.ENABLE_CLOUDFLARE_DEV === "true") {
  const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

export default nextConfig;
