import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { normalizeCityName, getCityVariations, citiesMatch } from '@/lib/cityNormalization'
import { notifyWebSocketClients } from '@/lib/websocket'

// Database configuration
const dbConfig = {
  host: process.env.AWS_RDS_HOST,
  user: process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  database: process.env.AWS_RDS_DATABASE,
  ssl: { rejectUnauthorized: false }
}

// Create database connection pool
const pool = mysql.createPool(dbConfig)

// GET - Fetch all active bid requests
export async function GET() {
  try {
    const connection = await pool.getConnection()
    
    try {
      const [rows] = await connection.execute(`
        SELECT 
          id,
          customer_name,
          pickup_city,
          destination_city,
          timer_minutes,
          created_at,
          expires_at,
          has_matching_truck,
          radius_miles
        FROM bid_requests 
        WHERE expires_at > NOW()
        ORDER BY created_at DESC
      `)
      
      const bidRequests = (rows as any[]).map(row => ({
        id: row.id,
        customerName: row.customer_name,
        pickupCity: row.pickup_city,
        destinationCity: row.destination_city,
        timerMinutes: row.timer_minutes,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        hasMatchingTruck: Boolean(row.has_matching_truck),
        radiusMiles: row.radius_miles
      }))
      
      return NextResponse.json({
        success: true,
        bidRequests
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch bid requests'
    }, { status: 500 })
  }
}

// POST - Create new bid request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerName, pickupCity, destinationCity, timerInput, radiusMiles = 50, selectedDate } = body
    
    // Parse timer input
    const timerMinutes = parseTimerInput(timerInput)
    
    if (!customerName || !pickupCity || !destinationCity || timerMinutes <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid bid request data'
      }, { status: 400 })
    }
    
    if (radiusMiles < 1 || radiusMiles > 3000) {
      return NextResponse.json({
        success: false,
        error: 'Radius must be between 1 and 3000 miles'
      }, { status: 400 })
    }
    
    const connection = await pool.getConnection()
    
    try {
      // Check for matching trucks on the selected date
      const hasMatchingTruck = await checkTruckAvailability(pickupCity, radiusMiles, selectedDate, connection)
      
      // Calculate expiration time
      const createdAt = new Date()
      const expiresAt = new Date(createdAt.getTime() + (timerMinutes * 60 * 1000))
      
      // Insert bid request
      const [result] = await connection.execute(`
        INSERT INTO bid_requests (
          customer_name,
          pickup_city,
          destination_city,
          timer_minutes,
          created_at,
          expires_at,
          has_matching_truck,
          radius_miles
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerName,
        pickupCity,
        destinationCity,
        timerMinutes,
        createdAt,
        expiresAt,
        hasMatchingTruck,
        radiusMiles
      ])
      
      const insertResult = result as any
      
      // Notify WebSocket clients about new bid request
      await notifyWebSocketClients('NEW_BID_REQUEST', {
        id: insertResult.insertId,
        customerName,
        pickupCity,
        destinationCity,
        timerMinutes,
        hasMatchingTruck,
        radiusMiles,
        createdAt: new Date().toISOString()
      })
      
      return NextResponse.json({
        success: true,
        bidRequestId: insertResult.insertId,
        hasMatchingTruck
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to create bid request'
    }, { status: 500 })
  }
}

// Helper function to parse timer input
function parseTimerInput(input: string): number {
  if (!input.trim()) return 0
  
  const inputLower = input.toLowerCase().trim()
  let totalMinutes = 0
  
  // Parse hours (h)
  const hourMatch = inputLower.match(/(\d+)h/)
  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1]) * 60
  }
  
  // Parse minutes (m)
  const minuteMatch = inputLower.match(/(\d+)m/)
  if (minuteMatch) {
    totalMinutes += parseInt(minuteMatch[1])
  }
  
  return totalMinutes
}

// Helper function to check truck availability
async function checkTruckAvailability(pickupCity: string, radiusMiles: number, selectedDate: string, connection: any): Promise<boolean> {
  try {
    // Extract city name and state from pickup city
    const cityParts = pickupCity.split(',')
    const cityName = cityParts[0].trim()
    const stateName = cityParts[1] ? cityParts[1].trim().toUpperCase() : null
    
    // Convert selectedDate to MM/DD format if needed
    let targetDate = selectedDate
    if (selectedDate && selectedDate.includes('-')) {
      // Convert YYYY-MM-DD to MM/DD
      const [year, month, day] = selectedDate.split('-')
      targetDate = `${parseInt(month)}/${parseInt(day)}`
    }
    
    // Also create padded version for database compatibility
    const paddedTargetDate = targetDate.replace(/(\d+)\/(\d+)/, (match, month, day) => {
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}`
    })
    
    
    // Get all trucks for the selected date to check for city variations
    const [allTrucks] = await connection.execute(`
      SELECT city, state FROM truck_availability 
      WHERE (date = ? OR date = ?) AND is_deleted = 0
    `, [targetDate, paddedTargetDate])
    
    const trucks = allTrucks as Array<{city: string, state: string}>
    
    // Check for exact city matches first
    let exactMatches = 0
    console.log(`🔍 Checking truck availability for: "${cityName}, ${stateName}" on ${targetDate}`)
    console.log(`📊 Found ${trucks.length} trucks for this date`)
    
    for (const truck of trucks) {
      const cityMatches = citiesMatch(cityName, truck.city)
      console.log(`🏙️ Comparing "${cityName}" with "${truck.city}" (${truck.state}): ${cityMatches}`)
      
      if (cityMatches) {
        // If state is specified, check state match
        if (stateName && truck.state.toUpperCase() === stateName) {
          console.log(`✅ State match: ${truck.state.toUpperCase()} === ${stateName}`)
          exactMatches++
        } else if (!stateName) {
          // No state specified, any state match is good
          console.log(`✅ No state specified, accepting any state`)
          exactMatches++
        } else {
          console.log(`❌ State mismatch: ${truck.state.toUpperCase()} !== ${stateName}`)
        }
      }
    }
    
    
    if (exactMatches > 0) {
      return true
    }
    
    // If no exact matches and radius > 0, check nearby cities on the selected date
    if (radiusMiles > 0) {
      if (stateName) {
        // State specified - check within state or across all states based on radius
        if (radiusMiles > 1000) {
          // Large radius - check all states
          return trucks.length > 0
        } else {
          // Small radius - check same state only
          const stateMatches = trucks.filter(truck => truck.state.toUpperCase() === stateName)
          return stateMatches.length > 0
        }
      } else {
        // No state specified - for large radii, check all states
        if (radiusMiles > 1000) {
          return trucks.length > 0
        } else {
          // Small radius, no state - check for city name variations
          const cityMatches = trucks.filter(truck => citiesMatch(cityName, truck.city))
          return cityMatches.length > 0
        }
      }
    }
    
    return false
  } catch (error) {
    return false
  }
}