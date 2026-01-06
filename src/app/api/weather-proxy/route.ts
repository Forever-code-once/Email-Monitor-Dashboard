import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Proxy for weather radar tiles
 * Uses RainViewer for precipitation radar (real-time)
 * Uses OpenWeatherMap for clouds and temperature
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const z = searchParams.get('z')
    const x = searchParams.get('x')
    const y = searchParams.get('y')
    const layer = searchParams.get('layer') || 'precipitation'
    const timestamp = searchParams.get('timestamp')

    if (!z || !x || !y) {
      return NextResponse.json({ 
        error: 'Missing required parameters: z, x, y' 
      }, { status: 400 })
    }

    let tileUrl: string

    // Use RainViewer for precipitation (real-time radar)
    if (layer === 'precipitation' || layer === 'precipitation_new') {
      if (!timestamp) {
        return NextResponse.json({ 
          error: 'Missing timestamp for precipitation layer' 
        }, { status: 400 })
      }
      
      // RainViewer radar tiles - color = 1 (standard), smooth = 1 (smooth), snow = 1 (show snow)
      tileUrl = `https://tilecache.rainviewer.com/v2/radar/${timestamp}/256/${z}/${x}/${y}/1/1_1.png`
      
      console.log(`🌦️ Fetching RainViewer radar tile: ${z}/${x}/${y} @ ${timestamp}`)
    } else {
      // Use OpenWeatherMap for clouds and temperature
      const apiKey = process.env.OPENWEATHERMAP_API_KEY

      if (!apiKey) {
        console.error('❌ OpenWeatherMap API key not configured')
        return NextResponse.json({ 
          error: 'Weather service not configured' 
        }, { status: 500 })
      }

      tileUrl = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`
      
      console.log(`🌦️ Fetching OpenWeatherMap tile: ${layer} at ${z}/${x}/${y}`)
    }

    // Fetch the tile
    const response = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'Email-Monitor-Dashboard/1.0',
        'Accept': 'image/png,image/*,*/*',
      },
    })

    if (!response.ok) {
      console.error(`❌ Weather tile fetch failed: ${response.status} ${response.statusText}`)
      
      if (response.status === 401) {
        return NextResponse.json({ 
          error: 'Invalid API key' 
        }, { status: 401 })
      }
      
      return NextResponse.json({ 
        error: `Failed to fetch weather tile: ${response.status}` 
      }, { status: response.status })
    }

    // Get the image data
    const imageData = await response.arrayBuffer()

    // Return the image with proper headers
    return new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Access-Control-Allow-Origin': '*', // Allow CORS
      },
    })

  } catch (error) {
    console.error('❌ Weather proxy error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch weather tile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

