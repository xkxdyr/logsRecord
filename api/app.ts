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
import { securityHeaders } from './middleware/security.js'

// load env
dotenv.config()

// initialize database
initDb()

const app: express.Application = express()

app.use(securityHeaders)
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/logs', logsRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/services', servicesRoutes)
app.use('/api/seed', seedRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
