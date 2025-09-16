const WebSocket = require('ws')
const mysql = require('mysql2/promise')

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
    
    console.log('🔧 Database config:', {
      host: this.dbConfig.host,
      user: this.dbConfig.user,
      database: this.dbConfig.database,
      port: this.dbConfig.port
    })
    this.lastTruckCount = 0
    this.isMonitoring = false
  }

  async start(port = 8081) {
    try {
      // Wait for database to be ready before starting WebSocket server
      console.log('⏳ Waiting for database connection...')
      await this.waitForDatabase()
      
      this.wss = new WebSocket.Server({ port })
      console.log(`🚛 Truck WebSocket server started on port ${port}`)

      this.wss.on('connection', (ws) => {
        console.log('🚛 New truck client connected')
        this.clients.add(ws)

        // Send current truck count on connection
        this.sendCurrentTruckCount(ws)

        ws.on('close', () => {
          console.log('🚛 Truck client disconnected')
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
        console.log(`🔄 Attempting database connection (${i + 1}/${maxRetries})...`)
        const connection = await mysql.createConnection(this.dbConfig)
        
        // Test the connection with a simple query
        await connection.execute('SELECT 1')
        await connection.end()
        
        console.log('✅ Database connection successful')
        return true
      } catch (error) {
        console.log(`❌ Database connection failed (attempt ${i + 1}):`, error.message)
        if (i < maxRetries - 1) {
          console.log(`⏳ Retrying in ${retryDelay}ms...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }
    throw new Error('Failed to connect to database after maximum retries')
  }

  async startTruckMonitoring() {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    console.log('🔍 Starting truck data monitoring...')

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
        console.log(`📊 Truck count changed: ${this.lastTruckCount} → ${currentCount}`)
        
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
    console.log(`🗑️ Notifying truck deletion: ${truckId}`)
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
    console.log(`➕ Notifying new truck data: ${truckData.length} trucks`)
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