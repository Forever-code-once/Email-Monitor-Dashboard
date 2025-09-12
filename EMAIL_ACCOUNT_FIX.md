# 🔧 Email Account Fix: Force ai@conardlogistics.com

## Problem
The system was using the currently signed-in user's Microsoft account instead of always using `ai@conardlogistics.com` for email monitoring. This caused issues when users logged in with their personal `employee@conardlogistics.com` accounts.

## ✅ Solution Implemented

### 1. **Updated Microsoft Graph API Calls**
- **Frontend**: `src/lib/graphClient.ts` - Now uses `/users/ai@conardlogistics.com/mailFolders/inbox/messages`
- **Backend**: `server/websocket-server.js` - Now uses `/users/ai@conardlogistics.com/messages`

### 2. **Enhanced Authentication Configuration**
- **MSAL Config**: `src/lib/msalConfig.ts` - Added `prompt: 'select_account'` and `login_hint: 'ai@conardlogistics.com'`
- **Login Screen**: `src/components/auth/LoginScreen.tsx` - Added warning message to select correct account

### 3. **Account Validation**
- **Dashboard**: `src/components/dashboard/Dashboard.tsx` - Added automatic validation that forces logout if wrong account is detected

### 4. **Environment Variables**
- Added `NEXT_PUBLIC_TARGET_EMAIL_ACCOUNT` and `TARGET_EMAIL_ACCOUNT` for configuration

## 🚀 How It Works Now

### **Step 1: User Login**
1. User clicks "Sign in with Microsoft"
2. Microsoft login page opens with `ai@conardlogistics.com` pre-filled
3. User must select the correct account

### **Step 2: Account Validation**
1. System checks if logged-in account is `ai@conardlogistics.com`
2. If wrong account detected:
   - Shows warning notification
   - Automatically logs out user
   - Redirects to login page

### **Step 3: Email Fetching**
1. **Frontend**: Always fetches from `ai@conardlogistics.com` inbox
2. **Backend**: Always monitors `ai@conardlogistics.com` mailbox
3. **Real-time**: WebSocket server uses specific account

## 📋 Required Environment Variables

Add these to your `.env.local` file:

```bash
# Target Email Account (always use this account for email monitoring)
NEXT_PUBLIC_TARGET_EMAIL_ACCOUNT=ai@conardlogistics.com
TARGET_EMAIL_ACCOUNT=ai@conardlogistics.com

# Other existing variables...
NEXT_PUBLIC_AZURE_CLIENT_ID=your_client_id
NEXT_PUBLIC_AZURE_TENANT_ID=your_tenant_id
# ... etc
```

## 🔍 Key Changes Made

### **1. Frontend Email Fetching (`src/lib/graphClient.ts`)**
```typescript
// OLD: Used current user's mailbox
.api('/me/mailFolders/inbox/messages')

// NEW: Always uses specific account
const targetEmail = process.env.NEXT_PUBLIC_TARGET_EMAIL_ACCOUNT || 'ai@conardlogistics.com';
.api(`/users/${targetEmail}/mailFolders/inbox/messages`)
```

### **2. Backend Email Monitoring (`server/websocket-server.js`)**
```javascript
// OLD: Used current user's mailbox
.api('/me/messages')

// NEW: Always uses specific account
const targetEmail = process.env.TARGET_EMAIL_ACCOUNT || 'ai@conardlogistics.com';
.api(`/users/${targetEmail}/messages`)
```

### **3. Authentication Configuration (`src/lib/msalConfig.ts`)**
```typescript
export const loginRequest: RedirectRequest = {
  scopes: [...],
  prompt: 'select_account', // Force account selection every time
  extraQueryParameters: {
    'login_hint': 'ai@conardlogistics.com' // Pre-fill with target account
  }
}
```

### **4. Account Validation (`src/components/dashboard/Dashboard.tsx`)**
```typescript
// Validate that the correct account is being used
if (activeAccount) {
  const targetEmail = 'ai@conardlogistics.com'
  const currentEmail = activeAccount.username || activeAccount.name
  
  if (currentEmail !== targetEmail) {
    // Show warning and force logout
    showNotification(`Please sign out and sign in with ${targetEmail}`, 'warning', 8000)
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
  }
}
```

## 🧪 Testing

### **Test 1: Correct Account**
1. Sign in with `ai@conardlogistics.com`
2. Should see: "✅ Correct account detected: ai@conardlogistics.com"
3. System should work normally

### **Test 2: Wrong Account**
1. Sign in with `employee@conardlogistics.com`
2. Should see: "⚠️ Wrong account detected: employee@conardlogistics.com. Expected: ai@conardlogistics.com"
3. System should automatically log out and redirect to login

### **Test 3: Email Fetching**
1. Check browser console for: "📧 Fetching emails from: ai@conardlogistics.com"
2. Verify emails are coming from the correct account

## 🔒 Security Notes

- **Permissions**: The `ai@conardlogistics.com` account must have proper Microsoft Graph API permissions
- **Tenant**: Make sure the account is in the correct Azure AD tenant
- **Consent**: Users may need to grant consent for the application to access the specific account

## 🚨 Troubleshooting

### **Issue: Still using wrong account**
- **Solution**: Clear browser cache and cookies, then sign in again
- **Check**: Verify environment variables are set correctly

### **Issue: Permission denied**
- **Solution**: Ensure `ai@conardlogistics.com` has proper Graph API permissions
- **Check**: Verify the account is in the correct Azure AD tenant

### **Issue: Account selection not working**
- **Solution**: Check MSAL configuration and ensure `prompt: 'select_account'` is set
- **Check**: Verify `login_hint` parameter is working

## ✅ Benefits

1. **Consistent Data Source**: Always reads from the same email account
2. **No User Confusion**: Clear indication of which account to use
3. **Automatic Validation**: Prevents wrong account usage
4. **Real-time Monitoring**: WebSocket server uses correct account
5. **User-friendly**: Clear warnings and automatic corrections

The system now ensures that all email monitoring is done from the `ai@conardlogistics.com` account, regardless of which user is logged in! 🚛✨