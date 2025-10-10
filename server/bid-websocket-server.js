const WebSocket = require('ws')
const http = require('http')
const mysql = require('mysql2/promise')

class BidWebSocketServer {
  constructor() {
    this.wss = null
    this.httpServer = null
    this.clients = new Set()
    this.dbConnection = null
    this.isMonitoring = false
    this.monitoringInterval = null
    
    // Configuration
    this.PORT = 8082
    this.DB_CONFIG = {
      host: 'email-monitor-db.ctljjcc4qcdj.us-east-1.rds.amazonaws.com',
      user: 'admin',
      password: 'bGp3+00RQ',
      database: 'email_monitor',
      port: 3306,
      ssl: { rejectUnauthorized: false }
    }
  }

  async start() {
    try {
      // Create HTTP server
      this.httpServer = http.createServer()
      
      // Create WebSocket server
      this.wss = new WebSocket.Server({ 
        server: this.httpServer,
        path: '/bid-ws'
      })

      // Set up WebSocket connection handling
      this.wss.on('connection', (ws, req) => {
        this.clients.add(ws)
        
        // Send connection confirmation
        ws.send(JSON.stringify({
          type: 'CONNECTION_STATUS',
          data: { status: 'connected', timestamp: new Date().toISOString() }
        }))

        // Handle incoming messages
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message)
            this.handleMessage(ws, data)
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error)
          }
        })

        // Handle client disconnect
        ws.on('close', () => {
          this.clients.delete(ws)
        })

        // Handle errors
        ws.on('error', (error) => {
          this.clients.delete(ws)
        })
      })

      // Set up HTTP endpoint for notifications
      this.httpServer.on('request', (req, res) => {
        if (req.method === 'POST' && req.url === '/notify') {
          let body = ''
          req.on('data', chunk => {
            body += chunk.toString()
          })
          req.on('end', () => {
            try {
              const notification = JSON.parse(body)
              this.broadcastToAll(notification)
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: true }))
            } catch (error) {
              console.error('❌ Error processing notification:', error)
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Invalid JSON' }))
            }
          })
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Not found' }))
        }
      })

      // Start bid monitoring
      await this.startBidMonitoring()

    } catch (error) {
      console.error('❌ Error starting bid WebSocket server:', error)
      process.exit(1)
    }
  }

  async stop() {
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    
    if (this.dbConnection) {
      await this.dbConnection.end()
    }
    
    if (this.wss) {
      this.wss.close()
    }
    
    if (this.httpServer) {
      this.httpServer.close()
    }
  }

  handleMessage(ws, data) {
    switch (data.type) {
      case 'REQUEST_STATUS':
        ws.send(JSON.stringify({
          type: 'CONNECTION_STATUS',
          data: { 
            status: 'connected', 
            timestamp: new Date().toISOString(),
            clients: this.clients.size
          }
        }))
        break
      default:
        console.log('📨 Received message:', data.type)
    }
  }

  broadcastToAll(message) {
    const messageStr = JSON.stringify(message)
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr)
        } catch (error) {
          console.error('❌ Error sending message to client:', error)
          this.clients.delete(client)
        }
      }
    })
  }

  async startBidMonitoring() {
    if (this.isMonitoring) {
      return
    }

    try {
      // Connect to database
      this.dbConnection = await mysql.createConnection(this.DB_CONFIG)
      
      this.isMonitoring = true
      
      // Check for bid changes every 5 seconds
      this.monitoringInterval = setInterval(() => {
        this.checkForBidChanges()
      }, 5000)
      
    } catch (error) {
      console.error('❌ Error starting bid monitoring:', error)
    }
  }

  async checkForBidChanges() {
    try {
      // Check for new bid requests
      const [rows] = await this.dbConnection.execute(`
        SELECT * FROM bid_requests 
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 10 SECOND)
        ORDER BY created_at DESC
        LIMIT 10
      `)
      
      if (rows.length > 0) {
        for (const row of rows) {
          this.broadcastToAll({
            type: 'NEW_BID_REQUEST',
            data: {
              id: row.id,
              customerName: row.customer_name,
              pickupCity: row.pickup_city,
              destinationCity: row.destination_city,
              timerMinutes: row.timer_minutes,
              hasMatchingTruck: row.has_matching_truck,
              radiusMiles: row.radius_miles,
              createdAt: row.created_at
            }
          })
        }
      }
      
      // Check for deleted bid requests (this would require a separate table or soft delete)
      // For now, we'll rely on the API notifications
      
    } catch (error) {
      console.error('❌ Error checking for bid changes:', error)
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  const server = new BidWebSocketServer()
  await server.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  const server = new BidWebSocketServer()
  await server.stop()
  process.exit(0)
})

// Start the server
const server = new BidWebSocketServer()
server.start().catch(console.error)
