import { EmailMessage } from '@/types'

export type WebSocketMessage = {
  type: 'NEW_EMAIL' | 'EMAIL_UPDATE' | 'EMAIL_DELETED' | 'TRUCK_DATA_UPDATED' | 'LOAD_DATA_UPDATED' | 'CONNECTION_STATUS' | 'START_EMAIL_MONITORING' | 'STOP_EMAIL_MONITORING' | 'MAP_REFRESH_REQUIRED'
  data: any
}

export class EmailWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private eventListeners: { [key: string]: ((data: any) => void)[] } = {}
  private isConnected = false
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(url: string) {
    this.url = url
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url)
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.error('❌ WebSocket connection timeout')
          console.error('❌ WebSocket readyState:', this.ws.readyState)
          this.ws.close()
          this.emit('error', new Error('Connection timeout'))
        }
      }, 5000) // 5 second timeout for faster debugging
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout) // Clear timeout on successful connection
        this.isConnected = true
        this.reconnectAttempts = 0
        this.emit('connection', { status: 'connected' })
        
        // Start heartbeat monitoring
        this.startHeartbeat()
        
        // Request server status
        this.send({
          type: 'REQUEST_STATUS',
          data: {}
        })
      }

      this.ws.onclose = (event) => {
        this.isConnected = false
        this.emit('disconnection', { status: 'disconnected', code: event.code, reason: event.reason })
        this.stopHeartbeat()
        this.attemptReconnect()
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleServerMessage(message)
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        this.isConnected = false
        this.emit('disconnection', { status: 'disconnected' })
        this.stopHeartbeat()
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        console.error('❌ WebSocket readyState:', this.ws?.readyState)
        clearTimeout(connectionTimeout) // Clear timeout on error
        this.emit('error', error)
      }

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error)
      this.emit('error', error)
    }
  }

  private handleServerMessage(message: any) {
    
    switch (message.type) {
      case 'CONNECTION_STATUS':
        this.emit('connection', message.data)
        break
        
      case 'NEW_EMAIL':
        this.emit('newEmail', {
          email: message.data.email,
          aiProcessed: message.data.aiProcessed,
          timestamp: message.data.timestamp
        })
        break
        
      case 'EMAIL_DELETED':
        this.emit('emailDeleted', {
          emailId: message.data.emailId,
          timestamp: message.data.timestamp
        })
        break
        
      case 'TRUCK_DATA_UPDATED':
        this.emit('truckDataUpdated', message.data)
        break
        
      case 'LOAD_DATA_UPDATED':
        this.emit('loadDataUpdated', message.data)
        break
        
      case 'MAP_REFRESH_REQUIRED':
        this.emit('mapRefreshRequired', message.data)
        break
        
      case 'MONITORING_STATUS':
        this.emit('monitoringStatus', message.data)
        break
        
      case 'SERVER_STATUS':
        this.emit('serverStatus', message.data)
        break
        
      case 'HEARTBEAT':
        this.emit('heartbeat', message.data)
        break
        
      case 'PONG':
        // Handle pong response to ping
        this.emit('pong', message.data)
        break
        
      case 'TOKEN_CONFIRMED':
        // Handle token confirmation
        this.emit('tokenConfirmed', message.data)
        break
        
      case 'ERROR':
        console.error('❌ Server error:', message.data.message)
        this.emit('serverError', message.data)
        break
        
      default:
        this.emit('unknown', message)
    }
  }

  private startHeartbeat() {
    // Clear any existing heartbeat
    this.stopHeartbeat()
    
    // Set up heartbeat monitoring (expect heartbeat every 35 seconds)
    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected) {
        this.stopHeartbeat()
        return
      }
      
      // Send ping to server to keep connection alive
      this.send({
        type: 'PING',
        data: { timestamp: new Date().toISOString() }
      })
    }, 30000) // Send ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached')
      this.emit('maxReconnectAttemptsReached', {})
      return
    }

      this.reconnectAttempts++
      
      setTimeout(() => {
        this.connect()
    }, this.reconnectDelay * this.reconnectAttempts) // Exponential backoff
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('⚠️ WebSocket not connected. Message not sent:', message)
      console.warn('⚠️ WebSocket readyState:', this.ws?.readyState)
      console.warn('⚠️ WebSocket exists:', !!this.ws)
    }
  }

  // Start email monitoring
  startMonitoring() {
    this.send({
      type: 'START_MONITORING',
      data: {}
    })
  }

  // Stop email monitoring
  stopMonitoring() {
    this.send({
      type: 'STOP_MONITORING',
      data: {}
    })
  }

  // Force email check
  forceCheck() {
    this.send({
      type: 'FORCE_CHECK',
      data: {}
    })
  }

  // Request server status
  requestStatus() {
    this.send({
      type: 'REQUEST_STATUS',
      data: {}
    })
  }

  // Request database update
  requestDatabaseUpdate() {
    this.send({
      type: 'REQUEST_DATABASE_UPDATE',
      data: {}
    })
  }

  // Request real-time monitoring for email and load changes
  requestRealtimeMonitoring() {
    this.send({
      type: 'REQUEST_REALTIME_MONITORING',
      data: {
        monitorEmails: true,
        monitorLoads: true,
        monitorTrucks: true
      }
    })
  }

  // Request map refresh
  requestMapRefresh() {
    this.send({
      type: 'REQUEST_MAP_REFRESH',
      data: {
        timestamp: new Date().toISOString()
      }
    })
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = []
    }
    this.eventListeners[event].push(callback)
  }

  off(event: string, callback: (data: any) => void) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback)
    }
  }

  private emit(event: string, data: any) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`❌ Error in event callback for ${event}:`, error)
        }
      })
    }
  }

  disconnect() {
    this.stopHeartbeat()
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.isConnected = false
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      readyState: this.ws?.readyState
    }
  }
} 