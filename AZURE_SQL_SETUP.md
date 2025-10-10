# Azure SQL Database Setup Guide

This guide will help you set up Azure SQL Database connection for your Email Monitor Dashboard.

## 🔧 **Prerequisites**

1. **Azure SQL Database** - You need an existing Azure SQL Database
2. **Connection String** - Your database connection details
3. **Firewall Rules** - Allow your application to connect

## 📋 **Step 1: Get Your Azure SQL Database Details**

From your Azure Portal, get these details:
- **Server name**: `your-server.database.windows.net`
- **Database name**: `your-database-name`
- **Username**: Usually your admin username
- **Password**: Your database password

## 🔐 **Step 2: Configure Environment Variables**

### **Local Development (.env.local)**
```bash
# Azure SQL Database Configuration
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password
```

### **Production (ecosystem.config.js)**
Update the environment variables in your `ecosystem.config.js`:
```javascript
env: {
  // ... existing variables
  AZURE_SQL_SERVER: 'your-server.database.windows.net',
  AZURE_SQL_DATABASE: 'your-database-name',
  AZURE_SQL_USER: 'your-username',
  AZURE_SQL_PASSWORD: 'your-password',
}
```

## 🗄️ **Step 3: Create Database Tables**

1. **Connect to your Azure SQL Database** using Azure Data Studio, SQL Server Management Studio, or Azure Portal Query Editor

2. **Run the setup script**:
   ```sql
   -- Copy and paste the contents of database-setup.sql
   -- This will create all necessary tables, indexes, and stored procedures
   ```

3. **Verify tables were created**:
   ```sql
   SELECT TABLE_NAME 
   FROM INFORMATION_SCHEMA.TABLES 
   WHERE TABLE_TYPE = 'BASE TABLE';
   ```

## 🔥 **Step 4: Configure Firewall Rules**

### **Option A: Azure Portal**
1. Go to your Azure SQL Database
2. Click on "Networking" in the left menu
3. Under "Firewall rules", add your IP address
4. Or temporarily allow all Azure services (for testing)

### **Option B: SQL Command**
```sql
-- Allow your IP address (replace with your actual IP)
EXEC sp_set_firewall_rule N'Allow My IP', 'YOUR_IP_ADDRESS', 'YOUR_IP_ADDRESS';

-- Or allow all Azure services (less secure, for testing only)
EXEC sp_set_firewall_rule N'Allow Azure Services', '0.0.0.0', '0.0.0.0';
```

## 🧪 **Step 5: Test the Connection**

### **Test via API Endpoint**
```bash
# Test database connection
curl http://localhost:3000/api/test-database

# Expected response:
{
  "success": true,
  "message": "Database connection successful",
  "truckCount": 0,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### **Test via Browser**
Navigate to: `http://localhost:3000/api/test-database`

## 📊 **Step 6: Database Schema Overview**

### **Tables Created:**
1. **TruckAvailability** - Stores truck availability data
2. **Emails** - Stores email data
3. **Customers** - Stores customer information

### **Stored Procedures:**
- `sp_SaveTruckAvailability` - Save truck data
- `sp_GetTruckAvailabilityByCustomer` - Get trucks by customer
- `sp_GetAllTruckAvailability` - Get all trucks
- `sp_SaveEmail` - Save email data
- `sp_GetCustomerStatistics` - Get customer stats

### **Views:**
- `vw_RecentTruckAvailability` - Recent truck data
- `vw_CustomerSummary` - Customer summary

## 🔄 **Step 7: Integration with Your Application**

### **Save Truck Data**
```javascript
import { databaseQueries } from '@/lib/database'

// Save truck availability
await databaseQueries.saveTruckAvailability({
  customer: 'Company Name',
  customerEmail: 'company@example.com',
  date: '12/15',
  city: 'Atlanta',
  state: 'GA',
  additionalInfo: '53ft dry van',
  emailId: 'email-123',
  emailSubject: 'Truck List',
  emailDate: new Date()
})
```

### **Get Truck Data**
```javascript
// Get trucks by customer
const trucks = await databaseQueries.getTruckAvailabilityByCustomer('company@example.com')

// Get all trucks
const allTrucks = await databaseQueries.getAllTruckAvailability()
```

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **Connection Timeout**
   ```
   Error: Connection timeout
   ```
   **Solution**: Check firewall rules and network connectivity

2. **Authentication Failed**
   ```
   Error: Login failed for user
   ```
   **Solution**: Verify username and password

3. **Server Not Found**
   ```
   Error: getaddrinfo ENOTFOUND
   ```
   **Solution**: Check server name spelling

4. **SSL/TLS Error**
   ```
   Error: SSL connection error
   ```
   **Solution**: Ensure `encrypt: true` in connection config

### **Debug Commands:**
```bash
# Test connection from command line
node -e "
const sql = require('mssql');
const config = {
  server: 'your-server.database.windows.net',
  database: 'your-database-name',
  user: 'your-username',
  password: 'your-password',
  options: { encrypt: true, trustServerCertificate: false }
};
sql.connect(config).then(() => {
  return sql.query('SELECT 1 as test');
}).then(result => {
  sql.close();
}).catch(err => {
  console.error('Error:', err);
  sql.close();
});
"
```

## 🔒 **Security Best Practices**

1. **Use Environment Variables** - Never hardcode credentials
2. **Connection Pooling** - Use the built-in connection pool
3. **Parameterized Queries** - Prevent SQL injection
4. **Firewall Rules** - Restrict access to necessary IPs only
5. **Encryption** - Always use SSL/TLS (enabled by default)

## 📈 **Performance Tips**

1. **Indexes** - Already created in the setup script
2. **Connection Pool** - Configured for optimal performance
3. **Query Optimization** - Use stored procedures for complex queries
4. **Monitoring** - Monitor query performance in Azure Portal

## 🔄 **Deployment**

### **Local Development:**
```bash
npm run dev
```

### **Production:**
```bash
# Update environment variables in ecosystem.config.js
pm2 start ecosystem.config.js
```

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your Azure SQL Database is running
3. Test connection with a simple SQL client
4. Check Azure Portal for any service issues 