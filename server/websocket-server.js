const WebSocket = require('ws');
const { Client } = require('@microsoft/microsoft-graph-client');
const { AuthenticationProvider } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
require('dotenv').config({ path: '.env.local' });

class EmailMonitorServer {
  constructor() {
    this.wss = null;
    this.lastEmailCheck = new Date();
    this.knownEmails = new Set();
    this.clients = new Set();
    this.isMonitoring = false;
    
    // Configuration
    this.PORT = 8080;
    this.NEXTJS_URL = process.env.NEXTJS_URL || 'http://localhost:3000';
  }

  // Initialize WebSocket server
  start() {
    this.wss = new WebSocket.Server({ 
      port: this.PORT,
      perMessageDeflate: false 
    });

    console.log(`🚀 WebSocket server started on port ${this.PORT}`);

    this.wss.on('connection', (ws, req) => {
      console.log('📱 New client connected from:', req.socket.remoteAddress);
      this.clients.add(ws);
      
      // Send connection confirmation
      this.sendToClient(ws, {
        type: 'CONNECTION_STATUS',
        data: { 
          status: 'connected', 
          timestamp: new Date().toISOString(),
          message: 'Real-time email monitoring ready'
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('❌ Error parsing client message:', error);
        }
      });

      ws.on('close', () => {
        console.log('📱 Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send initial status
      this.sendServerStatus();
    });

    console.log('✅ WebSocket server ready for event-driven email monitoring');
  }

  // Handle messages from clients
  handleClientMessage(ws, message) {
    console.log('📨 Received message:', message.type);
    
    switch (message.type) {
      case 'START_MONITORING':
        this.startEmailMonitoring();
        break;
      case 'STOP_MONITORING':
        this.stopEmailMonitoring();
        break;
      case 'REQUEST_STATUS':
        this.sendServerStatus();
        break;
      case 'FORCE_CHECK':
        console.log('🔍 Manual email check requested');
        this.checkForNewEmails();
        break;
      case 'TEST_EMAIL':
        console.log('🧪 Test email processing requested');
        this.processTestEmail();
        break;
      case 'SET_ACCESS_TOKEN':
        // Store access token for this client
        this.setAccessToken(ws, message.data.token, message.data.expiresAt);
        break;
      case 'REQUEST_DATABASE_UPDATE':
        console.log('🗄️ Database update requested');
        this.checkDatabaseUpdates();
        break;
      case 'PING':
        // Respond to ping with pong
        this.sendToClient(ws, {
          type: 'PONG',
          data: { timestamp: new Date().toISOString() }
        });
        break;
      default:
        console.log('❓ Unknown message type:', message.type);
    }
  }

  // Store access token for a specific client
  setAccessToken(ws, token, expiresAt) {
    ws.accessToken = token;
    ws.tokenExpiresAt = expiresAt;
    console.log('🔑 Access token stored for client');
    
    // Send confirmation
    this.sendToClient(ws, {
      type: 'TOKEN_CONFIRMED',
      data: { message: 'Access token received and stored' }
    });
  }

  // Start email monitoring (event-driven, no polling)
  startEmailMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Email monitoring already active');
      return;
    }

    this.isMonitoring = true;
    console.log('✅ Email monitoring started - event-driven mode');
    
    // Do an initial check
    this.checkForNewEmails();

    this.broadcastToAll({
      type: 'MONITORING_STATUS',
      data: { 
        active: true, 
        mode: 'event-driven',
        message: 'Email monitoring started - event-driven mode'
      }
    });
  }

  // Stop email monitoring
  stopEmailMonitoring() {
    this.isMonitoring = false;
    console.log('⏹️ Email monitoring stopped');
    
    this.broadcastToAll({
      type: 'MONITORING_STATUS',
      data: { 
        active: false,
        message: 'Email monitoring stopped'
      }
    });
  }

  // Check for new emails using Microsoft Graph API
  async checkForNewEmails() {
    try {
      console.log('🔍 Checking for new emails...');
      
      // Get access token for Microsoft Graph API
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        console.log('⚠️ No access token available, skipping email check');
        return;
      }

      // Create Graph client
      const graphClient = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });

      // Get recent emails (last 10 minutes for testing)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const query = `receivedDateTime ge ${tenMinutesAgo.toISOString()}`;
      
      const response = await graphClient
        .api('/me/messages')
        .filter(query)
        .orderby('receivedDateTime desc')
        .top(10)
        .select('id,subject,body,receivedDateTime,from,isRead')
        .get();

      if (response.value && response.value.length > 0) {
        console.log(`📧 Found ${response.value.length} recent emails`);
        
        for (const email of response.value) {
          const emailId = email.id;
          
          // Skip if we've already processed this email
          if (this.knownEmails.has(emailId)) {
            continue;
          }
          
          console.log(`📧 Processing new email: ${email.subject}`);
          this.knownEmails.add(emailId);
          
          // Process with AI
          const aiProcessed = await this.processEmailWithAI(email);
          
          // Broadcast to all clients
          this.broadcastToAll({
            type: 'NEW_EMAIL',
            data: {
              email: {
                id: email.id,
                subject: email.subject,
                body: {
                  content: email.body.content,
                  contentType: email.body.contentType
                },
                receivedDateTime: email.receivedDateTime,
                from: {
                  emailAddress: {
                    name: email.from.emailAddress.name,
                    address: email.from.emailAddress.address
                  }
                },
                isRead: email.isRead
              },
              aiProcessed: aiProcessed,
              timestamp: new Date().toISOString()
            }
          });
        }
      } else {
        console.log('📭 No new emails found');
      }
      
