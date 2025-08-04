'use client'

import { useState, useEffect, useRef } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  Card,
  CardContent,
  Chip,
} from '@mui/material'
import { Refresh, Logout, Email, Forward, WifiTethering, WifiTetheringOff } from '@mui/icons-material'
import { getGraphClient, getEmails } from '@/lib/graphClient'
import { parseEmailWithAI, extractCustomerName, generateTruckId, isForwardedEmail, extractOriginalSenderFromForwardedEmail, stripHtmlTags } from '@/lib/emailParser'
import { CustomerCard as CustomerCardType, TruckAvailability, EmailMessage } from '@/types'
import { CustomerCard } from './CustomerCard'
import { EmailWebSocketClient } from '@/lib/websocket'

export function Dashboard() {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [customerCards, setCustomerCards] = useState<CustomerCardType[]>([])
  const [rawEmails, setRawEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [hasActiveAccount, setHasActiveAccount] = useState(false)
  const [showRawEmails, setShowRawEmails] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  
  const wsClientRef = useRef<EmailWebSocketClient | null>(null)

  // Check for active account whenever authentication state changes
  useEffect(() => {
    const checkActiveAccount = () => {
      const activeAccount = instance.getActiveAccount()
      setHasActiveAccount(!!activeAccount)
      
      // If we have accounts but no active account, set the first one as active
      if (!activeAccount && accounts.length > 0) {
        instance.setActiveAccount(accounts[0])
        setHasActiveAccount(true)
      }
    }

    checkActiveAccount()
  }, [isAuthenticated, accounts, instance])

  // Initialize WebSocket connection
  useEffect(() => {
    if (isAuthenticated && hasActiveAccount) {
      const wsClient = new EmailWebSocketClient('ws://localhost:8080')
      wsClientRef.current = wsClient

      // Set up WebSocket event listeners
      wsClient.on('connection', (data: any) => {
        setWsConnected(data.status === 'connected')
        if (data.status === 'connected') {
          console.log('WebSocket connected for real-time email updates')
          wsClient.send({
            type: 'START_EMAIL_MONITORING',
            data: {}
          })
        }
      })

      wsClient.on('newEmail', (email: EmailMessage) => {
        console.log('New email received via WebSocket:', email)
        setRawEmails(prev => [email, ...prev]) // Add new email to the top
        setLastRefresh(new Date())
        
        // You could also trigger AI parsing here if needed
        // parseNewEmail(email)
      })

      wsClient.on('emailUpdate', (data: any) => {
        console.log('Email update received:', data)
        // Handle email updates if needed
      })

      // Connect to WebSocket
      wsClient.connect()

      return () => {
        wsClient.disconnect()
      }
    }
  }, [isAuthenticated, hasActiveAccount])

  const fetchAndProcessEmails = async () => {
    // Double-check authentication before proceeding
    const activeAccount = instance.getActiveAccount()
    if (!isAuthenticated || !activeAccount) {
      setError('Please sign in to access your emails.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const graphClient = getGraphClient(instance as any)
      const emails: EmailMessage[] = await getEmails(graphClient, 100)
      
      console.log('Fetched emails:', emails.length)
      setRawEmails(emails)

      // For now, let's skip AI parsing and show raw email data
      if (emails.length > 0) {
        const forwardedCount = emails.filter(email => isForwardedEmail(email.body.content)).length
        setError(`✅ Successfully fetched ${emails.length} emails! (${forwardedCount} forwarded) `)
        setShowRawEmails(true)
      } else {
        setError('No emails found in the mailbox.')
      }

      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error fetching emails:', err)
      if (err instanceof Error && err.message.includes('No active account')) {
        setError('Authentication issue. Please try signing out and signing in again.')
      } else {
        setError('Failed to fetch emails. Please check your permissions and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial email fetch when authenticated
    if (isAuthenticated && hasActiveAccount) {
      const timer = setTimeout(() => {
        fetchAndProcessEmails()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, hasActiveAccount])

  const handleLogout = () => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect()
    }
    instance.logoutPopup()
  }

  const handleRefresh = () => {
    if (isAuthenticated && hasActiveAccount) {
      fetchAndProcessEmails()
    }
  }

  const handleCheckTruck = (truckId: string) => {
    setCustomerCards(prevCards =>
      prevCards.map(card => ({
        ...card,
        trucks: card.trucks.map(truck =>
          truck.id === truckId ? { ...truck, isChecked: !truck.isChecked } : truck
        ),
      }))
    )
  }

  const handleDeleteTruck = (truckId: string) => {
    setCustomerCards(prevCards =>
      prevCards.map(card => ({
        ...card,
        trucks: card.trucks.filter(truck => truck.id !== truckId),
      })).filter(card => card.trucks.length > 0)
    )
  }

  // Show loading state while authentication is being established
  if (!isAuthenticated || !hasActiveAccount) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          {!isAuthenticated ? 'Authenticating...' : 'Setting up account...'}
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <AppBar position="static" elevation={0} sx={{ mb: 3 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Email Monitor Dashboard
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {wsConnected ? (
                <WifiTethering color="success" />
              ) : (
                <WifiTetheringOff color="error" />
              )}
              <Typography variant="body2">
                {wsConnected ? 'Live' : 'Offline'}
              </Typography>
            </Box>
            <Typography variant="body2">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
            <IconButton color="inherit" onClick={handleRefresh} disabled={loading}>
              <Refresh />
            </IconButton>
            <IconButton color="inherit" onClick={handleLogout}>
              <Logout />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {error && (
        <Alert 
          severity={error.includes('✅') ? 'success' : 'error'} 
          sx={{ mb: 3 }} 
          action={
            !error.includes('✅') && (
              <Button color="inherit" size="small" onClick={handleLogout}>
                Sign Out & Retry
              </Button>
            )
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Fetching emails...
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              Email Monitor Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {showRawEmails ? (
                <>
                  {rawEmails.length} emails loaded - 
                  <Chip 
                    icon={wsConnected ? <WifiTethering /> : <WifiTetheringOff />}
                    label={wsConnected ? "Real-time updates active" : "Real-time updates offline"}
                    size="small"
                    color={wsConnected ? "success" : "error"}
                    sx={{ ml: 1 }}
                  />
                </>
              ) : 'No data to display'}
            </Typography>
          </Box>

          {showRawEmails && rawEmails.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                📧 Real-time Email Feed ({rawEmails.length} emails):
              </Typography>
              <Grid container spacing={2}>
                {rawEmails.map((email, index) => {
                  const isForwarded = isForwardedEmail(email.body.content)
                  const originalSender = isForwarded ? extractOriginalSenderFromForwardedEmail(email.body.content) : null
                  const isNew = index === 0 && (new Date().getTime() - new Date(email.receivedDateTime).getTime()) < 30000 // Less than 30 seconds old
                  
                  return (
                    <Grid item xs={12} md={6} lg={4} key={email.id}>
                      <Card sx={{ 
                        animation: isNew ? 'pulse 2s ease-in-out' : 'none',
                        border: isNew ? '2px solid #4caf50' : 'none'
                      }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Email sx={{ fontSize: 16 }} />
                            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                              {email.subject}
                            </Typography>
                            {isNew && (
                              <Chip 
                                label="NEW" 
                                size="small" 
                                color="success"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            )}
                            {isForwarded && (
                              <Chip 
                                icon={<Forward />} 
                                label="Forwarded" 
                                size="small" 
                                color="secondary" 
                              />
                            )}
                          </Box>
                          
                          <Typography variant="body2" color="text.secondary">
                            <strong>From (Forwarder):</strong> {email.from.emailAddress.name} ({email.from.emailAddress.address})
                          </Typography>
                          
                          {isForwarded && originalSender && (
                            <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                              <strong>Original Customer:</strong> {originalSender.name} ({originalSender.email})
                            </Typography>
                          )}
                          
                          <Typography variant="body2" color="text.secondary">
                            <strong>Date:</strong> {new Date(email.receivedDateTime).toLocaleString()}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Preview:</strong> {stripHtmlTags(email.bodyPreview).substring(0, 100)}...
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )
                })}
              </Grid>
            </Box>
          )}

          {customerCards.length > 0 && (
            <Grid container spacing={3}>
              {customerCards.map((customer) => (
                <Grid item xs={12} md={6} lg={4} key={customer.customerEmail}>
                  <CustomerCard
                    customer={customer}
                    onCheckTruck={handleCheckTruck}
                    onDeleteTruck={handleDeleteTruck}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
          100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
        }
      `}</style>
    </Box>
  )
} 