export class TruckWebSocketClient {
  private ws: WebSocket | null = null
  private reconnectInterval: number = 5000
  private maxReconnectAttempts: number = 10
  private reconnectAttempts: number = 0
  private isConnected: boolean = false
  private callbacks: Map<string, Function[]> = new Map()

  constructor() {
    this.connect()
  }

  private connect() {
    try {
      // Always use localhost for now since we're in development
      const wsUrl = 'ws://localhost:8081'
      
      console.log('🚛 Connecting to truck WebSocket:', wsUrl)
      
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('✅ Truck WebSocket connected')
        this.isConnected = true
        this.reconnectAttempts = 0
        this.emit('connected')
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('📨 Truck WebSocket message:', message.type)
          
          switch (message.type) {
            case 'TRUCK_DATA_INIT':
              this.emit('truckDataInit', message.data)
              break
            case 'TRUCK_DATA_UPDATE':
              this.emit('truckDataUpdate', message.data)
              break
            case 'TRUCK_DELETED':
              this.emit('truckDeleted', message.data)
              break
            case 'NEW_TRUCK_DATA':
              this.emit('newTruckData', message.data)
              break
            default:
              console.log('🚛 Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('🔌 Truck WebSocket disconnected')
        this.isConnected = false
        this.emit('disconnected')
        this.handleReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('❌ Truck WebSocket error:', error)
        this.emit('error', error)
      }

    } catch (error) {
      console.error('❌ Failed to create truck WebSocket connection:', error)
      this.handleReconnect()
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached for truck WebSocket')
      return
    }

    this.reconnectAttempts++
    console.log(`🔄 Attempting to reconnect truck WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
    
    setTimeout(() => {
      this.connect()
    }, this.reconnectInterval)
  }

  // Event subscription methods
  on(event: string, callback: Function) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, [])
    }
    this.callbacks.get(event)!.push(callback)
  }

  off(event: string, callback: Function) {
    if (this.callbacks.has(event)) {
      const callbacks = this.callbacks.get(event)!
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event)!.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`❌ Error in truck WebSocket callback for ${event}:`, error)
        }
      })
    }
  }

  // Public methods
  isConnectedToTruckWebSocket(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
  }

  // Send message to server (if needed)
  send(message: any) {
    if (this.isConnected && this.ws) {
      try {
        this.ws.send(JSON.stringify(message))
      } catch (error) {
        console.error('❌ Error sending message to truck WebSocket:', error)
      }
    }
  }
}

// Create singleton instance
export const truckWebSocketClient = new TruckWebSocketClient()