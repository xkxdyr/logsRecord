/**
 * 请求校验工具
 */
import type { Request, Response, NextFunction } from 'express';
import { LEVELS } from '../../shared/types.js';
import type { LogLevel } from '../../shared/types.js';

const MAX_MESSAGE_LENGTH = 16 * 1024; // 16KB
const MAX_ATTR_KEY_LENGTH = 256;
const MAX_ATTR_VALUE_LENGTH = 8 * 1024;
const MAX_ATTR_COUNT = 100;
const MAX_BATCH_SIZE = 1000;
const MAX_SERVICE_LENGTH = 256;

const VALID_LEVEL_SET = new Set<string>(LEVELS);

export function isValidLevel(level: unknown): level is LogLevel {
  return typeof level === 'string' && VALID_LEVEL_SET.has(level);
}

/**
 * 校验单条日志字段：service / level / message / attributes
 * 返回错误消息字符串，校验通过返回 null
 * 单条与批量共用，避免绕过长度/属性限制
 */
function validateLogFields(item: unknown): string | null {
  if (!item || typeof item !== 'object') return '日志条目必须是对象';
  const { service, level, message, attributes } = item as Record<string, unknown>;

  // service 校验
  if (!service || typeof service !== 'string' || service.trim().length === 0) {
    return 'service 必填且为非空字符串';
  }
  if (service.length > MAX_SERVICE_LENGTH) {
    return `service 长度不能超过 ${MAX_SERVICE_LENGTH} 字符`;
  }

  // level 校验
  if (!isValidLevel(level)) {
    return `level 必须是以下值之一: ${LEVELS.join(', ')}`;
  }

  // message 校验
  if (!message || typeof message !== 'string') {
    return 'message 必填且为字符串';
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return `message 长度不能超过 ${MAX_MESSAGE_LENGTH} 字符`;
  }

  // attributes 校验
  if (attributes !== undefined && attributes !== null) {
    if (typeof attributes !== 'object' || Array.isArray(attributes)) {
      return 'attributes 必须是对象';
    }
    const keys = Object.keys(attributes);
    if (keys.length > MAX_ATTR_COUNT) {
      return `attributes 数量不能超过 ${MAX_ATTR_COUNT}`;
    }
    for (const key of keys) {
      if (key.length > MAX_ATTR_KEY_LENGTH) {
        return `attribute key 长度不能超过 ${MAX_ATTR_KEY_LENGTH}`;
      }
      const val = (attributes as Record<string, unknown>)[key];
      if (val !== null && val !== undefined) {
        const strVal = String(val);
        if (strVal.length > MAX_ATTR_VALUE_LENGTH) {
          return `attribute value 长度不能超过 ${MAX_ATTR_VALUE_LENGTH}`;
        }
      }
    }
  }

  return null;
}

/**
 * 校验单条日志写入请求
 */
export function validateIngestLog(req: Request, res: Response, next: NextFunction): void {
  const err = validateLogFields(req.body);
  if (err) {
    res.status(400).json({ success: false, error: err });
    return;
  }
  next();
}

/**
 * 校验批量写入
 * 每条都与单条同等校验，避免绕过长度/属性限制
 */
export function validateBatchIngest(req: Request, res: Response, next: NextFunction): void {
  const items = Array.isArray(req.body) ? req.body : req.body?.logs;
  if (!Array.isArray(items)) {
    res.status(400).json({ success: false, error: 'expected an array of logs or { logs: [...] }' });
    return;
  }
  if (items.length === 0) {
    res.status(400).json({ success: false, error: '日志数组不能为空' });
    return;
  }
  if (items.length > MAX_BATCH_SIZE) {
    res.status(400).json({ success: false, error: `单次批量不能超过 ${MAX_BATCH_SIZE} 条` });
    return;
  }

  // 预校验每条（与单条同等严格）
  for (let i = 0; i < items.length; i++) {
    const err = validateLogFields(items[i]);
    if (err) {
      res.status(400).json({
        success: false,
        error: `第 ${i + 1} 条日志校验失败：${err}`,
      });
      return;
    }
  }

  next();
}
