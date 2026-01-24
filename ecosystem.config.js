export default {
  apps: [
    {
      name: "zayan-backend",
      script: "./index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      env_file: ".env",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      merge_logs: true,
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 4000,
    },
  ],
};
