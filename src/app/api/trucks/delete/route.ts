import { NextRequest, NextResponse } from 'next/server'
import { awsDatabaseQueries } from '@/lib/awsDatabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { truckId } = await request.json()
    
    if (!truckId) {
      return NextResponse.json(
        { success: false, error: 'Truck ID is required' },
        { status: 400 }
      )
    }


    // Soft delete the truck (set is_deleted = 1)
    const result = await awsDatabaseQueries.deleteTruckAvailability(truckId)
    

    // Notify WebSocket server about truck deletion
    try {
      const wsUrl = process.env.NODE_ENV === 'production' 
        ? 'wss://ai.conardlogistics.com:8081'
        : 'ws://localhost:8081'
      
      // Send notification to truck WebSocket server
      const response = await fetch('http://localhost:3000/api/notify-truck-deleted', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ truckId }),
      })
      
      if (response.ok) {
      }
    } catch (wsError) {
      console.error('❌ Failed to notify WebSocket server:', wsError)
      // Don't fail the deletion if WebSocket notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Truck marked as deleted successfully',
      truckId: truckId
    })

  } catch (error) {
    console.error('❌ Error deleting truck:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete truck',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}