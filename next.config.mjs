const isAppBuild = process.env.BUILD_TARGET === "app";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(isAppBuild && {
    // Capacitor 静态导出（hackathon-plan §6.2）：
    // 构建 App 包时先临时挪走 app/api 代理路由（见 package.json build:app 脚本）
    output: "export",
    images: { unoptimized: true },
  }),
};

export default nextConfig;
