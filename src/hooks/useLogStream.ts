import { useEffect, useRef, useState, useCallback } from "react";
import type { LogEntry, LogLevel } from "../../shared/types";
import { getAdminToken } from "@/lib/api";

type WSMessage =
  | { type: "subscribe"; filters: { service?: string; level?: string } }
  | { type: "unsubscribe" };

interface UseLogStreamOptions {
  service?: string;
  level?: LogLevel | "";
  enabled?: boolean;
  onLog?: (log: LogEntry) => void;
  /** 是否收集日志到 liveLogs 数组（默认 true）。Dashboard 仅需 onLog 回调时可设 false 省内存 */
  collectLogs?: boolean;
}

const RECONNECT_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 15000;

/**
 * WebSocket 实时日志流 hook
 * - 连接时通过 query 参数携带 admin token 鉴权
 * - 过滤条件变化经 debounce 后再重连，避免输入抖动产生重连风暴
 * - 断线自动指数退避重连
 */
export function useLogStream(options: UseLogStreamOptions = {}) {
  const { service, level, enabled = true, onLog, collectLogs = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  // 用 ref 保存最新的过滤条件，避免重连依赖变化
  const filtersRef = useRef({ service, level });
  filtersRef.current = { service, level };

  // P1-1/P1-10: 用 ref 持有最新 enabled 与 connect，避免 onclose 捕获过期闭包
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const collectLogsRef = useRef(collectLogs);
  collectLogsRef.current = collectLogs;
  const connectRef = useRef<() => void>(() => {});

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualCloseRef = useRef(false);

  const maxLogs = 500;

  // P0-2: Vercel serverless 不支持 WebSocket，检测到时禁用 WS 避免永久重连失败
  // 检测方式：Vercel 构建时注入 VERCEL=1；或生产环境且无自定义端口（443）
  const wsDisabled =
    !!import.meta.env.VERCEL ||
    (import.meta.env.PROD && !window.location.port);

  const connect = useCallback(() => {
    if (!enabledRef.current || wsDisabled) return;
    manualCloseRef.current = false;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const { service: svc, level: lvl } = filtersRef.current;
    const params = new URLSearchParams({ adminToken: getAdminToken() });
    const wsUrl = `${protocol}//${window.location.host}/ws?${params.toString()}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // P1-1: 仅处理当前连接的事件，忽略被替换的旧连接
      if (wsRef.current !== ws) return;
      reconnectAttemptsRef.current = 0;
      setIsConnected(true);
      const msg: WSMessage = {
        type: "subscribe",
        filters: { service: svc || undefined, level: lvl || undefined },
      };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "log" && msg.data) {
          const log = msg.data as LogEntry;
          // P2-5: collectLogs=false 时跳过 setLiveLogs，避免无意义 re-render
          // P2-8: 用 ref 读取最新 collectLogs，避免它进入 connect 依赖导致不必要重连
          if (collectLogsRef.current) {
            setLiveLogs((prev) => [log, ...prev].slice(0, maxLogs));
          }
          onLogRef.current?.(log);
        }
      } catch {
        // 忽略解析错误
      }
    };

    ws.onclose = () => {
      // P1-1: 仅处理当前连接的关闭，忽略被替换掉的旧连接的 close 事件
      if (wsRef.current !== ws) return;
      setIsConnected(false);
      wsRef.current = null;
      // P1-10: 用 enabledRef 替代闭包 enabled，避免 enabled 切换后仍用过期值重连
      if (!manualCloseRef.current && enabledRef.current) {
        const attempt = reconnectAttemptsRef.current++;
        const delay = Math.min(
          RECONNECT_DELAY_MS * Math.pow(2, attempt),
          RECONNECT_MAX_DELAY_MS,
        );
        // 用 connectRef 替代闭包 connect，确保调用最新版本
        reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay);
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setIsConnected(false);
    };
  }, [wsDisabled]);

  // 保持 connectRef 始终指向最新 connect
  connectRef.current = connect;

  // P1-4: 过滤条件变化时清空 liveLogs，避免残留不匹配日志
  useEffect(() => {
    setLiveLogs([]);
  }, [service, level]);

  // 过滤条件变化时，debounce 后更新订阅（而非断开重连）
  useEffect(() => {
    const t = setTimeout(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        // 构造过滤器：显式删除空值，避免 undefined 被 spread 跳过导致旧过滤器残留
        const filters: { service?: string; level?: string } = {};
        if (service) filters.service = service;
        if (level) filters.level = level;
        const msg: WSMessage = {
          type: "subscribe",
          filters,
        };
        ws.send(JSON.stringify(msg));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [service, level]);

  // enabled 变化时建立/断开连接
  useEffect(() => {
    if (enabled && !wsDisabled) {
      connect();
    }
    return () => {
      manualCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        ws.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, connect, wsDisabled]);

  const clearLogs = useCallback(() => setLiveLogs([]), []);

  return { isConnected, liveLogs, clearLogs };
}
