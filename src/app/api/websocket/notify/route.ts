import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    if (!type || !data) {
      return NextResponse.json({ error: 'Missing type or data' }, { status: 400 })
    }

    // Send notification to bid WebSocket server
    const response = await fetch('http://localhost:8082/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        data
      })
    })

    if (!response.ok) {
      console.error('Failed to send notification to WebSocket server:', response.statusText)
      return NextResponse.json({ error: 'Failed to notify WebSocket server' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in WebSocket notify API:', error)
    return NextResponse.json({ 
      error: 'Failed to process notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
