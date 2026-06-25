import { useEffect, useRef, useState, useCallback } from "react";
import type { LogEntry, LogLevel } from "../../shared/types";

type WSMessage =
  | { type: "subscribe"; filters: { service?: string; level?: string } }
  | { type: "unsubscribe" };

interface UseLogStreamOptions {
  service?: string;
  level?: LogLevel | "";
  enabled?: boolean;
  onLog?: (log: LogEntry) => void;
}

/**
 * WebSocket 实时日志流 hook
 */
export function useLogStream(options: UseLogStreamOptions = {}) {
  const { service, level, enabled = true, onLog } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const maxLogs = 500;

  const connect = useCallback(() => {
    if (!enabled) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      const msg: WSMessage = {
        type: "subscribe",
        filters: { service: service || undefined, level: level || undefined },
      };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "log" && msg.data) {
          const log = msg.data as LogEntry;
          setLiveLogs((prev) => [log, ...prev].slice(0, maxLogs));
          onLogRef.current?.(log);
        }
      } catch {
        // 忽略解析错误
      }
    };

    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [enabled, service, level]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
    };
  }, [connect]);

  const clearLogs = useCallback(() => setLiveLogs([]), []);

  return { isConnected, liveLogs, clearLogs };
}
