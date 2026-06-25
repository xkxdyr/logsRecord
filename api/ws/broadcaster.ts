/**
 * WebSocket broadcaster - manages client connections and pushes logs/stats.
 * 连接时校验管理员令牌；带心跳保活与死连接回收
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { timingSafeEqual } from 'crypto';
import type { LogEntry, WSMessage } from '../../shared/types.js';
import { getAdminToken } from '../middleware/adminAuth.js';

interface ClientConnection {
  ws: WebSocket;
  filters: {
    service?: string;
    level?: string;
  };
  alive: boolean;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

class Broadcaster {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  initWSS(server: Server): void {
    // 在 HTTP 升级阶段就校验令牌，未通过直接返回 401，不建立 WS 连接
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      verifyClient: (info, cb) => {
        if (this.authenticate(info.req)) {
          cb(true);
        } else {
          cb(false, 401, 'unauthorized');
        }
      },
    });
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) =>
      this.handleConnection(ws, req),
    );

    // 心跳保活：定期 ping，回收无响应的死连接
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients) {
        if (!client.alive) {
          client.ws.terminate();
          this.clients.delete(client);
          continue;
        }
        client.alive = false;
        try {
          client.ws.ping();
        } catch {
          this.clients.delete(client);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
  }

  private authenticate(req: IncomingMessage): boolean {
    const url = new URL(req.url || '', 'http://localhost');
    const token =
      url.searchParams.get('adminToken') ||
      req.headers['x-admin-token'] as string | undefined;
    if (!token) return false;
    // 恒定时间比较，与 HTTP 路由 requireAdmin 保持同等安全级别
    const expected = getAdminToken();
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // 鉴权：未通过则立即关闭
    if (!this.authenticate(req)) {
      ws.close(4001, 'unauthorized');
      return;
    }

    const client: ClientConnection = { ws, filters: {}, alive: true };
    this.clients.add(client);

    // pong 回来后标记为存活
    ws.on('pong', () => {
      client.alive = true;
    });

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSMessage;
        if (msg.type === 'subscribe' && msg.filters) {
          // 完全替换过滤器，避免 spread 合并导致旧值残留
          client.filters = { ...msg.filters };
        } else if (msg.type === 'unsubscribe') {
          // 不带 filters 表示清空全部；带 filters 则清除指定项
          if (!msg.filters) {
            client.filters = {};
          } else {
            if (msg.filters.service) delete client.filters.service;
            if (msg.filters.level) delete client.filters.level;
          }
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      this.clients.delete(client);
    });

    ws.on('error', () => {
      this.clients.delete(client);
    });
  }

  broadcast(log: LogEntry): void {
    if (this.clients.size === 0) return;
    const message = JSON.stringify({ type: 'log', data: log } as WSMessage);
    for (const client of this.clients) {
      if (!this.matchesFilters(client, log)) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch {
          // 客户端正在断开，send 抛错，清理连接避免影响后续客户端
          this.clients.delete(client);
        }
      }
    }
  }

  broadcastStats(stats: { eps: number; total: number }): void {
    if (this.clients.size === 0) return;
    const message = JSON.stringify({ type: 'stats', data: stats } as WSMessage);
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch {
          this.clients.delete(client);
        }
      }
    }
  }

  private matchesFilters(client: ClientConnection, log: LogEntry): boolean {
    if (client.filters.service && log.service !== client.filters.service) {
      return false;
    }
    if (client.filters.level && log.level !== client.filters.level) {
      return false;
    }
    return true;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      for (const client of this.clients) {
        client.ws.close();
      }
      this.clients.clear();
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

export const broadcaster = new Broadcaster();
export default broadcaster;
