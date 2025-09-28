'use client'

import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { useEffect, useState } from 'react'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { AppLayout } from '@/components/layout/AppLayout'

export default function Home() {
  const isAuthenticated = useIsAuthenticated()
  const { instance } = useMsal()
  const [forceLogin, setForceLogin] = useState(true)

  // Force logout and account selection on every page refresh
  useEffect(() => {
    // Clear all cache and force logout on page load
    instance.clearCache()
    
    // If there's an active account, log it out
    const account = instance.getActiveAccount()
    if (account) {
      instance.logoutRedirect({
        account: account,
        postLogoutRedirectUri: window.location.origin
      })
    } else {
      setForceLogin(false)
    }
  }, [instance])

  // Simple authentication check - go straight to dashboard after login
  if (!isAuthenticated || forceLogin) {
    return <LoginScreen />
  }

  return (
    <AppLayout
      lastRefresh={new Date()}
      wsConnected={false}
      onLogout={() => {
        instance.logoutRedirect({
          postLogoutRedirectUri: window.location.origin
        })
      }}
      onSendToken={() => {
        // Handle send token functionality
        console.log('Send token clicked')
      }}
    >
      <Dashboard />
    </AppLayout>
  )
} 