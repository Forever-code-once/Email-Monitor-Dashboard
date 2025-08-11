interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress: string
}

// Cache for geocoded locations to reduce API calls
const geocodeCache = new Map<string, GeocodingResult>()

export async function geocodeAddress(city: string, state: string): Promise<GeocodingResult | null> {
  const cacheKey = `${city}, ${state}`.toLowerCase()
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    console.log('📍 Using cached coordinates for:', cacheKey)
    return geocodeCache.get(cacheKey)!
  }

  try {
    // Use our server-side proxy for geocoding
    const query = encodeURIComponent(`${city}, ${state}, USA`)
    const response = await fetch(
      `/api/mapbox-proxy?query=${query}&type=geocoding`
    )

    if (!response.ok) {
      console.warn('⚠️ Geocoding failed for:', cacheKey)
      return null
    }

    const data = await response.json()
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const result: GeocodingResult = {
        latitude: feature.center[1],
        longitude: feature.center[0],
        formattedAddress: feature.place_name
      }
      
      // Cache the result
      geocodeCache.set(cacheKey, result)
      console.log('📍 Geocoded:', cacheKey, '→', result)
      
      return result
    }
    
    console.warn('⚠️ No geocoding results for:', cacheKey)
    return null
  } catch (error) {
    console.error('❌ Geocoding error for:', cacheKey, error)
    return null
  }
}

export async function geocodeBatch(locations: Array<{city: string, state: string}>): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>()
  
  // Process in batches to avoid rate limiting
  const batchSize = 5
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize)
    
    const batchPromises = batch.map(async (location) => {
      const result = await geocodeAddress(location.city, location.state)
      return { location, result }
    })
    
    const batchResults = await Promise.all(batchPromises)
    
    batchResults.forEach(({ location, result }) => {
      if (result) {
        const key = `${location.city}, ${location.state}`.toLowerCase()
        results.set(key, result)
      }
    })
    
    // Small delay between batches
    if (i + batchSize < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return results
}

// Pre-cache common US cities for better performance
export async function preCacheCommonCities(): Promise<void> {
  const commonCities = [
    { city: 'New York', state: 'NY' },
    { city: 'Los Angeles', state: 'CA' },
    { city: 'Chicago', state: 'IL' },
    { city: 'Houston', state: 'TX' },
    { city: 'Phoenix', state: 'AZ' },
    { city: 'Philadelphia', state: 'PA' },
    { city: 'San Antonio', state: 'TX' },
    { city: 'San Diego', state: 'CA' },
    { city: 'Dallas', state: 'TX' },
    { city: 'San Jose', state: 'CA' },
    { city: 'Austin', state: 'TX' },
    { city: 'Jacksonville', state: 'FL' },
    { city: 'Fort Worth', state: 'TX' },
    { city: 'Columbus', state: 'OH' },
    { city: 'Charlotte', state: 'NC' },
    { city: 'San Francisco', state: 'CA' },
    { city: 'Indianapolis', state: 'IN' },
    { city: 'Seattle', state: 'WA' },
    { city: 'Denver', state: 'CO' },
    { city: 'Washington', state: 'DC' }
  ]
  
  console.log('📍 Pre-caching common cities...')
  await geocodeBatch(commonCities)
  console.log('✅ Common cities cached')
} 