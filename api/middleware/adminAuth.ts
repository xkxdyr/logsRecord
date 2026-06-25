/**
 * 管理员鉴权中间件 - 保护查询/管理类接口
 * 通过 X-Admin-Token 头校验，token 来自环境变量 ADMIN_TOKEN
 *
 * 安全要求：
 *   - 必须通过环境变量 ADMIN_TOKEN 显式配置，未配置则启动失败
 *   - token 长度至少 32 字符，避免弱令牌被暴力枚举
 *   - 比较使用 crypto.timingSafeEqual 恒定时间，规避时序侧信道
 *
 * 注意：ES module 静态 import 会导致本模块在 dotenv.config() 之前加载，
 *      因此 token 解析改为懒加载：由 app.ts 在 dotenv 之后显式调用 initAdminToken()。
 */
import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

const MIN_TOKEN_LENGTH = 32;

let cachedToken: string | null = null;

/**
 * 启动期校验并缓存 ADMIN_TOKEN。
 * 必须在 dotenv.config() 之后调用，通常由 app.ts 在初始化阶段调用。
 * 未配置 / 长度不足 / 使用弱默认值均抛错拒绝启动。
 */
export function initAdminToken(): void {
  const raw = process.env.ADMIN_TOKEN;
  if (!raw) {
    throw new Error(
      "[security] 环境变量 ADMIN_TOKEN 未配置，拒绝启动。请在 .env 或部署环境中设置长度 >= " +
        MIN_TOKEN_LENGTH +
        " 的强随机令牌。",
    );
  }
  if (raw.length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `[security] ADMIN_TOKEN 长度不足（${raw.length} < ${MIN_TOKEN_LENGTH}），拒绝启动。请使用 openssl rand -hex 32 等方式生成强随机令牌。`,
    );
  }
  // 早期版本弱默认值黑名单，防止历史习惯误用
  if (raw === "logverse-admin-dev") {
    throw new Error(
      "[security] ADMIN_TOKEN 不能使用弱默认值 'logverse-admin-dev'，请生成新的强随机令牌。",
    );
  }
  cachedToken = raw;
}

function getToken(): string {
  if (cachedToken === null) {
    // 兜底：若 app.ts 忘记调用 initAdminToken()，在首次请求时校验
    initAdminToken();
  }
  return cachedToken!;
}

export function getAdminToken(): string {
  return getToken();
}

/** 恒定时间字符串比较，规避时序侧信道 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.header("X-Admin-Token");

  if (!token) {
    res.status(401).json({
      success: false,
      error: "缺少管理员令牌，请在请求头携带 X-Admin-Token",
    });
    return;
  }

  if (!safeEqual(token, getToken())) {
    res.status(403).json({
      success: false,
      error: "无效的管理员令牌",
    });
    return;
  }

  next();
}
