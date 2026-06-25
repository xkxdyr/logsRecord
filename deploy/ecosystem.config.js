module.exports = {
  apps: [
    {
      name: 'logverse-client',
      script: 'npm',
      args: 'run client:build && npx serve -s dist -l 5173',
      cwd: '/opt/logverse',
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'logverse-server',
      script: 'npm',
      args: 'run server:build && node dist/server.js',
      cwd: '/opt/logverse',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};