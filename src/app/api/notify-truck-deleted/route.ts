import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Store reference to truck WebSocket server
let truckWebSocketServer: any = null

export async function POST(request: NextRequest) {
  try {
    const { truckId } = await request.json()
    
    if (!truckId) {
      return NextResponse.json(
        { success: false, error: 'Truck ID is required' },
        { status: 400 }
      )
    }

    console.log(`📡 Notifying truck WebSocket server about deletion: ${truckId}`)

    // For now, just log the notification
    // The truck WebSocket server will handle this via database monitoring
    console.log(`📡 Truck deletion notification logged: ${truckId}`)
    
    // TODO: Implement direct WebSocket notification when server is running

    return NextResponse.json({
      success: true,
      message: 'Truck deletion notification sent',
      truckId: truckId
    })

  } catch (error) {
    console.error('❌ Error notifying truck deletion:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to notify truck deletion',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}