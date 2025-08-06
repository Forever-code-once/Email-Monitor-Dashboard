import { EmailMessage } from '@/types'

export type WebSocketMessage = {
  type: 'NEW_EMAIL' | 'EMAIL_UPDATE' | 'CONNECTION_STATUS' | 'START_EMAIL_MONITORING' | 'STOP_EMAIL_MONITORING'
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
      console.log('🔌 Connecting to WebSocket server...')
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected successfully')
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

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleServerMessage(message)
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected')
        this.isConnected = false
        this.emit('disconnection', { status: 'disconnected' })
        this.stopHeartbeat()
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        this.emit('error', error)
      }

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error)
      this.emit('error', error)
    }
  }

  private handleServerMessage(message: any) {
    console.log('📨 Received:', message.type)
    
    switch (message.type) {
      case 'CONNECTION_STATUS':
        this.emit('connection', message.data)
        break
        
      case 'NEW_EMAIL':
        console.log('📧 New email received:', message.data.email.subject)
        this.emit('newEmail', {
          email: message.data.email,
          aiProcessed: message.data.aiProcessed,
          timestamp: message.data.timestamp
        })
        break
        
      case 'MONITORING_STATUS':
        console.log('🔄 Monitoring status:', message.data.active ? 'Active' : 'Inactive')
        this.emit('monitoringStatus', message.data)
        break
        
      case 'SERVER_STATUS':
        this.emit('serverStatus', message.data)
        break
        
      case 'HEARTBEAT':
        this.emit('heartbeat', message.data)
        break
        
      case 'ERROR':
        console.error('❌ Server error:', message.data.message)
        this.emit('serverError', message.data)
        break
        
      default:
        console.log('❓ Unknown message type:', message.type)
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
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

    setTimeout(() => {
      this.connect()
    }, this.reconnectDelay * this.reconnectAttempts) // Exponential backoff
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('⚠️ WebSocket not connected. Message not sent:', message)
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