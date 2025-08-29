# 🔧 Environment Variables Setup Guide

This guide will help you configure all the necessary environment variables for your Email Monitor Dashboard.

## 📋 **Step 1: Create Your Environment File**

1. **Copy the template file:**
   ```bash
   cp env.template .env.local
   ```

2. **Open the file in your editor:**
   ```bash
   # Using VS Code
   code .env.local
   
   # Using Notepad
   notepad .env.local
   ```

## 🔐 **Step 2: Configure Azure Active Directory (MSAL)**

### **Get Azure AD Credentials:**

1. **Go to Azure Portal:** https://portal.azure.com
2. **Navigate to:** Azure Active Directory → App registrations
3. **Create or select your app registration**
4. **Copy these values:**

```env
NEXT_PUBLIC_AZURE_CLIENT_ID=your-azure-client-id-here
NEXT_PUBLIC_AZURE_TENANT_ID=your-azure-tenant-id-here
AZURE_CLIENT_SECRET=your-azure-client-secret-here
```

### **Configure Redirect URIs:**
- Add `http://localhost:3000` to your app's redirect URIs
- Add `http://localhost:3000/` (with trailing slash)

## 🗺️ **Step 3: Configure Mapbox**

### **Get Mapbox Tokens:**

1. **Go to Mapbox:** https://account.mapbox.com/access-tokens/
2. **Sign up/Login** to your Mapbox account
3. **Create a new token** or use your default token
4. **Copy these values:**

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-public-token-here
MAPBOX_SECRET_TOKEN=sk.your-mapbox-secret-token-here
```

**Note:** You need both public (`pk.*`) and secret (`sk.*`) tokens.

## 🤖 **Step 4: Configure OpenAI API**

### **Get OpenAI API Key:**

1. **Go to OpenAI:** https://platform.openai.com/api-keys
2. **Sign up/Login** to your OpenAI account
3. **Create a new API key**
4. **Copy the key:**

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Note:** This is used for AI-powered email parsing and truck data extraction.

## 🗄️ **Step 5: Configure Azure SQL Database**

### **Get Database Credentials:**

1. **Go to Azure Portal:** https://portal.azure.com
2. **Navigate to:** SQL databases → Your database
3. **Copy these values:**

```env
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password
```

### **Configure Firewall Rules:**
- Allow your IP address in Azure SQL Database firewall
- Or temporarily allow all Azure services for testing

## 🔧 **Step 6: Configure WebSocket Server**

### **Default Configuration:**
```env
WEBSOCKET_PORT=8080
NEXTJS_URL=http://localhost:3000
```

**Note:** Change these only if you need different ports.

## 🔒 **Step 7: Configure NextAuth (Optional)**

### **Generate a Secret:**
```bash
# Generate a random secret
openssl rand -base64 32
```

### **Add to Environment:**
```env
NEXTAUTH_SECRET=your-generated-secret-here
```

## 📝 **Step 8: Complete Example**

Here's what your complete `.env.local` file should look like:

```env
# =============================================================================
# AZURE ACTIVE DIRECTORY (MSAL) CONFIGURATION
# =============================================================================
NEXT_PUBLIC_AZURE_CLIENT_ID=12345678-1234-1234-1234-123456789012
NEXT_PUBLIC_AZURE_TENANT_ID=87654321-4321-4321-4321-210987654321
AZURE_CLIENT_SECRET=your-actual-client-secret

# =============================================================================
# MAPBOX CONFIGURATION
# =============================================================================
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGV4YW1wbGUifQ.example
MAPBOX_SECRET_TOKEN=sk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGV4YW1wbGUifQ.example

# =============================================================================
# OPENAI API CONFIGURATION
# =============================================================================
OPENAI_API_KEY=sk-proj-your-actual-openai-api-key

# =============================================================================
# AZURE SQL DATABASE CONFIGURATION
# =============================================================================
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password

# =============================================================================
# WEBSocket SERVER CONFIGURATION
# =============================================================================
WEBSOCKET_PORT=8080
NEXTJS_URL=http://localhost:3000

# =============================================================================
# NEXT.JS CONFIGURATION
# =============================================================================
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-generated-secret

# =============================================================================
# OPTIONAL: LOGGING CONFIGURATION
# =============================================================================
LOG_LEVEL=info
DEBUG=false
```

## 🚀 **Step 9: Test Your Configuration**

1. **Start the development server:**
   ```bash
   npm run dev:full
   ```

2. **Check for errors** in the console
3. **Visit** http://localhost:3000
4. **Test authentication** and map functionality

## 🔍 **Step 10: Troubleshooting**

### **Common Issues:**

1. **"Mapbox token not configured"**
   - Check `NEXT_PUBLIC_MAPBOX_TOKEN` is set correctly
   - Ensure it starts with `pk.`

2. **"Azure AD authentication failed"**
   - Verify `NEXT_PUBLIC_AZURE_CLIENT_ID` and `NEXT_PUBLIC_AZURE_TENANT_ID`
   - Check redirect URIs in Azure AD app registration

3. **"OpenAI API error"**
   - Verify `OPENAI_API_KEY` is correct
   - Check your OpenAI account has credits

4. **"Database connection failed"**
   - Verify Azure SQL Database credentials
   - Check firewall rules allow your IP

### **Environment Variable Types:**

- **`NEXT_PUBLIC_*`** - Available in browser (client-side)
- **Others** - Only available on server-side

## 🔒 **Security Notes:**

1. **Never commit** `.env.local` to version control
2. **Keep your secrets** secure and private
3. **Use different values** for development and production
4. **Rotate secrets** regularly in production

## 📞 **Need Help?**

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all environment variables are set correctly
3. Check the browser console for error messages
4. Review the application logs

---

**✅ Your Email Monitor Dashboard should now be fully configured!** 