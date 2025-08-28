// PM2 Ecosystem Configuration for Email Monitor Dashboard
module.exports = {
  apps: [
    {
      name: 'nextjs-dashboard',
      script: 'npm',
      args: 'start',
      cwd: process.cwd(),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Azure SQL Database Configuration
        AZURE_SQL_SERVER: 'your-server.database.windows.net',
        AZURE_SQL_DATABASE: 'your-database-name',
        AZURE_SQL_USER: 'your-username',
        AZURE_SQL_PASSWORD: 'your-password',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Azure SQL Database Configuration
        AZURE_SQL_SERVER: 'your-server.database.windows.net',
        AZURE_SQL_DATABASE: 'your-database-name',
        AZURE_SQL_USER: 'your-username',
        AZURE_SQL_PASSWORD: 'your-password',
      },
      error_file: './logs/nextjs-error.log',
      out_file: './logs/nextjs-out.log',
      log_file: './logs/nextjs-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'websocket-server',
      script: './server/websocket-server.js',
      cwd: process.cwd(),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: 8080,
        NEXTJS_URL: 'http://localhost:3000'
      },
      env_production: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: 8080,
        NEXTJS_URL: 'http://localhost:3000'
      },
      error_file: './logs/websocket-error.log',
      out_file: './logs/websocket-out.log',
      log_file: './logs/websocket-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};