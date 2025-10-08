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
        AZURE_SQL_SERVER: 'vlpsql12.eastus.cloudapp.azure.com',
        AZURE_SQL_DATABASE: 'VLPCONARD',
        AZURE_SQL_USER: 'conardsqlrdr1',
        AZURE_SQL_PASSWORD: '(-:conardsqlrdr1!',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Azure SQL Database Configuration
        AZURE_SQL_SERVER: 'vlpsql12.eastus.cloudapp.azure.com',
        AZURE_SQL_DATABASE: 'VLPCONARD',
        AZURE_SQL_USER: 'conardsqlrdr1',
        AZURE_SQL_PASSWORD: '(-:conardsqlrdr1!',
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
    },
    {
      name: 'truck-websocket-server',
      script: './server/truck-websocket-server.js',
      cwd: process.cwd(),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: 8081,
        // AWS RDS MySQL Database Configuration
        AWS_RDS_HOST: process.env.AWS_RDS_HOST,
        AWS_RDS_DATABASE: process.env.AWS_RDS_DATABASE,
        AWS_RDS_USER: process.env.AWS_RDS_USER,
        AWS_RDS_PASSWORD: process.env.AWS_RDS_PASSWORD,
        AWS_RDS_PORT: process.env.AWS_RDS_PORT || '3306'
      },
      env_production: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: 8081,
        // AWS RDS MySQL Database Configuration
        AWS_RDS_HOST: process.env.AWS_RDS_HOST,
        AWS_RDS_DATABASE: process.env.AWS_RDS_DATABASE,
        AWS_RDS_USER: process.env.AWS_RDS_USER,
        AWS_RDS_PASSWORD: process.env.AWS_RDS_PASSWORD,
        AWS_RDS_PORT: process.env.AWS_RDS_PORT || '3306'
      },
      error_file: './logs/truck-websocket-error.log',
      out_file: './logs/truck-websocket-out.log',
      log_file: './logs/truck-websocket-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'bid-websocket-server',
      script: './server/bid-websocket-server.js',
      cwd: process.cwd(),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: 8082,
        // AWS RDS MySQL Database Configuration
        AWS_RDS_HOST: 'email-monitor-db.ctljjcc4qcdj.us-east-1.rds.amazonaws.com',
        AWS_RDS_DATABASE: 'email_monitor',
        AWS_RDS_USER: 'admin',
        AWS_RDS_PASSWORD: 'bGp3+00RQ',
        AWS_RDS_PORT: '3306'
      },
      env_production: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: 8082,
        // AWS RDS MySQL Database Configuration
        AWS_RDS_HOST: 'email-monitor-db.ctljjcc4qcdj.us-east-1.rds.amazonaws.com',
        AWS_RDS_DATABASE: 'email_monitor',
        AWS_RDS_USER: 'admin',
        AWS_RDS_PASSWORD: 'bGp3+00RQ',
        AWS_RDS_PORT: '3306'
      },
      error_file: './logs/bid-websocket-error.log',
      out_file: './logs/bid-websocket-out.log',
      log_file: './logs/bid-websocket-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};