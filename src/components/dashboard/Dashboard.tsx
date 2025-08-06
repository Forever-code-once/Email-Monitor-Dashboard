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
import { Refresh, Logout, ViewModule, ViewList, Email, Forward, SmartToy } from '@mui/icons-material'
import { getGraphClient, getEmails } from '@/lib/graphClient'
import { isForwardedEmail, extractOriginalSenderFromForwardedEmail, stripHtmlTags, generateTruckId } from '@/lib/emailParser'
import { parseEmailWithAI } from '@/lib/emailParser'
import { EmailMessage, EmailSenderCard, EmailItem, CustomerCard, TruckAvailability, ParsedEmailData } from '@/types'
import { EmailSenderCard as EmailSenderCardComponent } from './EmailSenderCard'
import { CustomerCard as CustomerCardComponent } from './CustomerCard'
import { EmailModal } from './EmailModal'
import { EmailWebSocketClient } from '@/lib/websocket'

export function Dashboard() {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [emailSenderCards, setEmailSenderCards] = useState<EmailSenderCard[]>([])
  const [customerCards, setCustomerCards] = useState<CustomerCard[]>([])
  const [rawEmails, setRawEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [hasActiveAccount, setHasActiveAccount] = useState(false)
  const [viewMode, setViewMode] = useState<'customers' | 'senders' | 'raw'>('customers')
  const [wsConnected, setWsConnected] = useState(false)
  
  const wsClientRef = useRef<EmailWebSocketClient | null>(null)
  
  // Modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<{ name: string; email: string } | null>(null)
  const [customerEmails, setCustomerEmails] = useState<EmailMessage[]>([])

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
    
    // Clear any simulated data on component mount
    setCustomerCards([])
  }, [isAuthenticated, accounts, instance])

  // Initialize WebSocket connection
  useEffect(() => {
    if (isAuthenticated && hasActiveAccount) {
      const wsClient = new EmailWebSocketClient('ws://localhost:8080')
      wsClientRef.current = wsClient

      // Set up WebSocket event listeners
      wsClient.on('connection', (data: any) => {
        console.log('✅ WebSocket connected:', data.message)
        setWsConnected(true)
      })

      wsClient.on('disconnection', (data: any) => {
        console.log('❌ WebSocket disconnected')
        setWsConnected(false)
      })

      wsClient.on('newEmail', (data: any) => {
        console.log('📧 New email received via WebSocket:', data.email.subject)
        const { email, aiProcessed } = data
        
        // Add raw email to the list
        setRawEmails(prev => [email, ...prev])
        
        // Add to sender cards
        addEmailToSenderCards(email)
        
        // If AI processed successfully, add to customer cards
        if (aiProcessed && aiProcessed.trucks.length > 0) {
          addParsedDataToCustomerCards(email, aiProcessed)
        }
        
        setLastRefresh(new Date())
        
        // Show notification
        setError(`🔔 New email received: ${email.subject}`)
        setTimeout(() => setError(null), 5000) // Clear after 5 seconds
      })

      wsClient.on('monitoringStatus', (data: any) => {
        console.log('🔄 Monitoring status changed:', data.active ? 'Active' : 'Inactive')
      })

      wsClient.on('serverStatus', (data: any) => {
        console.log('📊 Server status:', data)
      })

      wsClient.on('heartbeat', (data: any) => {
        // Server is alive, update last seen time
        setLastRefresh(new Date(data.timestamp))
      })

      wsClient.on('serverError', (data: any) => {
        console.error('❌ Server error:', data.message)
        setError(`Server error: ${data.message}`)
      })

      wsClient.on('error', (error: any) => {
        console.error('❌ WebSocket error:', error)
        setWsConnected(false)
      })

      wsClient.on('maxReconnectAttemptsReached', () => {
        console.error('❌ Failed to reconnect to WebSocket server')
        setWsConnected(false)
        setError('⚠️ Lost connection to real-time server. Using manual refresh only.')
      })

      // Connect to WebSocket
      wsClient.connect()

      return () => {
        wsClient.disconnect()
      }
    }
  }, [isAuthenticated, hasActiveAccount])

  // Process all emails with AI to create customer cards (for initial load)
  const processAllEmailsWithAI = async (emails: EmailMessage[]) => {
    setAiProcessing(true)
    const customerMap = new Map<string, CustomerCard>()

    try {
      // Reduced batch size to prevent API overload
      const batchSize = 3
      let processedCount = 0
      let successCount = 0
      
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize)
        
        const promises = batch.map(async (email) => {
          try {
            const parsedDataArray = await parseEmailWithAI(email)
            // parseEmailWithAI now returns an array
            if (parsedDataArray && Array.isArray(parsedDataArray) && parsedDataArray.length > 0) {
              // Return each customer as a separate result
              return parsedDataArray.map(parsedData => ({ email, parsedData }))
            }
          } catch (error) {
            console.error(`Error parsing email ${email.id}:`, error)
          }
          return null
        })

        const results = await Promise.allSettled(promises)
        
        // Process results
        results.forEach((result, index) => {
          processedCount++
          
          if (result.status === 'fulfilled' && result.value) {
            // result.value is now an array of { email, parsedData } objects
            const emailResults = Array.isArray(result.value) ? result.value : [result.value]
            
            emailResults.forEach(({ email, parsedData }) => {
            
              // Filter out simulated data
              if (parsedData.customer === 'Company Name' || 
                  parsedData.customerEmail === 'email@domain.com' ||
                  parsedData.customer.includes('TNCC Inc Dispatch') ||
                  email.id?.startsWith('email-')) {
                console.log('🚫 Filtered out simulated data during processing:', parsedData.customer)
                return
              }
              
              // Only process if we have trucks
              if (!parsedData.trucks || !Array.isArray(parsedData.trucks) || parsedData.trucks.length === 0) {
                return
              }
              
              successCount++
              const customerKey = parsedData.customerEmail.toLowerCase()
              
              const trucks: TruckAvailability[] = parsedData.trucks.map(truck => ({
              id: generateTruckId(email, truck.city, truck.state, truck.date),
              customer: parsedData.customer,
              customerEmail: parsedData.customerEmail,
              date: truck.date,
              city: truck.city,
              state: truck.state,
              additionalInfo: truck.additionalInfo,
              emailId: email.id,
              emailSubject: email.subject,
              emailDate: new Date(email.receivedDateTime),
              isChecked: false
            }))

            if (customerMap.has(customerKey)) {
              const existingCard = customerMap.get(customerKey)!
              // Add new trucks, avoiding duplicates
              const newTrucks = trucks.filter(truck => 
                !existingCard.trucks.some(existingTruck => existingTruck.id === truck.id)
              )
              existingCard.trucks.push(...newTrucks)
              
              // Update last email date if newer
              const emailDate = new Date(email.receivedDateTime)
              if (emailDate > existingCard.lastEmailDate) {
                existingCard.lastEmailDate = emailDate
              }
            } else {
              customerMap.set(customerKey, {
                customer: parsedData.customer,
                customerEmail: parsedData.customerEmail,
                trucks: trucks,
                lastEmailDate: new Date(email.receivedDateTime)
              })
            }
            })
          }
        })

        // Add a longer delay between batches to respect API limits
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // Convert map to array and sort
      const customerCardsArray = Array.from(customerMap.values()).sort((a, b) => 
        b.lastEmailDate.getTime() - a.lastEmailDate.getTime()
      )

      setCustomerCards(customerCardsArray)
      
      const totalTrucks = customerCardsArray.reduce((sum, card) => sum + card.trucks.length, 0)
      console.log(`AI Processing completed: ${customerCardsArray.length} customers, ${totalTrucks} trucks from ${successCount}/${processedCount} emails`)
      
      // Update success message
      if (successCount > 0) {
        setError(`✅ AI processed ${successCount}/${processedCount} emails successfully! Found ${totalTrucks} trucks from ${customerCardsArray.length} customers.`)
      } else {
        setError('⚠️ AI processing completed but no truck availability data was found in the emails.')
      }
      
    } catch (error) {
      console.error('Error processing emails with AI:', error)
      setError('Failed to process emails with AI. Some emails may be too long or contain unsupported content.')
    } finally {
      setAiProcessing(false)
    }
  }

  // Add parsed data to customer cards (moved from processAllEmailsWithAI)
  const addParsedDataToCustomerCards = (email: EmailMessage, parsedData: ParsedEmailData) => {
    // Filter out simulated data
    if (parsedData.customer === 'Company Name' || 
        parsedData.customerEmail === 'email@domain.com' ||
        parsedData.customer.includes('TNCC Inc Dispatch') ||
        email.id?.startsWith('email-')) {
      console.log('🚫 Filtered out simulated data:', parsedData.customer)
      return
    }

    const trucks: TruckAvailability[] = parsedData.trucks.map(truck => ({
      id: generateTruckId(email, truck.city, truck.state, truck.date),
      customer: parsedData.customer,
      customerEmail: parsedData.customerEmail,
      date: truck.date,
      city: truck.city,
      state: truck.state,
      additionalInfo: truck.additionalInfo,
      emailId: email.id,
      emailSubject: email.subject,
      emailDate: new Date(email.receivedDateTime),
      isChecked: false
    }))

    setCustomerCards(prev => {
      const updated = [...prev]
      const existingCustomerIndex = updated.findIndex(
        card => card.customerEmail.toLowerCase() === parsedData.customerEmail.toLowerCase()
      )

      if (existingCustomerIndex >= 0) {
        // Add trucks to existing customer
        const existingCard = updated[existingCustomerIndex]
        const newTrucks = trucks.filter(truck => 
          !existingCard.trucks.some(existingTruck => existingTruck.id === truck.id)
        )
        
        if (newTrucks.length > 0) {
          updated[existingCustomerIndex] = {
            ...existingCard,
            trucks: [...existingCard.trucks, ...newTrucks],
            lastEmailDate: new Date(email.receivedDateTime)
          }
        }
      } else {
        // Create new customer card
        updated.push({
          customer: parsedData.customer,
          customerEmail: parsedData.customerEmail,
          trucks: trucks,
          lastEmailDate: new Date(email.receivedDateTime)
        })
      }

      // Sort by last email date
      return updated.sort((a, b) => 
        b.lastEmailDate.getTime() - a.lastEmailDate.getTime()
      )
    })
  }

  // Add a new email to existing sender cards (moved from original location)
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

      // Process emails with AI for customer cards (initial load)
      await processAllEmailsWithAI(emails)

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
    instance.logoutPopup()
  }

  const handleRefresh = () => {
    if (isAuthenticated && hasActiveAccount) {
      // Clear existing customer cards to remove any simulated data
      setCustomerCards([])
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

  const handleViewEmails = (customerEmail: string) => {
    // Find the customer name
    const customer = customerCards.find(c => c.customerEmail.toLowerCase() === customerEmail.toLowerCase())
    const customerName = customer?.customer || customerEmail.split('@')[0]
    
    // Filter emails for this customer
    const filteredEmails = rawEmails.filter(email => 
      email.from.emailAddress.address.toLowerCase() === customerEmail.toLowerCase()
    )
    
    setSelectedCustomer({ name: customerName, email: customerEmail })
    setCustomerEmails(filteredEmails)
    setEmailModalOpen(true)
  }

  const handleCloseEmailModal = () => {
    setEmailModalOpen(false)
    setSelectedCustomer(null)
    setCustomerEmails([])
  }

  const handleClearSampleData = () => {
    // Clear all data to remove any simulated content
    setCustomerCards([])
    setEmailSenderCards([])
    setRawEmails([])
    setError('✅ All data cleared. Refresh to load only real email data.')
    setTimeout(() => setError(null), 5000)
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
  const totalCheckedEmails = emailSenderCards.reduce((sum, card) => 
    sum + card.emails.filter(email => email.isChecked).length, 0)
  const totalForwarded = emailSenderCards.reduce((sum, card) => 
    sum + card.emails.filter(email => email.isForwarded).length, 0)

  const totalTrucks = customerCards.reduce((sum, card) => sum + card.trucks.length, 0)
  const totalCheckedTrucks = customerCards.reduce((sum, card) => 
    sum + card.trucks.filter(truck => truck.isChecked).length, 0)

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
                  checked={viewMode === 'customers'}
                  onChange={(e) => setViewMode(e.target.checked ? 'customers' : 'senders')}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {viewMode === 'customers' ? <SmartToy /> : <ViewModule />}
                  <Typography variant="body2">
                    {viewMode === 'customers' ? 'AI Parsed' : 'Senders'}
                  </Typography>
                </Box>
              }
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => setViewMode(viewMode === 'customers' ? 'senders' : viewMode === 'senders' ? 'raw' : 'customers')}
              sx={{ textTransform: 'none' }}
            >
              Switch View
            </Button>
            {viewMode === 'customers' && customerCards.length > 0 && (
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={handleClearSampleData}
                sx={{ textTransform: 'none' }}
              >
                🗑️ Clear All Data
              </Button>
            )}
            <Typography variant="body2">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box 
                sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  backgroundColor: wsConnected ? 'success.main' : 'error.main',
                  animation: wsConnected ? 'pulse 2s infinite' : 'none'
                }} 
              />
              <Typography variant="body2" color={wsConnected ? 'success.main' : 'error.main'}>
                {wsConnected ? 'Real-time Active' : 'Manual Refresh Only'}
              </Typography>
            </Box>
            <IconButton color="inherit" onClick={handleRefresh} disabled={loading || aiProcessing}>
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

      {(loading || aiProcessing) ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>
            {loading ? 'Fetching emails...' : 'Processing emails with AI...'}
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              {viewMode === 'customers' ? 'AI-Parsed Truck Availability' : 
               viewMode === 'senders' ? 'Live Email Feed Dashboard' : 
               'Raw Email Feed'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              {viewMode === 'customers' ? (
                <>
              <Typography variant="body1" color="text.secondary">
                    {customerCards.length} customers • {totalTrucks} trucks available
              </Typography>
                  {totalCheckedTrucks > 0 && (
              <Chip 
                      label={`${totalCheckedTrucks} checked`}
                size="small"
                      color="success"
                    />
                  )}
                </>
              ) : (
                <>
                  <Typography variant="body1" color="text.secondary">
                    {viewMode === 'senders' ? emailSenderCards.length : rawEmails.length} {viewMode === 'senders' ? 'senders' : 'emails'} 
                    {viewMode === 'senders' && ` • ${totalEmails} emails`}
                  </Typography>
                  {viewMode === 'senders' && totalCheckedEmails > 0 && (
                <Chip
                      label={`${totalCheckedEmails} checked`}
                  size="small"
                  color="success"
                />
              )}
                  {viewMode === 'senders' && totalForwarded > 0 && (
                <Chip
                  label={`${totalForwarded} forwarded`}
                  size="small"
                  color="secondary"
                />
                  )}
                </>
              )}
            </Box>
          </Box>

          {viewMode === 'customers' ? (
            customerCards.length > 0 ? (
              <Grid container spacing={3}>
                {customerCards.map((customer) => (
                  <Grid item xs={12} md={6} lg={4} key={customer.customerEmail}>
                    <CustomerCardComponent
                      customer={customer}
                      onCheckTruck={handleCheckTruck}
                      onDeleteTruck={handleDeleteTruck}
                      onViewEmails={handleViewEmails}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography color="text.secondary" align="center">
                No truck availability data found. AI will process incoming emails to extract truck information.
              </Typography>
            )
          ) : viewMode === 'senders' ? (
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
                        <Card>
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
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>

      <EmailModal
        open={emailModalOpen}
        onClose={handleCloseEmailModal}
        customerName={selectedCustomer?.name || ''}
        customerEmail={selectedCustomer?.email || ''}
        emails={customerEmails}
      />
    </Box>
  )
} 