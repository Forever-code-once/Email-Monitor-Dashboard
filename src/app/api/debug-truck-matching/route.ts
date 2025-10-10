import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { citiesMatch } from '@/lib/cityNormalization'

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

export async function POST(request: NextRequest) {
  try {
    const { city, state, date } = await request.json()
    
    const connection = await pool.getConnection()
    
    try {
      // Get trucks for the specified date
      const [allTrucks] = await connection.execute(`
        SELECT city, state FROM truck_availability 
        WHERE (date = ? OR date = ?) AND is_deleted = 0
      `, [date, date.replace(/(\d+)\/(\d+)/, (match: string, month: string, day: string) => {
        return `${month.padStart(2, '0')}/${day.padStart(2, '0')}`
      })])
      
      const trucks = allTrucks as Array<{city: string, state: string}>
      
      // Test city matching
      const matches = []
      for (const truck of trucks) {
        const cityMatches = citiesMatch(city, truck.city)
        matches.push({
          truckCity: truck.city,
          truckState: truck.state,
          inputCity: city,
          inputState: state,
          cityMatches,
          stateMatches: !state || truck.state.toUpperCase() === state.toUpperCase()
        })
      }
      
      return NextResponse.json({
        success: true,
        inputCity: city,
        inputState: state,
        inputDate: date,
        totalTrucks: trucks.length,
        matches: matches.filter(m => m.cityMatches && m.stateMatches),
        allMatches: matches
      })
      
    } finally {
      connection.release()
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
