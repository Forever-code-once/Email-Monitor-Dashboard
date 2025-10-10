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
    const { pickupCity, radiusMiles, selectedDate } = await request.json()
    
    const connection = await pool.getConnection()
    
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
      const paddedTargetDate = targetDate.replace(/(\d+)\/(\d+)/, (match: string, month: string, day: string) => {
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
      const matchDetails = []
      
      for (const truck of trucks) {
        const cityMatches = citiesMatch(cityName, truck.city)
        
        if (cityMatches) {
          // If state is specified, check state match
          if (stateName && truck.state.toUpperCase() === stateName) {
            exactMatches++
            matchDetails.push({
              truckCity: truck.city,
              truckState: truck.state,
              cityMatches: true,
              stateMatches: true,
              reason: 'Exact city and state match'
            })
          } else if (!stateName) {
            // No state specified, any state match is good
            exactMatches++
            matchDetails.push({
              truckCity: truck.city,
              truckState: truck.state,
              cityMatches: true,
              stateMatches: true,
              reason: 'City match, no state specified'
            })
          } else {
            matchDetails.push({
              truckCity: truck.city,
              truckState: truck.state,
              cityMatches: true,
              stateMatches: false,
              reason: 'City match but state mismatch'
            })
          }
        }
      }
      
      const result = exactMatches > 0
      
      return NextResponse.json({
        success: true,
        inputCity: cityName,
        inputState: stateName,
        inputDate: targetDate,
        totalTrucks: trucks.length,
        exactMatches,
        hasMatchingTruck: result,
        matchDetails: matchDetails.filter(m => m.cityMatches && m.stateMatches)
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
