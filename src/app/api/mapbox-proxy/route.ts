import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const type = searchParams.get('type') || 'geocoding'

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
      // Geocoding API
      mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=US&types=place`
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
    return NextResponse.json({ error: 'Failed to fetch from Mapbox' }, { status: 500 })
  }
} 