import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query')
    const type = searchParams.get('type') || 'geocoding'
    const state = searchParams.get('state')

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    // Use secret token for server-side requests
    const mapboxToken = process.env.MAPBOX_SECRET_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    if (!mapboxToken) {
      return NextResponse.json({ error: 'Mapbox token not configured' }, { status: 500 })
    }

    let mapboxUrl: string

    if (type === 'geocoding') {
      // Build geocoding URL with improved parameters
      const baseUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
      const params = new URLSearchParams({
        access_token: mapboxToken,
        country: 'US',
        types: 'place,locality,neighborhood',
        limit: '10', // Get more results to find the best match
        proximity: '-98.5795,39.8283' // Center of US for better relevance
      })
      
      // Add state-specific parameters if provided
      if (state) {
        params.append('region', state)
      }
      
      mapboxUrl = `${baseUrl}?${params.toString()}`
    } else if (type === 'tiles') {
      // Map tiles (for the actual map display)
      mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`
    } else {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }

    const response = await fetch(mapboxUrl)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Mapbox proxy error:', error)
    console.error('Mapbox token status:', {
      hasSecretToken: !!process.env.MAPBOX_SECRET_TOKEN,
      hasPublicToken: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      secretTokenLength: process.env.MAPBOX_SECRET_TOKEN?.length || 0,
      publicTokenLength: process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.length || 0
    })
    return NextResponse.json({ 
      error: 'Failed to fetch from Mapbox',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 