      this.lastEmailCheck = new Date();
      
      // Send heartbeat to keep connections alive
      this.broadcastToAll({
        type: 'HEARTBEAT',
        data: { 
          timestamp: new Date().toISOString(),
          lastCheck: this.lastEmailCheck.toISOString(),
          clientCount: this.clients.size
        }
      });
      
    } catch (error) {
      console.error('❌ Error checking emails:', error);
      this.broadcastToAll({
        type: 'ERROR',
        data: { 
          message: 'Failed to check emails',
          error: error.message 
        }
      });
    }
  }

  // Get access token for Microsoft Graph API
  async getAccessToken() {
    try {
      // Find a client with a valid token
      for (const client of this.clients) {
        if (client.accessToken && client.tokenExpiresAt > Date.now()) {
          return client.accessToken;
        }
      }

      console.log('⚠️ No valid access token available from any client');
      return null;
    } catch (error) {
      console.error('❌ Error getting access token:', error);
      return null;
    }
  }

  // Process test email for debugging
  async processTestEmail() {
    const testEmail = {
      id: 'test-email-' + Date.now(),
      subject: 'Test: Truck Available - Midland, TX',
      body: {
        content: 'Available trucks in Midland, TX for 8/1-8/2. Contact dispatch for details.',
        contentType: 'text'
      },
      receivedDateTime: new Date().toISOString(),
      from: {
        emailAddress: {
          name: 'Test Dispatch',
          address: 'test@example.com'
        }
      },
      isRead: false
    };

    console.log('🧪 Processing test email:', testEmail.subject);
    
    // Process with AI
    const aiProcessed = await this.processEmailWithAI(testEmail);
    
    // Broadcast to all clients
    this.broadcastToAll({
      type: 'NEW_EMAIL',
      data: {
        email: testEmail,
        aiProcessed: aiProcessed,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Process email with AI using your existing API
  async processEmailWithAI(email) {
    try {
      console.log(`🤖 Processing email "${email.subject}" with AI...`);
      
      const response = await fetch(`${this.NEXTJS_URL}/api/parse-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: email.subject,
          body: email.body.content,
          from: email.from.emailAddress,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ AI processing failed with status ${response.status}:`, errorText);
        throw new Error(`AI processing failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ AI processing completed for "${email.subject}":`, result);
      return result;
    } catch (error) {
      console.error('❌ Error processing email with AI:', error);
      return null;
    }
  }

  // Check for database updates (loads, trucks, etc.)
  async checkDatabaseUpdates() {
    try {
      console.log('🗄️ Checking for database updates...');
      
      // Check for new loads
      const loadsResponse = await fetch(`${this.NEXTJS_URL}/api/loads`);
      if (loadsResponse.ok) {
        const loadsData = await loadsResponse.json();
        if (loadsData.success && loadsData.loads) {
          console.log(`📦 Found ${loadsData.loads.length} loads in database`);
          
          this.broadcastToAll({
            type: 'DATABASE_UPDATE',
            data: {
              type: 'loads',
              loads: loadsData.loads,
              count: loadsData.loads.length,
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      // Check for truck availability updates
      const trucksResponse = await fetch(`${this.NEXTJS_URL}/api/test-database`);
      if (trucksResponse.ok) {
        const trucksData = await trucksResponse.json();
        if (trucksData.success) {
          console.log(`🚛 Found ${trucksData.truckCount || 0} trucks in database`);
          
          this.broadcastToAll({
            type: 'DATABASE_UPDATE',
            data: {
              type: 'trucks',
              truckCount: trucksData.truckCount || 0,
              timestamp: new Date().toISOString()
            }
          });
        }
      }

    } catch (error) {
      console.error('❌ Error checking database updates:', error);
      
      this.broadcastToAll({
        type: 'DATABASE_ERROR',
        data: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // Send message to specific client
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast message to all connected clients
  broadcastToAll(message) {
    const deadClients = [];
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      } else {
        deadClients.push(client);
      }
    });

    // Clean up dead connections
    deadClients.forEach(client => this.clients.delete(client));
    
    if (deadClients.length > 0) {
      console.log(`🧹 Cleaned up ${deadClients.length} dead connections`);
    }
  }

  // Send server status to all clients
  sendServerStatus() {
    this.broadcastToAll({
      type: 'SERVER_STATUS',
      data: {
        active: this.isMonitoring,
        clientCount: this.clients.size,
        lastCheck: this.lastEmailCheck.toISOString(),
        checkInterval: 'N/A (event-driven)',
        uptime: process.uptime()
      }
    });
  }

  // Graceful shutdown
  stop() {
    console.log('🛑 Shutting down WebSocket server...');
    
    this.stopEmailMonitoring();
    
    if (this.wss) {
      this.wss.close(() => {
        console.log('✅ WebSocket server shut down gracefully');
      });
    }
  }
}

// Create and start server
const server = new EmailMonitorServer();

// Handle graceful shutdown
process.on('SIGTERM', () => server.stop());
process.on('SIGINT', () => server.stop());

// Start the server
server.start();

module.exports = EmailMonitorServer; 