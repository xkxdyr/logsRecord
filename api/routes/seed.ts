/**
 * Seed route - generates realistic mock logs for demo purposes.
 */
import { Router, type Request, type Response } from 'express';
import { logService } from '../services/logService.js';
import type { IngestLogRequest, LogLevel } from '../../shared/types.js';

const router = Router();

const SERVICES = [
  'payment-service',
  'user-service',
  'order-service',
  'gateway',
  'auth-service',
  'inventory-service',
  'notification-service',
  'shipping-service',
];

interface MessageTemplate {
  level: LogLevel;
  msg: string;
  attrs?: Record<string, string>;
}

const MESSAGE_TEMPLATES: MessageTemplate[] = [
  { level: 'INFO', msg: 'Request received from client {ip}', attrs: { method: 'GET', path: '/api/v1/orders' } },
  { level: 'INFO', msg: 'User authenticated successfully', attrs: { userId: 'u_8821' } },
  { level: 'DEBUG', msg: 'Cache hit for key {key}', attrs: { key: 'user:profile:8821' } },
  { level: 'WARN', msg: 'Slow query detected, took {ms}ms', attrs: { ms: '1240' } },
  { level: 'ERROR', msg: 'Failed to connect to upstream service', attrs: { upstream: 'payment-gateway' } },
  { level: 'FATAL', msg: 'Database connection lost', attrs: { host: 'db-primary' } },
  { level: 'INFO', msg: 'Order {orderId} created', attrs: { orderId: 'ord_5521' } },
  { level: 'WARN', msg: 'Rate limit approaching threshold', attrs: { current: '95', limit: '100' } },
  { level: 'DEBUG', msg: 'Payload validation passed', attrs: { schema: 'order.create' } },
  { level: 'ERROR', msg: 'Payment declined by provider', attrs: { reason: 'insufficient_funds' } },
  { level: 'INFO', msg: 'Email notification sent', attrs: { template: 'order_confirm' } },
  { level: 'TRACE', msg: 'Entering handler {handler}', attrs: { handler: 'processOrder' } },
  { level: 'INFO', msg: 'Health check passed', attrs: { latency: '12ms' } },
  { level: 'WARN', msg: 'Deprecated API endpoint used', attrs: { endpoint: '/v1/users' } },
  { level: 'ERROR', msg: 'Timeout while calling external API', attrs: { timeout: '5000ms' } },
  { level: 'INFO', msg: 'Background job {jobId} completed', attrs: { jobId: 'job_9921' } },
  { level: 'DEBUG', msg: 'Connection pool stats', attrs: { active: '8', idle: '4' } },
  { level: 'FATAL', msg: 'Out of memory, process restarting', attrs: { rss: '1.2GB' } },
  { level: 'INFO', msg: 'Inventory updated for product {sku}', attrs: { sku: 'SKU-2210' } },
  { level: 'WARN', msg: 'Retry attempt {n} for operation', attrs: { n: '3' } },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: MessageTemplate): MessageTemplate {
  const ip = `${10 + Math.floor(Math.random() * 50)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 254)}`;
  const key = `cache:${Math.random().toString(36).slice(2, 8)}`;
  const msg = template.msg
    .replace('{ip}', ip)
    .replace('{key}', key)
    .replace('{orderId}', `ord_${Math.floor(Math.random() * 9000 + 1000)}`)
    .replace('{handler}', `handler_${Math.floor(Math.random() * 100)}`)
    .replace('{jobId}', `job_${Math.floor(Math.random() * 9000 + 1000)}`)
    .replace('{sku}', `SKU-${Math.floor(Math.random() * 9000 + 1000)}`)
    .replace('{n}', String(Math.floor(Math.random() * 5 + 1)))
    .replace('{ms}', String(Math.floor(Math.random() * 3000 + 100)))
    .replace('{current}', String(Math.floor(Math.random() * 100)))
    .replace('{limit}', '100')
    .replace('{reason}', 'insufficient_funds')
    .replace('{upstream}', 'payment-gateway')
    .replace('{host}', 'db-primary')
    .replace('{method}', 'GET')
    .replace('{path}', '/api/v1/orders')
    .replace('{userId}', `u_${Math.floor(Math.random() * 9000 + 1000)}`)
    .replace('{schema}', 'order.create')
    .replace('{template}', 'order_confirm')
    .replace('{latency}', `${Math.floor(Math.random() * 100)}ms`)
    .replace('{endpoint}', '/v1/users')
    .replace('{timeout}', '5000ms')
    .replace('{rss}', '1.2GB')
    .replace('{active}', String(Math.floor(Math.random() * 20)))
    .replace('{idle}', String(Math.floor(Math.random() * 10)));
  return { level: template.level, msg, attrs: template.attrs };
}

/**
 * POST /api/seed - generate 50 random mock logs
 */
router.post('/', (req: Request, res: Response): void => {
  try {
    const countQuery = req.query.count ? Number(req.query.count) : 50;
    const count = Number.isFinite(countQuery) && countQuery > 0 ? countQuery : 50;
    const results = [];
    for (let i = 0; i < count; i++) {
      const service = pick(SERVICES);
      const template = fillTemplate(pick(MESSAGE_TEMPLATES));
      const payload: IngestLogRequest = {
        service,
        level: template.level,
        message: template.msg,
        attributes: template.attrs,
      };
      results.push(logService.ingestLog(payload));
    }
    res.status(201).json({ success: true, data: { generated: results.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' });
  }
});

export default router;
