import type { Request, Response, NextFunction } from "express";

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // P2-11: X-XSS-Protection 设为 0，现代浏览器已废弃，旧 IE 的 Auditor 反而可引入信息泄露
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // P2-12: 生产环境移除 unsafe-eval（Vite 开发模式需要，生产构建不需要）
  // P1-9: script-src 不应放行 fonts.googleapis.com（字体走 style-src 即可，避免 JSONP 滥用）
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = isProd
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  // P1-10: CSP Level 3 中 'self' 不自动覆盖 ws:/wss: scheme，需显式放行
  //   - 生产：wss: 同源 WebSocket
  //   - 开发：ws: localhost Vite 代理
  const connectSrc = isProd ? "'self' wss:" : "'self' ws: wss:";
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src ${connectSrc}; object-src 'none'; frame-src 'none';`,
  );
  next();
}
