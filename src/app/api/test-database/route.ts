import { NextRequest, NextResponse } from 'next/server'
import { testConnection, databaseQueries } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing database connection...')
    
    // Test basic connection
    const isConnected = await testConnection()
    
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    // Test a simple query
    const result = await databaseQueries.getAllTruckAvailability()
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      truckCount: result.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Database test error:', error)
    return NextResponse.json(
      { 
        error: 'Database test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'saveTruck':
        const truckResult = await databaseQueries.saveTruckAvailability(data)
        return NextResponse.json({
          success: true,
          message: 'Truck availability saved',
          result: truckResult
        })

      case 'saveEmail':
        const emailResult = await databaseQueries.saveEmail(data)
        return NextResponse.json({
          success: true,
          message: 'Email saved',
          result: emailResult
        })

      case 'getTrucksByCustomer':
        const trucks = await databaseQueries.getTruckAvailabilityByCustomer(data.customerEmail)
        return NextResponse.json({
          success: true,
          trucks,
          count: trucks.length
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('❌ Database operation error:', error)
    return NextResponse.json(
      { 
        error: 'Database operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 