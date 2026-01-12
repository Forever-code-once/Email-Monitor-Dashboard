/**
 * Location Validator
 * Validates extracted city/state combinations using geocoding
 */

interface ValidationResult {
  isValid: boolean
  confidence: number
  correctedCity?: string
  correctedState?: string
  coordinates?: { lat: number; lng: number }
  error?: string
}

interface TruckLocation {
  city: string
  state: string
  date: string
  additionalInfo?: string
}

/**
 * Validate a single location using Mapbox geocoding
 */
export async function validateLocation(city: string, state: string): Promise<ValidationResult> {
  try {
    // Call the geocoding API
    const response = await fetch(
      `/api/mapbox-proxy?query=${encodeURIComponent(`${city}, ${state}`)}&type=geocoding&state=${encodeURIComponent(state)}`
    )

    if (!response.ok) {
      return {
        isValid: false,
        confidence: 0,
        error: `Geocoding API error: ${response.status}`
      }
    }

    const data = await response.json()

    if (!data.features || data.features.length === 0) {
      return {
        isValid: false,
        confidence: 0,
        error: 'No geocoding results found'
      }
    }

    // Find the best match (city in correct state)
    for (const feature of data.features) {
      const placeType = feature.place_type || []
      const context = feature.context || []
      
      // Only accept 'place' type (cities)
      if (!placeType.includes('place')) {
        continue
      }
      
      // Extract state from context
      const stateContext = context.find((ctx: any) => ctx.id?.startsWith('region'))
      const featureState = stateContext?.short_code?.replace('US-', '').toUpperCase()
      
      // Verify state matches
      if (featureState === state.toUpperCase()) {
        return {
          isValid: true,
          confidence: 1.0,
          correctedCity: feature.text || city,
          correctedState: featureState,
          coordinates: {
            lat: feature.center[1],
            lng: feature.center[0]
          }
        }
      }
    }

    // No exact match found
    return {
      isValid: false,
      confidence: 0.3,
      error: `City "${city}" not found in state "${state}"`
    }
  } catch (error) {
    console.error('Location validation error:', error)
    return {
      isValid: false,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Validate multiple locations in batch
 */
export async function validateLocationsBatch(
  locations: Array<{ city: string; state: string }>
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>()
  
  // Process in batches to avoid rate limiting
  const batchSize = 5
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize)
    
    const batchPromises = batch.map(async (location) => {
      const key = `${location.city}, ${location.state}`.toLowerCase()
      const result = await validateLocation(location.city, location.state)
      return { key, result }
    })
    
    const batchResults = await Promise.all(batchPromises)
    
    batchResults.forEach(({ key, result }) => {
      results.set(key, result)
    })
    
    // Small delay between batches
    if (i + batchSize < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  return results
}

/**
 * Validate and filter truck locations
 * Returns only valid trucks with confidence scores
 */
export async function validateTruckLocations(
  trucks: TruckLocation[]
): Promise<Array<TruckLocation & { validationConfidence: number; needsReview: boolean }>> {
  const validatedTrucks: Array<TruckLocation & { validationConfidence: number; needsReview: boolean }> = []
  
  // Get unique locations
  const uniqueLocations = Array.from(
    new Set(trucks.map(t => `${t.city}|${t.state}`))
  ).map(loc => {
    const [city, state] = loc.split('|')
    return { city, state }
  })
  
  // Validate all unique locations
  const validationResults = await validateLocationsBatch(uniqueLocations)
  
  // Apply validation results to trucks
  for (const truck of trucks) {
    const key = `${truck.city}, ${truck.state}`.toLowerCase()
    const validation = validationResults.get(key)
    
    if (validation) {
      validatedTrucks.push({
        ...truck,
        city: validation.correctedCity || truck.city,
        state: validation.correctedState || truck.state,
        validationConfidence: validation.confidence,
        needsReview: validation.confidence < 0.7 || !validation.isValid
      })
    } else {
      // No validation result - mark for review
      validatedTrucks.push({
        ...truck,
        validationConfidence: 0,
        needsReview: true
      })
    }
  }
  
  return validatedTrucks
}

/**
 * Get statistics about validation results
 */
export function getValidationStats(
  trucks: Array<TruckLocation & { validationConfidence: number; needsReview: boolean }>
): {
  total: number
  valid: number
  needsReview: number
  invalid: number
  averageConfidence: number
} {
  const total = trucks.length
  const valid = trucks.filter(t => t.validationConfidence >= 0.7 && !t.needsReview).length
  const needsReview = trucks.filter(t => t.needsReview).length
  const invalid = trucks.filter(t => t.validationConfidence < 0.3).length
  const averageConfidence = trucks.reduce((sum, t) => sum + t.validationConfidence, 0) / (total || 1)
  
  return {
    total,
    valid,
    needsReview,
    invalid,
    averageConfidence
  }
}

/**
 * Common city name corrections
 */
const cityNameCorrections: Record<string, Record<string, string>> = {
  'GA': {
    'La Grange': 'LaGrange',
    'Lagrange': 'LaGrange'
  },
  'KY': {
    'LaGrange': 'La Grange',
    'Lagrange': 'La Grange'
  },
  'TX': {
    'LaGrange': 'La Grange',
    'Lagrange': 'La Grange'
  }
}

/**
 * Apply common city name corrections before validation
 */
export function correctCityName(city: string, state: string): string {
  const stateCorrections = cityNameCorrections[state.toUpperCase()]
  if (stateCorrections) {
    const corrected = stateCorrections[city.trim()]
    if (corrected) {
      return corrected
    }
  }
  return city.trim()
}

