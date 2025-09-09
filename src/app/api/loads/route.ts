import { NextRequest, NextResponse } from 'next/server'
import { databaseQueries } from '@/lib/database'

// Enable caching for better performance
export const revalidate = 300 // Revalidate every 5 minutes
export const dynamic = 'auto'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching available loads from database...')
    
    const loads = await databaseQueries.getAvailableLoads()
    
    console.log(`✅ Found ${loads.length} available loads`)
    
    const response = NextResponse.json({
      success: true,
      loads,
      count: loads.length,
      timestamp: new Date().toISOString()
    })
    
    // Add cache headers for browser caching
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    response.headers.set('ETag', `"loads-${loads.length}-${Date.now()}"`)
    
    return response
    
  } catch (error) {
    console.error('❌ Error fetching loads:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch loads',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyName } = body

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Fetching loads for company: ${companyName}`)
    
    const loads = await databaseQueries.getLoadsByCompany(companyName)
    
    console.log(`✅ Found ${loads.length} loads for ${companyName}`)
    
    return NextResponse.json({
      success: true,
      loads,
      count: loads.length,
      companyName,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error fetching loads by company:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch loads by company',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 