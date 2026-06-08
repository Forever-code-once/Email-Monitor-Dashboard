import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// 1x1 fully transparent PNG, served when a tile is missing/errored so the map
// renders nothing instead of a broken/error tile.
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

function transparentTile() {
  return new NextResponse(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// OpenWeatherMap raster layers we allow proxying (prevents arbitrary URL
// injection into the upstream tile path). All render at every zoom level.
const ALLOWED_OWM_LAYERS = new Set([
  'precipitation_new',
  'clouds_new',
  'temp_new',
  'wind_new',
  'pressure_new',
])

/**
 * Proxy for OpenWeatherMap weather raster tiles (precipitation, clouds, etc.).
 * Keeps the API key server-side. Unlike RainViewer, OWM serves tiles at all
 * zoom levels, so there is no "Zoom Level Not Supported" placeholder.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const z = searchParams.get('z')
    const x = searchParams.get('x')
    const y = searchParams.get('y')
    // Default to precipitation; accept legacy "precipitation" alias.
    let layer = searchParams.get('layer') || 'precipitation_new'
    if (layer === 'precipitation') layer = 'precipitation_new'

    if (!z || !x || !y) {
      return NextResponse.json({
        error: 'Missing required parameters: z, x, y',
      }, { status: 400 })
    }

    if (!ALLOWED_OWM_LAYERS.has(layer)) {
      return NextResponse.json({
        error: `Unsupported weather layer: ${layer}`,
      }, { status: 400 })
    }

    const apiKey = process.env.OPENWEATHERMAP_API_KEY
    if (!apiKey) {
      console.error('❌ OpenWeatherMap API key not configured')
      return NextResponse.json({
        error: 'Weather service not configured',
      }, { status: 500 })
    }

    const tileUrl = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`

    const response = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'Email-Monitor-Dashboard/1.0',
        'Accept': 'image/png,image/*,*/*',
      },
    })

    if (!response.ok) {
      console.error(`❌ Weather tile fetch failed: ${response.status} ${response.statusText}`)
      // Missing/errored tile -> transparent so the map shows nothing.
      return transparentTile()
    }

    const imageData = await response.arrayBuffer()

    return new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('❌ Weather proxy error:', error)
    // Never surface an error tile to the map.
    return transparentTile()
  }
}
