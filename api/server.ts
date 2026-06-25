/**
 * local server entry file, for local development
 */
import app from './app.js';
import { broadcaster } from './ws/broadcaster.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 1001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

// initialize WebSocket server on /ws path
broadcaster.initWSS(server);

// P2-8: 全局未捕获异常处理，记录堆栈后退出
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err);
  // 不立即退出，让现有请求尽量完成，但标记需要重启
  // 对于严重错误，10 秒后强制退出
  setTimeout(() => process.exit(1), 10000).unref();
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});

/**
 * 优雅关闭：先关 WS，再关 HTTP，强制超时兜底
 * P1-5: 加 10 秒超时，避免 keep-alive 长连接导致进程挂死
 */
function gracefulShutdown(signal: string): void {
  console.log(`${signal} signal received`);
  const forceExit = setTimeout(() => {
    console.error('[server] 优雅关闭超时，强制退出');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  broadcaster.close().finally(() => {
    // Node 18.2+ 支持 closeAllConnections
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close(() => {
      console.log('Server closed');
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
