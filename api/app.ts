/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { initDb } from './db.js'
import logsRoutes from './routes/logs.js'
import statsRoutes from './routes/stats.js'
import servicesRoutes from './routes/services.js'
import seedRoutes from './routes/seed.js'
import retentionRoutes from './routes/retention.js'
import { securityHeaders } from './middleware/security.js'
import { startRetentionJob, stopRetentionJob } from './services/retentionService.js'
import { initAdminToken } from './middleware/adminAuth.js'

// load env
dotenv.config()

// 启动期安全校验：ADMIN_TOKEN 必须显式配置且强度足够，否则拒绝启动
initAdminToken()

// initialize database
initDb()

const app: express.Application = express()

app.use(securityHeaders)

// CORS 收敛：仅允许配置的来源，开发环境默认放行本地
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    // 允许同源请求（无 Origin 头，如 curl/Postman）和已配置来源
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true)
    } else {
      cb(new Error(`Origin ${origin} not allowed by CORS`))
    }
  },
  credentials: true,
}
app.use(cors(corsOptions))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/logs', logsRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/services', servicesRoutes)
app.use('/api/seed', seedRoutes)
app.use('/api/retention', retentionRoutes)

/**
 * health
 * P2-10: 用 app.get 限定仅 GET 方法，避免 app.use 匹配所有方法与子路径
 */
app.get(
  '/api/health',
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * 404 handler
 * P1-5: 404 必须在错误处理中间件之前注册（Express 约定错误处理为最后一个中间件）
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

/**
 * error handler middleware - 记录错误详情便于排查
 * P1-2: 透传 body-parser / cors 等中间件的 status（400/413 等），避免一律 500
 */
app.use((error: Error & { status?: number; statusCode?: number }, req: Request, res: Response, _next: NextFunction) => {
  const status = error.status || error.statusCode || 500
  console.error('[server] 未捕获错误:', {
    method: req.method,
    path: req.path,
    status,
    message: error.message,
    ...(status >= 500 ? { stack: error.stack } : null),
  })
  res.status(status).json({
    success: false,
    error: status >= 500 ? 'Server internal error' : error.message,
  })
})

// Vercel serverless 环境适配：
//   - setInterval 在函数实例冻结时不执行，且每次冷启动都会重复触发 runCleanup
//   - SIGTERM/SIGINT 在 serverless 不会被发送
//   仅在非 Vercel 环境（本地 / PM2 / 自建服务器）启动定时任务与信号处理
// P2-Vercel-1: 统一检测逻辑，与 db.ts 保持一致
const isServerless = !!(process.env.VERCEL || process.env.VERCEL_ENV)

if (!isServerless) {
  // 启动保留策略定时任务
  startRetentionJob()

  // 进程退出时停止定时任务
  process.on('SIGTERM', () => stopRetentionJob())
  process.on('SIGINT', () => stopRetentionJob())
} else {
  // Vercel 环境：仅执行一次清理（冷启动时），不注册定时器与信号处理
  // 注意：/tmp 在实例间不共享，仅适合 demo；生产应换外部数据库
  console.log('[app] serverless 环境检测到，跳过定时任务与信号处理注册')
}

export default app
