/**
 * WebSocket broadcaster - manages client connections and pushes logs/stats.
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { LogEntry, WSMessage } from '../../shared/types.js';

interface ClientConnection {
  ws: WebSocket;
  filters: {
    service?: string;
    level?: string;
  };
}

class Broadcaster {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();

  initWSS(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws: WebSocket) => this.handleConnection(ws));
  }

  handleConnection(ws: WebSocket): void {
    const client: ClientConnection = { ws, filters: {} };
    this.clients.add(client);

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSMessage;
        if (msg.type === 'subscribe' && msg.filters) {
          client.filters = { ...client.filters, ...msg.filters };
        } else if (msg.type === 'unsubscribe') {
          if (msg.filters?.service) delete client.filters.service;
          if (msg.filters?.level) delete client.filters.level;
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
        client.ws.send(message);
      }
    }
  }

  broadcastStats(stats: { eps: number; total: number }): void {
    if (this.clients.size === 0) return;
    const message = JSON.stringify({ type: 'stats', data: stats } as WSMessage);
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
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
