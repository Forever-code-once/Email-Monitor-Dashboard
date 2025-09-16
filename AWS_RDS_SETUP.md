# AWS RDS MySQL Setup Guide

This guide helps you set up AWS RDS MySQL for truck data storage in the Email Monitor Dashboard.

## Database Architecture

- **AWS RDS MySQL**: Truck availability data, truck-related emails, truck customers
- **Azure SQL**: Load data (existing setup, unchanged)

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed (optional)
- MySQL client (optional, for testing)

## Step 1: Create AWS RDS MySQL Instance

### Via AWS Console

1. **Login to AWS Console**
   - Go to https://console.aws.amazon.com
   - Navigate to RDS service

2. **Create Database**
   - Click "Create database"
   - Choose "Standard create"
   - Engine type: **MySQL**
   - Version: **MySQL 8.0** (latest)

3. **Instance Configuration**
   - DB instance class: **db.t3.micro** (free tier) or **db.t3.small** (production)
   - Storage: **20 GB** General Purpose SSD (minimum)
   - Enable storage autoscaling if needed

4. **Settings**
   - DB instance identifier: `truck-monitor-db`
   - Master username: `admin` (or your preference)
   - Master password: **Strong password** (save this!)

5. **Connectivity**
   - VPC: Default VPC (or your custom VPC)
   - Subnet group: Default
   - **Public access: Yes** (for external connections)
   - VPC security group: Create new
   - Availability Zone: No preference
   - Port: **3306** (default MySQL port)

6. **Database Authentication**
   - Password authentication

7. **Additional Configuration**
   - Initial database name: `email_monitor`
   - Backup retention: 7 days (recommended)
   - Monitoring: Enable Enhanced monitoring
   - Log exports: Error log, General log, Slow query log

8. **Create Database**
   - Review settings and click "Create database"
   - Wait 10-15 minutes for creation

## Step 2: Configure Security Group

1. **Edit Security Group**
   - Go to EC2 > Security Groups
   - Find the security group created for your RDS instance
   - Edit inbound rules

2. **Add MySQL Rule**
   - Type: MySQL/Aurora
   - Protocol: TCP
   - Port: 3306
   - Source: 
     - For development: `0.0.0.0/0` (anywhere)
     - For production: Your application server's IP or security group

## Step 3: Get Connection Details

1. **RDS Instance Details**
   - Go to RDS > Databases
   - Click on your instance
   - Note the **Endpoint** (hostname)

2. **Connection Information**
   ```
   Host: your-instance.region.rds.amazonaws.com
   Port: 3306
   Database: email_monitor
   Username: admin (or what you chose)
   Password: [your password]
   ```

## Step 4: Create Database Schema

1. **Connect to RDS Instance**
   ```bash
   mysql -h your-instance.region.rds.amazonaws.com -u admin -p email_monitor
   ```

2. **Run Schema Script**
   ```bash
   mysql -h your-instance.region.rds.amazonaws.com -u admin -p email_monitor < aws-rds-schema.sql
   ```

   Or copy and paste the contents of `aws-rds-schema.sql` into your MySQL client.

## Step 5: Configure Environment Variables

1. **Update `.env.local`**
   ```env
   # AWS RDS MySQL Configuration (for truck data)
   AWS_RDS_HOST=your-instance.region.rds.amazonaws.com
   AWS_RDS_DATABASE=email_monitor
   AWS_RDS_USER=admin
   AWS_RDS_PASSWORD=your-password
   AWS_RDS_PORT=3306
   
   # Azure SQL remains for loads (unchanged)
   AZURE_SQL_SERVER=your-server.database.windows.net
   AZURE_SQL_DATABASE=your-database-name
   AZURE_SQL_USER=your-username
   AZURE_SQL_PASSWORD=your-password
   ```

2. **Update PM2 Configuration** (if using PM2)
   ```bash
   pm2 restart all --update-env
   ```

## Step 6: Test Connection

1. **Test API Endpoint**
   ```bash
   curl http://localhost:3000/api/trucks/stored
   ```

2. **Check Application Logs**
   ```bash
   pm2 logs nextjs-dashboard
   ```

3. **Verify Database Connection**
   - Should see: "✅ AWS RDS connection successful"
   - Should return truck data (even if empty initially)

## Schema Overview

### Tables Created

1. **truck_availability**
   - Main table for truck data
   - Columns: id, customer, customer_email, date, city, state, additional_info, email_id, email_subject, email_date, is_deleted, deleted_date, created_at, updated_at

2. **emails** 
   - Stores truck-related emails
   - Columns: id, email_id, subject, from_email, from_name, body, received_date_time, is_forwarded, original_sender, created_at, updated_at

3. **customers**
   - Stores truck customer information
   - Columns: id, customer_name, customer_email, first_seen, last_seen, total_emails, total_trucks, created_at, updated_at

### Views Created

- **active_trucks**: Combined view of non-deleted trucks with customer and email information

## Monitoring and Maintenance

### Performance Monitoring
```sql
-- Check table sizes
SELECT 
    table_name,
    table_rows,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'email_monitor';

-- Check recent truck entries
SELECT COUNT(*) as recent_trucks 
FROM truck_availability 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

### Regular Maintenance
```sql
-- Clean up old email records (optional, run monthly)
DELETE FROM emails 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Optimize tables (run weekly)
OPTIMIZE TABLE truck_availability;
OPTIMIZE TABLE emails;
OPTIMIZE TABLE customers;
```

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check security group rules
   - Verify RDS instance is publicly accessible
   - Check VPC and subnet configuration

2. **Access Denied**
   - Verify username/password
   - Check user permissions
   - Ensure database name is correct

3. **SSL Certificate Issues**
   - RDS requires SSL by default
   - Our configuration uses `rejectUnauthorized: false` for development
   - For production, download and use proper RDS CA certificates

4. **Performance Issues**
   - Monitor RDS CloudWatch metrics
   - Consider upgrading instance class
   - Add proper indexes for your query patterns

### Useful Commands

```bash
# Test connection from command line
mysql -h your-rds-endpoint -u admin -p -e "SELECT 1"

# Show databases
mysql -h your-rds-endpoint -u admin -p -e "SHOW DATABASES"

# Show tables
mysql -h your-rds-endpoint -u admin -p email_monitor -e "SHOW TABLES"

# Check truck count
mysql -h your-rds-endpoint -u admin -p email_monitor -e "SELECT COUNT(*) FROM truck_availability"
```

## Production Considerations

1. **Security**
   - Use VPC with private subnets
   - Restrict security group to application servers only
   - Enable SSL certificate validation
   - Use AWS Secrets Manager for credentials

2. **Backup**
   - Enable automated backups
   - Set appropriate retention period
   - Test restore procedures

3. **Monitoring**
   - Enable CloudWatch monitoring
   - Set up alerts for high CPU, connections
   - Monitor slow query log

4. **Scaling**
   - Monitor connection usage
   - Consider read replicas for read-heavy workloads
   - Use connection pooling in application

## Cost Optimization

1. **Instance Sizing**
   - Start with db.t3.micro (free tier eligible)
   - Monitor CPU and memory usage
   - Scale up only when needed

2. **Storage**
   - Use General Purpose SSD for most workloads
   - Enable storage autoscaling
   - Monitor storage usage patterns

3. **Backup**
   - Optimize backup retention period
   - Use snapshots for long-term archival

## Support

For issues with this setup:
1. Check AWS RDS documentation
2. Review application logs
3. Monitor CloudWatch metrics
4. Contact AWS support for RDS-specific issues