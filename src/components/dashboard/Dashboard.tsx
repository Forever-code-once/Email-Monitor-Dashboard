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
import { Refresh, Logout, ViewModule, ViewList, Email, Forward, SmartToy, Key } from '@mui/icons-material'
import { getGraphClient, getEmails } from '@/lib/graphClient'
import { isForwardedEmail, extractOriginalSenderFromForwardedEmail, stripHtmlTags, generateTruckId } from '@/lib/emailParser'
import { parseEmailWithAI } from '@/lib/emailParser'
import { EmailMessage, EmailSenderCard, EmailItem, CustomerCard, TruckAvailability, ParsedEmailData } from '@/types'
import { loginRequest } from '@/lib/msalConfig'
import { EmailSenderCard as EmailSenderCardComponent } from './EmailSenderCard'
import { CustomerCard as CustomerCardComponent } from './CustomerCard'
import { EmailModal } from './EmailModal'
import { MapView } from '../map/MapView'
import { EmailWebSocketClient } from '@/lib/websocket'

export function Dashboard() {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [emailSenderCards, setEmailSenderCards] = useState<EmailSenderCard[]>([])
  const [customerCards, setCustomerCards] = useState<CustomerCard[]>([])
  const [rawEmails, setRawEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [aiProgress, setAiProgress] = useState({ processed: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [hasActiveAccount, setHasActiveAccount] = useState(false)
  const [viewMode, setViewMode] = useState<'customers' | 'senders' | 'raw' | 'map'>('map')
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
    console.log('🔌 WebSocket useEffect triggered')
    console.log('Is authenticated:', isAuthenticated)
    console.log('Has active account:', hasActiveAccount)
    
    if (isAuthenticated && hasActiveAccount) {
      console.log('🔌 Attempting WebSocket connection...')
      const wsClient = new EmailWebSocketClient('ws://localhost:8080')
      wsClientRef.current = wsClient

      // Set up WebSocket event listeners
      wsClient.on('connection', async (data: any) => {
        console.log('✅ WebSocket connected:', data.message)
        setWsConnected(true)
        
        console.log('🔍 Checking authentication status...')
        console.log('Is authenticated:', isAuthenticated)
        console.log('Has active account:', hasActiveAccount)
        
        // Send access token to WebSocket server
        try {
          console.log('🔍 Getting active account...')
          const account = instance.getActiveAccount()
          console.log('Active account:', account ? 'Found' : 'Not found')
          
          if (account) {
            console.log('🔍 Acquiring token silently...')
            const response = await instance.acquireTokenSilent({
              ...loginRequest,
              account: account,
            })
            
            console.log('🔑 Token acquired, sending to WebSocket server...')
            wsClient.send({
              type: 'SET_ACCESS_TOKEN',
              data: {
                token: response.accessToken,
                expiresAt: response.expiresOn?.getTime() || (Date.now() + 3600000) // 1 hour default
              }
            })
            
            console.log('✅ Access token sent to WebSocket server')
          } else {
            console.error('❌ No active account found')
          }
        } catch (error) {
          console.error('❌ Failed to send access token to WebSocket server:', error)
        }
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

      wsClient.on('heartbeat', async (data: any) => {
        // Server is alive, update last seen time
        setLastRefresh(new Date(data.timestamp))
        
        // Refresh access token periodically
        try {
          const account = instance.getActiveAccount()
          if (account) {
            const response = await instance.acquireTokenSilent({
              ...loginRequest,
              account: account,
            })
            
            wsClient.send({
              type: 'SET_ACCESS_TOKEN',
              data: {
                token: response.accessToken,
                expiresAt: response.expiresOn?.getTime() || (Date.now() + 3600000)
              }
            })
          }
        } catch (error) {
          console.error('❌ Failed to refresh access token:', error)
        }
      })

      wsClient.on('serverError', (data: any) => {
        console.error('❌ Server error:', data.message)
        setError(`Server error: ${data.message}`)
      })

      wsClient.on('TOKEN_CONFIRMED', (data: any) => {
        console.log('✅ Token confirmed by WebSocket server')
      })

      wsClient.on('pong', (data: any) => {
        console.log('🏓 Pong received from server')
      })

      wsClient.on('tokenConfirmed', (data: any) => {
        console.log('✅ Token confirmed by WebSocket server')
      })

      wsClient.on('error', (error: any) => {
        console.error('❌ WebSocket error:', error)
        setWsConnected(false)
        setError(`WebSocket connection error: ${error.message || 'Connection failed'}`)
      })

      wsClient.on('maxReconnectAttemptsReached', () => {
        console.error('❌ Failed to reconnect to WebSocket server')
        setWsConnected(false)
        setError('⚠️ Lost connection to real-time server. Using manual refresh only.')
      })

      // Add a fallback for when WebSocket fails
      const fallbackTimeout = setTimeout(() => {
        if (!wsConnected) {
          console.log('⚠️ WebSocket connection failed, using manual refresh mode')
          setError('⚠️ Real-time connection failed. Using manual refresh mode.')
        }
      }, 15000) // 15 second fallback

      return () => {
        clearTimeout(fallbackTimeout)
        wsClient.disconnect()
      }

      // Connect to WebSocket
      wsClient.connect()

      return () => {
        wsClient.disconnect()
      }
    }
  }, [isAuthenticated, hasActiveAccount])

  // Process all emails with AI to create customer cards (progressive loading)
  const processAllEmailsWithAI = async (emails: EmailMessage[]) => {
    setAiProcessing(true)
    setAiProgress({ processed: 0, total: emails.length })
    const customerMap = new Map<string, CustomerCard>()

    try {
      // Increased batch size for faster processing
      const batchSize = 8
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
                  parsedData.customer === 'Customer Company Name' ||
                  parsedData.customer === 'Another Customer Company' ||
                  parsedData.customer.includes('TNCC Inc Dispatch') ||
                  email.id?.startsWith('email-')) {
                console.log('🚫 Filtered out simulated data during processing:', parsedData.customer, 'Email:', parsedData.customerEmail)
                return
              }
              
              // Debug: Log real customer data being processed
              console.log('✅ Processing real customer:', parsedData.customer, 'Trucks:', parsedData.trucks?.length || 0)
              
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

        // Update progress and UI progressively after each batch
        setAiProgress({ processed: processedCount, total: emails.length })
        const customerCardsArray = Array.from(customerMap.values()).sort((a, b) => 
          b.lastEmailDate.getTime() - a.lastEmailDate.getTime()
        )
        setCustomerCards(customerCardsArray)

        // Shorter delay between batches for faster processing
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
      }

      // Final update after all batches complete
      const finalCustomerCardsArray = Array.from(customerMap.values()).sort((a, b) => 
        b.lastEmailDate.getTime() - a.lastEmailDate.getTime()
      )

      setCustomerCards(finalCustomerCardsArray)
      
      const totalTrucks = finalCustomerCardsArray.reduce((sum, card) => sum + card.trucks.length, 0)
      console.log(`AI Processing completed: ${finalCustomerCardsArray.length} customers, ${totalTrucks} trucks from ${successCount}/${processedCount} emails`)
      
      // Update success message
      if (successCount > 0) {
        setError(`✅ AI processed ${successCount}/${processedCount} emails successfully! Found ${totalTrucks} trucks from ${finalCustomerCardsArray.length} customers.`)
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
        parsedData.customer === 'Customer Company Name' ||
        parsedData.customer === 'Another Customer Company' ||
        parsedData.customer.includes('TNCC Inc Dispatch') ||
        email.id?.startsWith('email-')) {
      console.log('🚫 Filtered out simulated data:', parsedData.customer, 'Email:', parsedData.customerEmail)
      return
    }
    
    // Debug: Log real customer data being processed
    console.log('✅ Processing real customer in addParsedDataToCustomerCards:', parsedData.customer, 'Trucks:', parsedData.trucks?.length || 0)

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
    
    const emailContent = typeof email.body === 'string' ? email.body : email.body?.content || ''
    const isForwarded = isForwardedEmail(emailContent)
    const originalSender = isForwarded ? extractOriginalSenderFromForwardedEmail(emailContent) : undefined

    const emailItem: EmailItem = {
      id: email.id,
      subject: email.subject,
      bodyPreview: stripHtmlTags(email.bodyPreview || ''),
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
      
      const emailContent = typeof email.body === 'string' ? email.body : email.body?.content || ''
      const isForwarded = isForwardedEmail(emailContent)
      const originalSender = isForwarded ? extractOriginalSenderFromForwardedEmail(emailContent) : undefined

      const emailItem: EmailItem = {
        id: email.id,
        subject: email.subject,
        bodyPreview: stripHtmlTags(email.bodyPreview || ''),
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
      const emails: EmailMessage[] = await getEmails(graphClient, 50) // Reduced for faster initial load
      
      console.log('Fetched emails:', emails.length)
      setRawEmails(emails)

      // Convert emails to sender cards
      const senderCards = convertEmailsToSenderCards(emails)
      setEmailSenderCards(senderCards)

      if (emails.length > 0) {
        const forwardedCount = emails.filter(email => isForwardedEmail(email.body.content)).length
        setError(`✅ Successfully fetched ${emails.length} emails from ${senderCards.length} senders! (${forwardedCount} forwarded)`)
        
        // Show UI immediately, then process AI in background
        setLoading(false)
        
        // Start AI processing in background (non-blocking)
        processAllEmailsWithAI(emails).catch(err => {
          console.error('Background AI processing failed:', err)
          setError('⚠️ Some emails could not be processed for truck data.')
        })
      } else {
        setError('No emails found in the mailbox.')
        setLoading(false)
      }

      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error fetching emails:', err)
      if (err instanceof Error && err.message.includes('No active account')) {
        setError('Authentication issue. Please try signing out and signing in again.')
      } else {
        setError('Failed to fetch emails. Please check your permissions and try again.')
      }
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

  const handleManualCheck = () => {
    if (wsClientRef.current) {
      wsClientRef.current.send({
        type: 'FORCE_CHECK',
        data: {}
      })
      setError('🔍 Manually checking for new emails...')
    }
  }

  const handleTestEmail = () => {
    console.log('🧪 Test email requested')
    console.log('wsClientRef.current:', !!wsClientRef.current)
    
    if (!wsClientRef.current) {
      console.log('🔌 Creating WebSocket connection for test...')
      const wsClient = new EmailWebSocketClient('ws://localhost:8080')
      wsClientRef.current = wsClient
      
      wsClient.on('connection', (data) => {
        console.log('✅ Test connection successful:', data)
        setWsConnected(true)
        // Send test email after connection
        setTimeout(() => {
          wsClient.send({
            type: 'TEST_EMAIL',
            data: {}
          })
          setError('🧪 Processing test email...')
        }, 1000)
      })
      
      wsClient.on('error', (error) => {
        console.error('❌ Test connection error:', error)
        setError(`❌ Test connection failed: ${error.message}`)
      })
      
      wsClient.connect()
      setError('🔌 Connecting for test email...')
      return
    }
    
    const connectionStatus = wsClientRef.current.getConnectionStatus()
    console.log('🔍 Test connection status:', connectionStatus)
    
    if (wsClientRef.current && connectionStatus.connected) {
      console.log('🧪 Sending test email message...')
      wsClientRef.current.send({
        type: 'TEST_EMAIL',
        data: {}
      })
      setError('🧪 Processing test email...')
    } else {
      console.error('❌ WebSocket not connected for test')
      setError('❌ WebSocket not connected for test')
    }
  }

  const handleSendToken = async () => {
    console.log('🔑 Manual token send requested')
    console.log('wsClientRef.current:', !!wsClientRef.current)
    console.log('isAuthenticated:', isAuthenticated)
    console.log('hasActiveAccount:', hasActiveAccount)
    
    if (!wsClientRef.current) {
      console.log('🔌 Creating new WebSocket connection...')
      const wsClient = new EmailWebSocketClient('ws://localhost:8080')
      wsClientRef.current = wsClient
      
      // Add connection event listeners for debugging
      wsClient.on('connection', (data) => {
        console.log('✅ Manual connection successful:', data)
        setWsConnected(true)
        setError('✅ WebSocket connected!')
      })
      
      wsClient.on('error', (error) => {
        console.error('❌ Manual connection error:', error)
        setError(`❌ WebSocket error: ${error.message}`)
      })
      
      wsClient.on('disconnection', (data) => {
        console.log('❌ Manual disconnection:', data)
        setWsConnected(false)
      })
      
      wsClient.connect()
      setError('🔌 Creating new WebSocket connection...')
      return
    }
    
    // Check if WebSocket is connected
    const connectionStatus = wsClientRef.current.getConnectionStatus()
    console.log('🔍 WebSocket connection status:', connectionStatus)
    
    if (!connectionStatus.connected) {
      console.log('🔌 WebSocket not connected, attempting to reconnect...')
      wsClientRef.current.connect()
      setError('🔌 Reconnecting WebSocket...')
      
      // Wait a bit and try again
      setTimeout(() => {
        const newStatus = wsClientRef.current?.getConnectionStatus()
        console.log('🔍 WebSocket connection status after reconnect:', newStatus)
        if (newStatus?.connected) {
          setError('✅ WebSocket reconnected!')
        } else {
          setError('❌ WebSocket reconnection failed')
        }
      }, 2000)
      return
    }
    
    if (wsClientRef.current && isAuthenticated && hasActiveAccount) {
      try {
        console.log('🔍 Manually sending access token...')
        const account = instance.getActiveAccount()
        if (account) {
          const response = await instance.acquireTokenSilent({
            ...loginRequest,
            account: account,
          })
          
          wsClientRef.current.send({
            type: 'SET_ACCESS_TOKEN',
            data: {
              token: response.accessToken,
              expiresAt: response.expiresOn?.getTime() || (Date.now() + 3600000)
            }
          })
          
          setError('🔑 Access token sent manually')
          setTimeout(() => setError(null), 3000)
        }
      } catch (error) {
        console.error('❌ Failed to send token manually:', error)
        setError('❌ Failed to send access token')
      }
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
    console.log('🗑️ Deleting truck with ID:', truckId)
    
    setCustomerCards(prevCards => {
      const updatedCards = prevCards.map(card => {
        const originalTruckCount = card.trucks.length
        const filteredTrucks = card.trucks.filter(truck => {
          const shouldKeep = truck.id !== truckId
          if (!shouldKeep) {
            console.log('🗑️ Found and removing truck:', truck.city, truck.state, truck.date)
          }
          return shouldKeep
        })
        
        if (filteredTrucks.length !== originalTruckCount) {
          console.log(`🗑️ Removed truck from ${card.customer}: ${originalTruckCount} -> ${filteredTrucks.length}`)
        }
        
        return {
          ...card,
          trucks: filteredTrucks,
        }
      }).filter(card => {
        const hasNoTrucks = card.trucks.length === 0
        if (hasNoTrucks) {
          console.log(`🗑️ Removing empty customer card: ${card.customer}`)
        }
        return !hasNoTrucks
      })
      
      console.log('🗑️ Updated customer cards count:', updatedCards.length)
      return updatedCards
    })
  }

  const handleViewEmails = (customerEmail: string) => {
    console.log('🔍 Opening email modal for:', customerEmail)
    
    // Find the customer name
    const customer = customerCards.find(c => c.customerEmail.toLowerCase() === customerEmail.toLowerCase())
    const customerName = customer?.customer || customerEmail.split('@')[0]
    
    // Filter emails for this customer
    console.log('🔍 Filtering emails for customer:', customerEmail)
    console.log('🔍 Total raw emails available:', rawEmails.length)
    console.log('🔍 Raw email addresses:', rawEmails.map(e => e.from.emailAddress.address))
    console.log('🔍 Customer cards:', customerCards.map(c => ({ customer: c.customer, email: c.customerEmail })))
    
    const filteredEmails = rawEmails.filter(email => {
      const matches = email.from.emailAddress.address.toLowerCase() === customerEmail.toLowerCase()
      console.log(`🔍 Email ${email.id}: ${email.from.emailAddress.address} matches ${customerEmail}? ${matches}`)
      return matches
    })
    
    // If no exact matches found, try to find emails that contain the customer name
    if (filteredEmails.length === 0) {
      console.log('🔍 No exact email matches found, trying to find emails containing customer name...')
      const customerName = customer?.customer || customerEmail.split('@')[0]
      const fallbackEmails = rawEmails.filter(email => {
        const emailContent = email.body.content.toLowerCase()
        const emailSubject = email.subject.toLowerCase()
        const containsCustomerName = emailContent.includes(customerName.toLowerCase()) || 
                                   emailSubject.includes(customerName.toLowerCase())
        console.log(`🔍 Fallback check for ${email.id}: contains ${customerName}? ${containsCustomerName}`)
        return containsCustomerName
      })
      
      if (fallbackEmails.length > 0) {
        console.log('🔍 Found fallback emails:', fallbackEmails.length)
        filteredEmails.push(...fallbackEmails)
      } else {
        // If still no emails found, show a message that we'll display all emails
        console.log('🔍 No customer-specific emails found, will show all emails')
        filteredEmails.push(...rawEmails.slice(0, 5)) // Show first 5 emails as fallback
      }
    }
    
    console.log('📧 Found emails for customer:', filteredEmails.length)
    console.log('📧 Email details:', filteredEmails.map(e => ({
      id: e.id,
      subject: e.subject,
      from: e.from.emailAddress.address,
      hasContent: !!e.body.content,
      hasPreview: !!e.bodyPreview
    })))
    
    console.log('🔍 Setting modal state:', { customerName, customerEmail, filteredEmailsCount: filteredEmails.length })
    setSelectedCustomer({ name: customerName, email: customerEmail })
    setCustomerEmails(filteredEmails)
    setEmailModalOpen(true)
    console.log('🔍 Modal should now be open')
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

  const handleAddSampleData = () => {
    // Add sample truck data for testing the map view
    const sampleCustomerCards: CustomerCard[] = [
      {
        customer: 'ABC Trucking Company',
        customerEmail: 'dispatch@abctrucking.com',
        trucks: [
          {
            id: 'truck-1',
            customer: 'ABC Trucking Company',
            customerEmail: 'dispatch@abctrucking.com',
            date: '2024-01-15',
            city: 'Chicago',
            state: 'IL',
            additionalInfo: '53ft dry van available',
            emailId: 'email-1',
            emailSubject: 'Truck Available - Chicago',
            emailDate: new Date('2024-01-15T10:00:00Z'),
            isChecked: false
          },
          {
            id: 'truck-2',
            customer: 'ABC Trucking Company',
            customerEmail: 'dispatch@abctrucking.com',
            date: '2024-01-15',
            city: 'Dallas',
            state: 'TX',
            additionalInfo: '48ft flatbed available',
            emailId: 'email-2',
            emailSubject: 'Truck Available - Dallas',
            emailDate: new Date('2024-01-15T11:00:00Z'),
            isChecked: false
          }
        ],
        lastEmailDate: new Date('2024-01-15T11:00:00Z')
      },
      {
        customer: 'XYZ Logistics',
        customerEmail: 'operations@xyzlogistics.com',
        trucks: [
          {
            id: 'truck-3',
            customer: 'XYZ Logistics',
            customerEmail: 'operations@xyzlogistics.com',
            date: '2024-01-16',
            city: 'Los Angeles',
            state: 'CA',
            additionalInfo: '53ft refrigerated available',
            emailId: 'email-3',
            emailSubject: 'Truck Available - Los Angeles',
            emailDate: new Date('2024-01-16T09:00:00Z'),
            isChecked: false
          },
          {
            id: 'truck-4',
            customer: 'XYZ Logistics',
            customerEmail: 'operations@xyzlogistics.com',
            date: '2024-01-16',
            city: 'Phoenix',
            state: 'AZ',
            additionalInfo: '48ft dry van available',
            emailId: 'email-4',
            emailSubject: 'Truck Available - Phoenix',
            emailDate: new Date('2024-01-16T10:00:00Z'),
            isChecked: false
          }
        ],
        lastEmailDate: new Date('2024-01-16T10:00:00Z')
      },
      {
        customer: 'Fast Freight Solutions',
        customerEmail: 'dispatch@fastfreight.com',
        trucks: [
          {
            id: 'truck-5',
            customer: 'Fast Freight Solutions',
            customerEmail: 'dispatch@fastfreight.com',
            date: '2024-01-17',
            city: 'New York',
            state: 'NY',
            additionalInfo: '53ft dry van available',
            emailId: 'email-5',
            emailSubject: 'Truck Available - New York',
            emailDate: new Date('2024-01-17T08:00:00Z'),
            isChecked: false
          },
          {
            id: 'truck-6',
            customer: 'Fast Freight Solutions',
            customerEmail: 'dispatch@fastfreight.com',
            date: '2024-01-17',
            city: 'Miami',
            state: 'FL',
            additionalInfo: '48ft flatbed available',
            emailId: 'email-6',
            emailSubject: 'Truck Available - Miami',
            emailDate: new Date('2024-01-17T09:00:00Z'),
            isChecked: false
          }
        ],
        lastEmailDate: new Date('2024-01-17T09:00:00Z')
      }
    ]
    
    setCustomerCards(sampleCustomerCards)
    setError('✅ Sample truck data added for testing. You can now test the map view.')
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
                  checked={viewMode === 'map'}
                  onChange={(e) => setViewMode(e.target.checked ? 'map' : 'senders')}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {viewMode === 'map' ? <SmartToy /> : <ViewModule />}
                  <Typography variant="body2">
                                          {viewMode === 'map' ? 'Map View' : 'Senders'}
                  </Typography>
                </Box>
              }
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
          const modes: Array<'customers' | 'senders' | 'raw' | 'map'> = ['map', 'customers', 'senders', 'raw']
          const currentIndex = modes.indexOf(viewMode)
          const nextIndex = (currentIndex + 1) % modes.length
          setViewMode(modes[nextIndex])
        }}
              sx={{ textTransform: 'none' }}
            >
              Switch View
            </Button>
            {viewMode === 'map' && customerCards.length > 0 && (
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
            {viewMode === 'map' && customerCards.length === 0 && (
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={handleAddSampleData}
                sx={{ textTransform: 'none' }}
              >
                🧪 Add Sample Data
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
              {!wsConnected && (
                <Typography variant="caption" color="warning.main">
                  (Click refresh to retry)
                </Typography>
              )}
            </Box>
            <IconButton 
              color="inherit" 
              onClick={handleSendToken} 
              disabled={false} 
              title="Send Access Token / Test Connection"
              sx={{ 
                color: 'inherit',
                opacity: 1
              }}
            >
              <Key />
            </IconButton>
            <IconButton 
              color="inherit" 
              onClick={() => {
                console.log('🧪 Testing email modal...')
                setSelectedCustomer({ name: 'Test Customer', email: 'test@example.com' })
                setCustomerEmails([{
                  id: 'test-email-1',
                  subject: 'Test Email Subject',
                  bodyPreview: 'This is a test email preview',
                  body: {
                    content: 'This is the full content of the test email.\n\nIt has multiple lines and should display properly in the modal.',
                    contentType: 'text/plain'
                  },
                  from: {
                    emailAddress: {
                      address: 'test@example.com',
                      name: 'Test Customer'
                    }
                  },
                  receivedDateTime: new Date().toISOString()
                }])
                setEmailModalOpen(true)
              }}
              title="Test Email Modal"
              sx={{ 
                color: 'inherit',
                opacity: 1
              }}
            >
              <Email />
            </IconButton>

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

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Fetching emails...
          </Typography>
        </Box>
      ) : (
        <>
          {aiProcessing && (
            <Card sx={{ mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <CardContent sx={{ py: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={24} color="inherit" />
                  <Typography variant="body1">
                    🤖 AI Processing: {aiProgress.processed}/{aiProgress.total} emails
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Customer cards will update automatically...
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}
          
          <Box sx={{ mb: 3 }}>
                    <Typography variant="h5" gutterBottom>
          {viewMode === 'map' ? 'Truck Availability Map' :
           viewMode === 'customers' ? 'AI-Parsed Truck Availability' :
           viewMode === 'senders' ? 'Live Email Feed Dashboard' :
           'Raw Email Feed'}
        </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              {viewMode === 'map' ? (
                <>
                  <Typography variant="body1" color="text.secondary">
                    {customerCards.length} customers • {totalTrucks} trucks available • Interactive map view
                  </Typography>
                  {totalCheckedTrucks > 0 && (
                    <Chip 
                      label={`${totalCheckedTrucks} checked`}
                      size="small"
                      color="success"
                    />
                  )}
                </>
              ) : viewMode === 'customers' ? (
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

          {viewMode === 'map' ? (
            <MapView
              customerCards={customerCards}
              onViewEmails={handleViewEmails}
            />
          ) : viewMode === 'customers' ? (
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