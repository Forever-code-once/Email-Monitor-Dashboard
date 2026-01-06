import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * OpenWeatherMap Weather Forecast API
 * Provides 4-day forecast for a given location
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')

    if (!lat || !lon) {
      return NextResponse.json({ 
        error: 'Missing required parameters: lat, lon' 
      }, { status: 400 })
    }

    // Get OpenWeatherMap API key from environment
    const apiKey = process.env.OPENWEATHERMAP_API_KEY

    if (!apiKey) {
      console.error('❌ OpenWeatherMap API key not configured')
      return NextResponse.json({ 
        error: 'Weather service not configured' 
      }, { status: 500 })
    }

    // Fetch 5-day/3-hour forecast from OpenWeatherMap
    // We'll parse this to get daily forecasts
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`

    console.log(`🌦️ Fetching weather forecast for: ${lat}, ${lon}`)

    const response = await fetch(forecastUrl)

    if (!response.ok) {
      console.error(`❌ Weather forecast fetch failed: ${response.status}`)
      
      if (response.status === 401) {
        return NextResponse.json({ 
          error: 'Invalid OpenWeatherMap API key' 
        }, { status: 401 })
      }
      
      return NextResponse.json({ 
        error: `Failed to fetch weather forecast: ${response.status}` 
      }, { status: response.status })
    }

    const data = await response.json()

    // Parse 3-hour forecast into daily forecasts (next 4 days)
    const dailyForecasts = parseDailyForecasts(data)

    return NextResponse.json({
      success: true,
      location: {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        city: data.city?.name || 'Unknown',
        state: data.city?.country || ''
      },
      forecasts: dailyForecasts
    })

  } catch (error) {
    console.error('❌ Weather forecast error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch weather forecast',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Parse 3-hour forecast data into daily summaries
 * Returns next 4 days of forecasts
 */
function parseDailyForecasts(data: any) {
  const dailyMap = new Map<string, any[]>()
  
  // Group forecasts by date
  data.list.forEach((item: any) => {
    const date = new Date(item.dt * 1000)
    const dateKey = date.toISOString().split('T')[0] // YYYY-MM-DD
    
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, [])
    }
    dailyMap.get(dateKey)!.push(item)
  })

  // Convert to array and take first 4 days
  const dailyForecasts: any[] = []
  const entries = Array.from(dailyMap.entries())
  
  for (let i = 0; i < Math.min(4, entries.length); i++) {
    const [dateKey, forecasts] = entries[i]
    
    // Calculate daily summary from 3-hour forecasts
    const temps = forecasts.map(f => f.main.temp)
    const conditions = forecasts.map(f => f.weather[0])
    const precipitation = forecasts.reduce((sum, f) => {
      return sum + (f.rain?.['3h'] || 0) + (f.snow?.['3h'] || 0)
    }, 0)
    
    // Find most common weather condition
    const conditionCounts = new Map<string, number>()
    conditions.forEach(c => {
      const count = conditionCounts.get(c.main) || 0
      conditionCounts.set(c.main, count + 1)
    })
    const dominantCondition = Array.from(conditionCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0]
    
    // Find the condition object for the dominant condition
    const conditionObj = conditions.find(c => c.main === dominantCondition) || conditions[0]
    
    dailyForecasts.push({
      date: dateKey,
      dayOfWeek: new Date(dateKey).toLocaleDateString('en-US', { weekday: 'short' }),
      tempHigh: Math.round(Math.max(...temps)),
      tempLow: Math.round(Math.min(...temps)),
      condition: conditionObj.main,
      description: conditionObj.description,
      icon: conditionObj.icon,
      precipitation: Math.round(precipitation * 10) / 10, // mm
      humidity: Math.round(forecasts.reduce((sum, f) => sum + f.main.humidity, 0) / forecasts.length)
    })
  }
  
  return dailyForecasts
}

