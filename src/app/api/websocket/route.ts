import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  return new Response('WebSocket endpoint - upgrade to WebSocket protocol', {
    status: 426,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    },
  })
} 