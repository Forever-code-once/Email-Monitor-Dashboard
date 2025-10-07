interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress: string
}

// Cache for geocoded locations to reduce API calls
const geocodeCache = new Map<string, GeocodingResult>()

// City name normalization mapping for common variations
const cityNameVariations: Record<string, Record<string, string>> = {
  'GA': {
    'La Grange': 'LaGrange',
    'LaGrange': 'LaGrange',
    'Lagrange': 'LaGrange'
  },
  'KY': {
    'La Grange': 'La Grange',
    'LaGrange': 'La Grange',
    'Lagrange': 'La Grange'
  },
  'TX': {
    'La Grange': 'La Grange',
    'LaGrange': 'La Grange',
    'Lagrange': 'La Grange'
  },
  'IL': {
    'La Grange': 'La Grange',
    'LaGrange': 'La Grange',
    'Lagrange': 'La Grange'
  }
}

// Function to normalize city names based on state
function normalizeCityName(city: string, state: string): string {
  const stateVariations = cityNameVariations[state.toUpperCase()]
  if (stateVariations) {
    const normalized = stateVariations[city.trim()]
    if (normalized) {
      console.log(`🔄 Normalizing city name: "${city}" → "${normalized}" for state ${state}`)
      return normalized
    }
  }
  return city.trim()
}

export async function geocodeAddress(city: string, state: string): Promise<GeocodingResult | null> {
  const cacheKey = `${city}, ${state}`.toLowerCase()
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!
  }

  try {
    // Clean and normalize city and state names
    const cleanState = state.trim().toUpperCase()
    const cleanCity = normalizeCityName(city, cleanState).replace(/\s+/g, ' ')
    
    // Try multiple query formats to improve accuracy
    const originalCity = city.trim().replace(/\s+/g, ' ')
    const queries = [
      // Format 1: Normalized City, State, USA (most specific)
      `${cleanCity}, ${cleanState}, USA`,
      // Format 2: Normalized City, State (without USA)
      `${cleanCity}, ${cleanState}`,
      // Format 3: Original City, State, USA (fallback)
      `${originalCity}, ${cleanState}, USA`,
      // Format 4: Original City, State (fallback)
      `${originalCity}, ${cleanState}`,
      // Format 5: Normalized City, State, United States
      `${cleanCity}, ${cleanState}, United States`
    ]

    for (const query of queries) {
      const response = await fetch(
        `/api/mapbox-proxy?query=${encodeURIComponent(query)}&type=geocoding&state=${encodeURIComponent(cleanState)}`
      )

      if (!response.ok) {
        console.warn(`⚠️ Geocoding failed for query "${query}":`, response.status)
        continue
      }

      const data = await response.json()
      
      if (data.features && data.features.length > 0) {
        // Find the best match that includes the correct state
        let bestFeature = data.features[0]
        
        // Look for a feature that explicitly mentions the state
        for (const feature of data.features) {
          const placeName = feature.place_name?.toLowerCase() || ''
          const context = feature.context || []
          
          // Check if this feature is in the correct state
          const hasCorrectState = context.some((ctx: any) => 
            ctx.id?.startsWith('region') && 
            (ctx.text?.toUpperCase() === cleanState || 
             ctx.short_code?.toUpperCase() === cleanState)
          ) || placeName.includes(cleanState.toLowerCase())
          
          if (hasCorrectState) {
            bestFeature = feature
            break
          }
        }
        
        const result: GeocodingResult = {
          latitude: bestFeature.center[1],
          longitude: bestFeature.center[0],
          formattedAddress: bestFeature.place_name
        }
        
        // Cache the result
        geocodeCache.set(cacheKey, result)
        
        console.log(`✅ Geocoded "${cleanCity}, ${cleanState}" to: ${result.formattedAddress}`)
        return result
      }
    }
    
    console.warn('⚠️ No geocoding results for any query format:', cacheKey)
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
  
  await geocodeBatch(commonCities)
}

// Clear geocoding cache (useful for testing or when data changes)
export function clearGeocodeCache(): void {
  geocodeCache.clear()
  console.log('🗑️ Geocoding cache cleared')
}

// Get cache statistics for debugging
export function getGeocodeCacheStats(): { size: number; keys: string[] } {
  return {
    size: geocodeCache.size,
    keys: Array.from(geocodeCache.keys())
  }
}

// Export the normalization function for use in other components
export { normalizeCityName } 