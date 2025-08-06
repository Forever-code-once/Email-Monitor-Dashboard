const WebSocket = require('ws');
const { Client } = require('@microsoft/microsoft-graph-client');
const { AuthenticationProvider } = require('@microsoft/microsoft-graph-client');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

class EmailMonitorServer {
  constructor() {
    this.wss = null;
    this.emailCheckInterval = null;
    this.lastEmailCheck = new Date();
    this.knownEmails = new Set();
    this.clients = new Set();
    
    // Configuration
    this.CHECK_INTERVAL = 30000; // Check every 30 seconds
    this.PORT = 8080;
    this.NEXTJS_URL = process.env.NEXTJS_URL || 'http://localhost:3000'; // Configurable Next.js URL
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
          message: 'Real-time email monitoring active'
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

    // Start email monitoring
    this.startEmailMonitoring();
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
        this.checkForNewEmails();
        break;
      default:
        console.log('❓ Unknown message type:', message.type);
    }
  }

  // Start periodic email checking
  startEmailMonitoring() {
    if (this.emailCheckInterval) {
      console.log('⚠️ Email monitoring already running');
      return;
    }

    console.log('🔄 Starting email monitoring...');
    
    // Initial check
    this.checkForNewEmails();
    
    // Set up periodic checking
    this.emailCheckInterval = setInterval(() => {
      this.checkForNewEmails();
    }, this.CHECK_INTERVAL);

    this.broadcastToAll({
      type: 'MONITORING_STATUS',
      data: { 
        active: true, 
        interval: this.CHECK_INTERVAL,
        message: 'Email monitoring started'
      }
    });
  }

  // Stop email monitoring
  stopEmailMonitoring() {
    if (this.emailCheckInterval) {
      clearInterval(this.emailCheckInterval);
      this.emailCheckInterval = null;
      console.log('⏹️ Email monitoring stopped');
      
      this.broadcastToAll({
        type: 'MONITORING_STATUS',
        data: { 
          active: false,
          message: 'Email monitoring stopped'
        }
      });
    }
  }

  // Check for new emails using Microsoft Graph API
  async checkForNewEmails() {
    try {
      console.log('🔍 Checking for new emails...');
      
      // TODO: Replace with real Microsoft Graph API integration
      // For now, we'll skip email simulation - only process real emails
      // when they come through the Next.js dashboard
      
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

  // Process email with AI using your existing API
  async processEmailWithAI(email) {
    try {
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
        throw new Error('AI processing failed');
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error processing email with AI:', error);
      return null;
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
        active: !!this.emailCheckInterval,
        clientCount: this.clients.size,
        lastCheck: this.lastEmailCheck.toISOString(),
        checkInterval: this.CHECK_INTERVAL,
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