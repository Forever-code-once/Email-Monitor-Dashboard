'use client'

import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Alert, CircularProgress, useTheme } from '@mui/material'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { BidRequestFormSidebar } from '@/components/bid/BidRequestFormSidebar'
import { BidRequestItem } from '@/components/bid/BidRequestItem'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { BidRequest } from '@/types/bid'
import { useTheme as useCustomTheme } from '@/components/providers/ThemeProvider'
import { EmailWebSocketClient } from '@/lib/websocket'

export default function BidsPage() {
  const isAuthenticated = useIsAuthenticated()
  const { instance } = useMsal()
  const [selectedDate] = useState<Date>(new Date())
  const [forceLogin, setForceLogin] = useState(true)
  const [bidRequests, setBidRequests] = useState<BidRequest[]>([])
  const [error, setError] = useState<string>('')
  const [wsConnected, setWsConnected] = useState(false)
  const wsClientRef = useRef<EmailWebSocketClient | null>(null)
  const theme = useTheme()
  const { darkMode } = useCustomTheme()

  // Fetch bid requests from API
  const fetchBidRequests = async () => {
    try {
      const response = await fetch('/api/bid-requests')
      const data = await response.json()
      
      if (data.success) {
        setBidRequests(data.bidRequests)
      } else {
        setError(data.error || 'Failed to fetch bid requests')
      }
    } catch (err) {
      setError('Network error fetching bid requests')
    }
  }

  // Delete bid request
  const deleteBidRequest = async (id: string) => {
    try {
      const response = await fetch(`/api/bid-requests/${id}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (data.success) {
        await fetchBidRequests() // Refresh the list
      } else {
        console.error('❌ Bids page: Delete failed:', data.error)
        setError(data.error || 'Failed to delete bid request')
      }
    } catch (err) {
      console.error('❌ Bids page: Network error deleting bid request:', err)
      setError('Network error deleting bid request')
    }
  }

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated && !forceLogin) {
      fetchBidRequests()
    }
  }, [isAuthenticated, forceLogin])

  // Refresh every 5 minutes
  useEffect(() => {
    if (isAuthenticated && !forceLogin) {
      const interval = setInterval(fetchBidRequests, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, forceLogin])

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

  // WebSocket setup for real-time bid request updates
  useEffect(() => {
    if (isAuthenticated && !forceLogin) {
      const wsClient = new EmailWebSocketClient('wss://ai.conardlogistics.com/bid-ws')
      wsClientRef.current = wsClient

      wsClient.on('connection', (data: any) => {
        setWsConnected(true)
      })

      wsClient.on('disconnection', (data: any) => {
        setWsConnected(false)
      })

      wsClient.on('error', (error: any) => {
        console.error('WebSocket error:', error)
        setWsConnected(false)
      })

      // Bid request event handlers
      wsClient.on('newBidRequest', (data: any) => {
        fetchBidRequests() // Refresh the list
      })

      wsClient.on('bidRequestDeleted', (data: any) => {
        fetchBidRequests() // Refresh the list
      })

      wsClient.on('bidRequestUpdated', (data: any) => {
        fetchBidRequests() // Refresh the list
      })

      wsClient.connect()

      return () => {
        wsClient.disconnect()
      }
    }
  }, [isAuthenticated, forceLogin])

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
      backgroundColor: darkMode ? theme.palette.background.default : '#f5f5f5'
    }}>
      {/* Form Only Sidebar */}
      <BidRequestFormSidebar 
        truckPins={[]}
        onRefresh={fetchBidRequests}
        selectedDate={selectedDate}
        collapsed={false}
      />
      
      {/* Main Content Area - Bid Requests List */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: darkMode ? theme.palette.background.paper : '#ffffff',
        borderLeft: `1px solid ${darkMode ? theme.palette.divider : '#e0e0e0'}`,
        overflow: 'hidden'
      }}>
        {/* Header */}
        <Box sx={{ 
          p: 3, 
          borderBottom: `2px solid ${darkMode ? theme.palette.divider : '#e3f2fd'}`,
          background: darkMode 
            ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
            : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white'
        }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
            📋 Bid Requests
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              backgroundColor: bidRequests.length > 0 ? '#4caf50' : '#ff9800' 
            }} />
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {bidRequests.length} active request{bidRequests.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto', 
          p: 3,
          backgroundColor: darkMode ? theme.palette.background.default : '#f8f9fa'
        }}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3, 
                borderRadius: 2,
                '& .MuiAlert-message': { fontSize: '0.875rem' }
              }} 
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          )}

          {/* Bid Requests List */}
          {bidRequests.length === 0 ? (
            <Box sx={{ 
              textAlign: 'center', 
              p: 4, 
              borderRadius: 2,
              backgroundColor: darkMode ? theme.palette.background.paper : '#ffffff',
              border: `2px dashed ${darkMode ? theme.palette.divider : '#e0e0e0'}`
            }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                📋 No active bid requests
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add a new request above to get started
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {bidRequests.map((request) => (
                <BidRequestItem
                  key={request.id}
                  bidRequest={request}
                  onDelete={deleteBidRequest}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}