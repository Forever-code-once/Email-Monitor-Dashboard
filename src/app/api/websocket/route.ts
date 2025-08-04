import { NextRequest } from 'next/server'
import { WebSocketServer } from 'ws'

let wss: WebSocketServer | null = null
let emailMonitorInterval: NodeJS.Timeout | null = null

export async function GET(request: NextRequest) {
  return new Response('WebSocket endpoint - upgrade to WebSocket protocol', {
    status: 426,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    },
  })
}

// This will be called when the server starts
export function initializeWebSocketServer() {
  if (wss) return wss

  wss = new WebSocketServer({ port: 8080 })

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket')

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        handleClientMessage(ws, message)
      } catch (error) {
        console.error('Error parsing client message:', error)
      }
    })

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket')
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'CONNECTION_STATUS',
      data: { status: 'connected', timestamp: new Date().toISOString() }
    }))
  })

  console.log('WebSocket server started on port 8080')
  return wss
}

function handleClientMessage(ws: any, message: any) {
  switch (message.type) {
    case 'START_EMAIL_MONITORING':
      startEmailMonitoring()
      break
    case 'STOP_EMAIL_MONITORING':
      stopEmailMonitoring()
      break
    default:
      console.log('Unknown message type:', message.type)
  }
}

async function startEmailMonitoring() {
  if (emailMonitorInterval) return

  console.log('Starting email monitoring...')
  
  emailMonitorInterval = setInterval(async () => {
    try {
      // This would normally check for new emails
      // For now, we'll use a placeholder
      await checkForNewEmails()
    } catch (error) {
      console.error('Error checking for new emails:', error)
    }
  }, 5000) // Check every 5 seconds
}

function stopEmailMonitoring() {
  if (emailMonitorInterval) {
    clearInterval(emailMonitorInterval)
    emailMonitorInterval = null
    console.log('Email monitoring stopped')
  }
}

async function checkForNewEmails() {
  // This is a placeholder - in a real implementation, you would:
  // 1. Check for new emails using Microsoft Graph API
  // 2. Compare with previously seen emails
  // 3. Broadcast new emails to all connected clients
  
  // For demonstration, we'll broadcast a simulated email periodically
  const simulatedEmail = {
    id: `email-${Date.now()}`,
    subject: `Test Email ${new Date().toLocaleTimeString()}`,
    from: {
      emailAddress: {
        name: 'Test Sender',
        address: 'test@example.com'
      }
    },
    receivedDateTime: new Date().toISOString(),
    bodyPreview: 'This is a test email for WebSocket functionality...',
    body: {
      content: 'This is a test email body',
      contentType: 'text'
    }
  }

  broadcastToAllClients({
    type: 'NEW_EMAIL',
    data: simulatedEmail
  })
}

function broadcastToAllClients(message: any) {
  if (!wss) return

  wss.clients.forEach((client: any) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(message))
    }
  })
}

// Initialize WebSocket server when module loads
if (typeof window === 'undefined') {
  // Only run on server side
  setTimeout(() => {
    initializeWebSocketServer()
  }, 1000)
} 