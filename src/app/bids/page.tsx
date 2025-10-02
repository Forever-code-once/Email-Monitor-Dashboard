'use client'

import { useState, useEffect } from 'react'
import { Box } from '@mui/material'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { BidRequestSidebar } from '@/components/bid/BidRequestSidebar'
import { LoginScreen } from '@/components/auth/LoginScreen'

export default function BidsPage() {
  const isAuthenticated = useIsAuthenticated()
  const { instance } = useMsal()
  const [selectedDate] = useState<Date>(new Date())
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
        postLogoutRedirectUri: window.location.origin + '/bids'
      })
    } else {
      setForceLogin(false)
    }
  }, [instance])

  // Show login screen if not authenticated
  if (!isAuthenticated || forceLogin) {
    return <LoginScreen />
  }

  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100vw', 
      overflow: 'hidden',
      display: 'flex',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Full Width Bid Request Sidebar */}
      <BidRequestSidebar 
        truckPins={[]}
        onRefresh={() => {}}
        selectedDate={selectedDate}
        collapsed={false}
      />
      
      {/* Empty space - sidebar takes full width */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e0e0e0'
      }}>
        <Box sx={{ 
          textAlign: 'center',
          p: 4,
          borderRadius: 2,
          backgroundColor: '#f8f9fa',
          border: '2px dashed #dee2e6'
        }}>
          <h2 style={{ color: '#6c757d', marginBottom: '16px' }}>
            🚛 Bid Requests Dashboard
          </h2>
          <p style={{ color: '#6c757d', margin: 0 }}>
            Use the sidebar to manage bid requests and truck availability
          </p>
        </Box>
      </Box>
    </Box>
  )
}