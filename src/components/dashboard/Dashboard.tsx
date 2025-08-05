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
  Chip,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
} from '@mui/material'
import { Refresh, Logout, WifiTethering, WifiTetheringOff, ViewModule, ViewList, Email, Forward } from '@mui/icons-material'
import { getGraphClient, getEmails } from '@/lib/graphClient'
import { isForwardedEmail, extractOriginalSenderFromForwardedEmail, stripHtmlTags } from '@/lib/emailParser'
import { EmailMessage, EmailSenderCard, EmailItem } from '@/types'
import { EmailSenderCard as EmailSenderCardComponent } from './EmailSenderCard'
import { EmailWebSocketClient } from '@/lib/websocket'

export function Dashboard() {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [emailSenderCards, setEmailSenderCards] = useState<EmailSenderCard[]>([])
  const [rawEmails, setRawEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [hasActiveAccount, setHasActiveAccount] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'raw'>('cards')
  
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
        
        // Update sender cards with new email
        addEmailToSenderCards(email)
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

  // Convert raw emails to sender cards
  const convertEmailsToSenderCards = (emails: EmailMessage[]): EmailSenderCard[] => {
    const senderMap = new Map<string, EmailSenderCard>()

    emails.forEach(email => {
      const senderEmail = email.from.emailAddress.address
      const senderName = email.from.emailAddress.name || email.from.emailAddress.address
      
      const isForwarded = isForwardedEmail(email.body.content)
      const originalSender = isForwarded ? extractOriginalSenderFromForwardedEmail(email.body.content) : undefined

      const emailItem: EmailItem = {
        id: email.id,
        subject: email.subject,
        bodyPreview: stripHtmlTags(email.bodyPreview),
        receivedDateTime: email.receivedDateTime,
        isChecked: false,
        isForwarded,
        originalSender: originalSender || undefined
      }

      if (senderMap.has(senderEmail)) {
        const senderCard = senderMap.get(senderEmail)!
        senderCard.emails.push(emailItem)
        senderCard.totalEmails++
        
        // Update last email date if this email is newer
        const emailDate = new Date(email.receivedDateTime)
        if (emailDate > senderCard.lastEmailDate) {
          senderCard.lastEmailDate = emailDate
        }
      } else {
        senderMap.set(senderEmail, {
          senderName,
          senderEmail,
          emails: [emailItem],
          lastEmailDate: new Date(email.receivedDateTime),
          totalEmails: 1
        })
      }
    })

    // Sort sender cards by last email date (newest first)
    return Array.from(senderMap.values()).sort((a, b) => 
      b.lastEmailDate.getTime() - a.lastEmailDate.getTime()
    )
  }

  // Add a new email to existing sender cards
  const addEmailToSenderCards = (email: EmailMessage) => {
    const senderEmail = email.from.emailAddress.address
    const senderName = email.from.emailAddress.name || email.from.emailAddress.address
    
    const isForwarded = isForwardedEmail(email.body.content)
    const originalSender = isForwarded ? extractOriginalSenderFromForwardedEmail(email.body.content) : undefined

    const emailItem: EmailItem = {
      id: email.id,
      subject: email.subject,
      bodyPreview: stripHtmlTags(email.bodyPreview),
      receivedDateTime: email.receivedDateTime,
      isChecked: false,
      isForwarded,
      originalSender: originalSender || undefined
    }

    setEmailSenderCards(prev => {
      const updated = [...prev]
      const existingSenderIndex = updated.findIndex(card => card.senderEmail === senderEmail)
      
      if (existingSenderIndex >= 0) {
        // Add to existing sender
        updated[existingSenderIndex].emails.unshift(emailItem) // Add to front
        updated[existingSenderIndex].totalEmails++
        updated[existingSenderIndex].lastEmailDate = new Date(email.receivedDateTime)
      } else {
        // Create new sender card
        updated.unshift({
          senderName,
          senderEmail,
          emails: [emailItem],
          lastEmailDate: new Date(email.receivedDateTime),
          totalEmails: 1
        })
      }

      // Re-sort by last email date
      return updated.sort((a, b) => 
        b.lastEmailDate.getTime() - a.lastEmailDate.getTime()
      )
    })
  }

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

      // Convert emails to sender cards
      const senderCards = convertEmailsToSenderCards(emails)
      setEmailSenderCards(senderCards)

      if (emails.length > 0) {
        const forwardedCount = emails.filter(email => isForwardedEmail(email.body.content)).length
        setError(`✅ Successfully fetched ${emails.length} emails from ${senderCards.length} senders! (${forwardedCount} forwarded)`)
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

  const handleCheckEmail = (emailId: string) => {
    setEmailSenderCards(prevCards =>
      prevCards.map(card => ({
        ...card,
        emails: card.emails.map(email =>
          email.id === emailId ? { ...email, isChecked: !email.isChecked } : email
        ),
      }))
    )
  }

  const handleDeleteEmail = (emailId: string) => {
    setEmailSenderCards(prevCards =>
      prevCards.map(card => ({
        ...card,
        emails: card.emails.filter(email => email.id !== emailId),
        totalEmails: card.emails.filter(email => email.id !== emailId).length,
      })).filter(card => card.emails.length > 0)
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

  const totalEmails = emailSenderCards.reduce((sum, card) => sum + card.totalEmails, 0)
  const totalChecked = emailSenderCards.reduce((sum, card) => 
    sum + card.emails.filter(email => email.isChecked).length, 0)
  const totalForwarded = emailSenderCards.reduce((sum, card) => 
    sum + card.emails.filter(email => email.isForwarded).length, 0)

  return (
    <Box>
      <AppBar position="static" elevation={0} sx={{ mb: 3 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Email Monitor Dashboard
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={viewMode === 'cards'}
                  onChange={(e) => setViewMode(e.target.checked ? 'cards' : 'raw')}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {viewMode === 'cards' ? <ViewModule /> : <ViewList />}
                  <Typography variant="body2">
                    {viewMode === 'cards' ? 'Card View' : 'List View'}
                  </Typography>
                </Box>
              }
            />
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
              Live Email Feed Dashboard
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {emailSenderCards.length} senders • {totalEmails} emails
              </Typography>
              <Chip 
                icon={wsConnected ? <WifiTethering /> : <WifiTetheringOff />}
                label={wsConnected ? "Live updates active" : "Offline"}
                size="small"
                color={wsConnected ? "success" : "error"}
              />
              {totalChecked > 0 && (
                <Chip
                  label={`${totalChecked} checked`}
                  size="small"
                  color="success"
                />
              )}
              {totalForwarded > 0 && (
                <Chip
                  label={`${totalForwarded} forwarded`}
                  size="small"
                  color="secondary"
                />
              )}
            </Box>
          </Box>

          {viewMode === 'cards' ? (
            emailSenderCards.length > 0 ? (
              <Grid container spacing={3}>
                {emailSenderCards.map((senderCard) => (
                  <Grid item xs={12} md={6} lg={4} key={senderCard.senderEmail}>
                    <EmailSenderCardComponent
                      senderCard={senderCard}
                      onCheckEmail={handleCheckEmail}
                      onDeleteEmail={handleDeleteEmail}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography color="text.secondary" align="center">
                No emails to display
              </Typography>
            )
          ) : (
            rawEmails.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  📧 Raw Email Feed ({rawEmails.length} emails):
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
                              <strong>From:</strong> {email.from.emailAddress.name} ({email.from.emailAddress.address})
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
            )
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