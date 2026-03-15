'use strict';

/**
 * PM2 ecosystem config — used for VPS (Contabo) direct deployment.
 *
 * Start:   pm2 start ecosystem.config.js --env production
 * Reload:  pm2 reload adpilot --update-env
 * Logs:    pm2 logs adpilot
 * Status:  pm2 status
 * Startup: pm2 startup && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'adpilot',
      script: 'src/server.js',

      // Keep a single instance (use 'max' for cluster mode across CPU cores)
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart on crash, backoff to avoid restart loops
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      // Memory limit — restart if exceeds 512 MB
      max_memory_restart: '512M',

      // Log files
      out_file: '/root/.pm2/logs/adpilot-out.log',
      error_file: '/root/.pm2/logs/adpilot-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Watch: disabled — deploys are done via git pull + pm2 reload
      watch: false,

      // Environment for production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,

        // Database + Redis — must be set in /root/Adpilot/.env on the VPS
        // or exported in the shell before starting PM2.
        //
        // Required:
        //   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adpilot
        //   REDIS_URL=redis://localhost:6379
        //   JWT_SECRET=<min 32 chars>
        //   JWT_REFRESH_SECRET=<min 32 chars>
      },
    },
  ],
};
