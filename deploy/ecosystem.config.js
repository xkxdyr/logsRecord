/**
 * PM2 进程管理配置
 *
 * 后端：用 tsx 直接运行 TypeScript 源码（tsx 已在 dependencies，生产安装不缺失）
 * 前端：由 Nginx 直接托管 dist/ 静态产物（见 nginx.conf）
 *       不再使用 vite preview，原因：
 *       1. vite preview 是为本地预览构建产物设计，非生产级静态服务器
 *       2. 多一个 Node 进程增加内存占用与故障面
 *       3. nginx 直接 root dist/ 性能更好，且能统一管理 gzip/缓存/安全头
 *
 * 部署流程：
 *   1. npm run build         # 生成 dist/
 *   2. pm2 start ecosystem.config.js --env production
 *   3. nginx -t && systemctl reload nginx   # nginx 指向 /opt/logverse/dist
 */
module.exports = {
  apps: [
    {
      name: 'logverse-server',
      script: 'api/server.ts',
      interpreter: './node_modules/.bin/tsx',
      cwd: '/opt/logverse',
      env: {
        NODE_ENV: 'production',
        PORT: 1001,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // 崩溃后退避重启，避免快速循环
      restart_delay: 5000,
      max_restarts: 20,
    },
  ],
};
