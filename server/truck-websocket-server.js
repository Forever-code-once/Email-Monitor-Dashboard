const WebSocket = require('ws')
const mysql = require('mysql2/promise')
const https = require('https')
const fs = require('fs')

class TruckWebSocketServer {
  constructor() {
    this.wss = null
    this.clients = new Set()
    this.dbConfig = {
      host: process.env.AWS_RDS_HOST || 'email-monitor-db.ctljjcc4qcdj.us-east-1.rds.amazonaws.com',
      user: process.env.AWS_RDS_USER || 'admin',
      password: process.env.AWS_RDS_PASSWORD || 'bGp3+00RQ',
      database: process.env.AWS_RDS_DATABASE || 'email_monitor',
      port: parseInt(process.env.AWS_RDS_PORT || '3306')
    }
    this.lastTruckCount = 0
    this.isMonitoring = false
  }

  async start(port = 8081) {
    try {
      // Wait for database to be ready before starting WebSocket server
      await this.waitForDatabase()
      
      // Try to create HTTPS server for WSS support
      let server = null
      try {
        const options = {
          key: fs.readFileSync('/etc/letsencrypt/live/ai.conardlogistics.com/privkey.pem'),
          cert: fs.readFileSync('/etc/letsencrypt/live/ai.conardlogistics.com/fullchain.pem')
        }
        server = https.createServer(options)
      } catch (sslError) {
        console.error('❌ SSL certificates not found, using HTTP server only')
      }
      
      this.wss = new WebSocket.Server({ 
        port: port,
        server: server  // Use HTTPS server if available, otherwise use port directly
      })

      this.wss.on('connection', (ws) => {
        this.clients.add(ws)

        // Send current truck count on connection
        this.sendCurrentTruckCount(ws)

        // Handle incoming messages
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            
            switch (message.type) {
              case 'TRUCK_DELETED':
                this.notifyTruckDeleted(message.data.truckId)
                break
              default:
                console.log('🚛 Unknown message type:', message.type)
            }
          } catch (error) {
            console.error('❌ Error parsing truck WebSocket message:', error)
          }
        })

        ws.on('close', () => {
          this.clients.delete(ws)
        })

        ws.on('error', (error) => {
          console.error('🚛 Truck WebSocket error:', error)
          this.clients.delete(ws)
        })
      })

      // Start monitoring for truck data changes
      this.startTruckMonitoring()

    } catch (error) {
      console.error('❌ Failed to start truck WebSocket server:', error)
    }
  }

  async waitForDatabase(maxRetries = 10, retryDelay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const connection = await mysql.createConnection(this.dbConfig)
        
        // Test the connection with a simple query
        await connection.execute('SELECT 1')
        await connection.end()
        
        return true
      } catch (error) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }
    throw new Error('Failed to connect to database after maximum retries')
  }

  async startTruckMonitoring() {
    if (this.isMonitoring) return
    
    this.isMonitoring = true

    // Check for changes every 2 seconds
    setInterval(async () => {
      try {
        await this.checkTruckDataChanges()
      } catch (error) {
        console.error('❌ Error monitoring truck data:', error)
      }
    }, 2000)
  }

  async checkTruckDataChanges() {
    try {
      const connection = await mysql.createConnection(this.dbConfig)
      
      // Get current truck count
      const [rows] = await connection.execute(`
        SELECT COUNT(*) as total_count FROM truck_availability WHERE is_deleted = 0 OR is_deleted IS NULL
      `)
      
      const currentCount = rows[0].total_count
      
      // Check if count changed
      if (currentCount !== this.lastTruckCount) {
        
        // Get all active trucks
        const [trucks] = await connection.execute(`
          SELECT 
            id, customer, customer_email, date, city, state, additional_info,
            email_id, email_subject, email_date, is_deleted, deleted_date,
            created_at, updated_at
          FROM truck_availability 
          WHERE is_deleted = 0 OR is_deleted IS NULL
          ORDER BY created_at DESC
        `)

        // Broadcast update to all clients
        this.broadcastToAll({
          type: 'TRUCK_DATA_UPDATE',
          data: {
            totalCount: currentCount,
            trucks: trucks,
            timestamp: new Date().toISOString()
          }
        })

        this.lastTruckCount = currentCount
      }

      await connection.end()
    } catch (error) {
      console.error('❌ Error checking truck data changes:', error)
    }
  }

  async sendCurrentTruckCount(ws) {
    try {
      const connection = await mysql.createConnection(this.dbConfig)
      
      const [rows] = await connection.execute(`
        SELECT COUNT(*) as total_count FROM truck_availability WHERE is_deleted = 0 OR is_deleted IS NULL
      `)
      
      const currentCount = rows[0].total_count
      this.lastTruckCount = currentCount

      // Get all active trucks
      const [trucks] = await connection.execute(`
        SELECT 
          id, customer, customer_email, date, city, state, additional_info,
          email_id, email_subject, email_date, is_deleted, deleted_date,
          created_at, updated_at
        FROM truck_availability 
        WHERE is_deleted = 0 OR is_deleted IS NULL
        ORDER BY created_at DESC
      `)

      ws.send(JSON.stringify({
        type: 'TRUCK_DATA_INIT',
        data: {
          totalCount: currentCount,
          trucks: trucks,
          timestamp: new Date().toISOString()
        }
      }))

      await connection.end()
    } catch (error) {
      console.error('❌ Error sending current truck count:', error)
    }
  }

  broadcastToAll(message) {
    const messageStr = JSON.stringify(message)
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr)
        } catch (error) {
          console.error('❌ Error broadcasting to client:', error)
          this.clients.delete(client)
        }
      }
    })
  }

  // Method to notify about truck deletion
  notifyTruckDeleted(truckId) {
    this.broadcastToAll({
      type: 'TRUCK_DELETED',
      data: {
        truckId: truckId,
        timestamp: new Date().toISOString()
      }
    })
  }

  // Method to notify about new truck data
  notifyNewTruckData(truckData) {
    this.broadcastToAll({
      type: 'NEW_TRUCK_DATA',
      data: {
        trucks: truckData,
        timestamp: new Date().toISOString()
      }
    })
  }
}

// Start the server
const truckServer = new TruckWebSocketServer()
truckServer.start().catch(console.error)

module.exports = TruckWebSocketServer