import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

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
    console.error('Error fetching bid requests:', error)
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
    const { customerName, pickupCity, destinationCity, timerInput, radiusMiles = 50 } = body
    
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
      // Check for matching trucks
      const hasMatchingTruck = await checkTruckAvailability(pickupCity, radiusMiles, connection)
      
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
      
      return NextResponse.json({
        success: true,
        bidRequestId: insertResult.insertId,
        hasMatchingTruck
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('Error creating bid request:', error)
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
async function checkTruckAvailability(pickupCity: string, radiusMiles: number, connection: any): Promise<boolean> {
  try {
    // First, try to find trucks in the exact city
    const [exactMatches] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM trucks 
      WHERE city = ? AND is_deleted = 0
    `, [pickupCity])
    
    const exactCount = (exactMatches as any[])[0].count
    if (exactCount > 0) {
      return true
    }
    
    // If no exact matches and radius > 0, check nearby cities
    if (radiusMiles > 0) {
      // For now, we'll do a simple city name matching
      // In a real implementation, you'd use geocoding and distance calculations
      const [nearbyMatches] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM trucks 
        WHERE city LIKE ? AND is_deleted = 0
      `, [`%${pickupCity.split(',')[0]}%`]) // Match city name part
      
      const nearbyCount = (nearbyMatches as any[])[0].count
      return nearbyCount > 0
    }
    
    return false
  } catch (error) {
    console.error('Error checking truck availability:', error)
    return false
  }
}