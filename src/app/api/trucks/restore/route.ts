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


    // Restore the truck (set is_deleted = 0)
    const result = await awsDatabaseQueries.restoreTruckAvailability(truckId)
    

    return NextResponse.json({
      success: true,
      message: 'Truck restored successfully',
      truckId: truckId
    })

  } catch (error) {
    console.error('❌ Error restoring truck:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to restore truck',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}