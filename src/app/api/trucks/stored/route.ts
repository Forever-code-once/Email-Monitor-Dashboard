import { NextRequest, NextResponse } from 'next/server'
import { awsDatabaseQueries } from '@/lib/awsDatabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // Optional date filter (YYYY-MM-DD or MM/DD format)
    
    console.log(`📊 FETCHING STORED TRUCKS: ${date ? `for date ${date}` : 'all trucks'}`)

    // Get all truck availability from database
    const trucks = await awsDatabaseQueries.getAllTruckAvailability()
    const trucksArray = Array.isArray(trucks) ? trucks : []
    
    console.log(`📦 RAW DATABASE TRUCKS: ${trucksArray.length} total`)

    // Filter by date if provided
    let filteredTrucks = trucksArray
    if (date) {
      // Support both MM/DD and YYYY-MM-DD formats
      const targetDate = date.includes('/') ? date : convertToMMDD(date)
      filteredTrucks = trucksArray.filter((truck: any) => {
        return truck.Date === targetDate || truck.date === targetDate
      })
      console.log(`📅 FILTERED TRUCKS: ${filteredTrucks.length} for date ${targetDate}`)
    }

    // Convert database format to frontend format (MySQL snake_case to camelCase)
    const formattedTrucks = filteredTrucks.map((truck: any) => ({
      id: truck.id,
      customer: truck.customer,
      customerEmail: truck.customer_email,
      date: truck.date,
      city: truck.city,
      state: truck.state,
      additionalInfo: truck.additional_info || '',
      emailId: truck.email_id,
      emailSubject: truck.email_subject,
      emailDate: truck.email_date,
      createdAt: truck.created_at,
      isChecked: false
    }))

    console.log(`✅ RETURNING: ${formattedTrucks.length} formatted trucks`)

    return NextResponse.json({
      success: true,
      trucks: formattedTrucks,
      count: formattedTrucks.length,
      totalInDatabase: trucksArray.length,
      dateFilter: date
    })

  } catch (error) {
    console.error('❌ Error fetching stored trucks:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch stored trucks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to convert YYYY-MM-DD to MM/DD format
function convertToMMDD(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit'
    })
  } catch {
    return dateStr // Return as-is if conversion fails
  }
}