/**
 * local server entry file, for local development
 */
import app from './app.js';
import { broadcaster } from './ws/broadcaster.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

// initialize WebSocket server on /ws path
broadcaster.initWSS(server);

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  broadcaster.close().finally(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  broadcaster.close().finally(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});

export default app;
