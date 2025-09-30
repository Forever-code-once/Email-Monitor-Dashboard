/**
 * City Name Normalization Utilities
 * Handles common variations in US city names for better matching
 */

export interface NormalizedCity {
  normalized: string
  variations: string[]
  state?: string
}

/**
 * Normalize city name by removing spaces, standardizing capitalization, and handling common variations
 */
export function normalizeCityName(cityName: string): string {
  if (!cityName) return ''
  
  // Convert to lowercase and trim
  let normalized = cityName.toLowerCase().trim()
  
  // Remove extra spaces and standardize spacing
  normalized = normalized.replace(/\s+/g, ' ')
  
  // Handle common city name variations
  const variations: { [key: string]: string } = {
    // La Grange variations
    'la grange': 'lagrange',
    
    // La Vergne variations  
    'la vergne': 'lavergne',
    
    // Saint variations
    'st.': 'saint',
    'st ': 'saint ',
    
    // Mount variations
    'mt.': 'mount',
    'mt ': 'mount ',
    
    // Fort variations
    'ft.': 'fort',
    'ft ': 'fort ',
    
    // New variations
    'n.': 'new',
    'n ': 'new ',
    
    // Remove common suffixes that might cause issues
    ' city': '',
    ' town': '',
    ' village': '',
    ' borough': '',
    ' township': ''
  }
  
  // Apply variations
  for (const [pattern, replacement] of Object.entries(variations)) {
    normalized = normalized.replace(new RegExp(pattern, 'gi'), replacement)
  }
  
  // Remove all spaces and special characters except hyphens
  normalized = normalized.replace(/[^a-z0-9-]/g, '')
  
  return normalized
}

/**
 * Get all possible variations of a city name for matching
 */
export function getCityVariations(cityName: string): string[] {
  if (!cityName) return []
  
  const variations = new Set<string>()
  
  // Add original
  variations.add(cityName.toLowerCase().trim())
  
  // Add normalized version
  variations.add(normalizeCityName(cityName))
  
  // Add space variations
  const withSpaces = cityName.toLowerCase().trim()
  const withoutSpaces = withSpaces.replace(/\s+/g, '')
  
  variations.add(withSpaces)
  variations.add(withoutSpaces)
  
  // Add common variations
  if (withSpaces.includes('la ')) {
    variations.add(withSpaces.replace('la ', 'la'))
    variations.add(withSpaces.replace('la ', 'la '))
  }
  
  if (withSpaces.includes('saint ')) {
    variations.add(withSpaces.replace('saint ', 'st. '))
    variations.add(withSpaces.replace('saint ', 'st '))
  }
  
  if (withSpaces.includes('mount ')) {
    variations.add(withSpaces.replace('mount ', 'mt. '))
    variations.add(withSpaces.replace('mount ', 'mt '))
  }
  
  return Array.from(variations).filter(v => v.length > 0)
}

/**
 * Check if two city names match considering variations
 */
export function citiesMatch(city1: string, city2: string): boolean {
  if (!city1 || !city2) return false
  
  const variations1 = getCityVariations(city1)
  const variations2 = getCityVariations(city2)
  
  // Check if any variation of city1 matches any variation of city2
  return variations1.some(v1 => 
    variations2.some(v2 => v1 === v2)
  )
}

/**
 * Common US city name mappings for auto-correction
 */
export const CITY_MAPPINGS: { [key: string]: string } = {
  // La Grange variations
  'lagrange': 'la grange',
  'la grange': 'la grange',
  
  // La Vergne variations
  'lavergne': 'la vergne',
  'la vergne': 'la vergne',
  
  // Saint variations
  'saint louis': 'st. louis',
  'saint paul': 'st. paul',
  'saint petersburg': 'st. petersburg',
  
  // Mount variations
  'mount vernon': 'mt. vernon',
  'mount pleasant': 'mt. pleasant',
  
  // Common abbreviations
  'new york city': 'new york',
  'los angeles': 'la',
  'san francisco': 'sf',
  'washington dc': 'washington',
  'washington d.c.': 'washington'
}

/**
 * Auto-correct city name using common mappings
 */
export function autoCorrectCityName(cityName: string): string {
  if (!cityName) return ''
  
  const normalized = normalizeCityName(cityName)
  return CITY_MAPPINGS[normalized] || cityName
}

/**
 * Find matching cities in database considering variations
 */
export function findMatchingCities(targetCity: string, targetState: string, availableCities: Array<{city: string, state: string}>): Array<{city: string, state: string}> {
  if (!targetCity || !availableCities) return []
  
  const matches: Array<{city: string, state: string}> = []
  
  for (const availableCity of availableCities) {
    // First check if states match (if target state is specified)
    if (targetState && availableCity.state.toLowerCase() !== targetState.toLowerCase()) {
      continue
    }
    
    // Check if cities match considering variations
    if (citiesMatch(targetCity, availableCity.city)) {
      matches.push(availableCity)
    }
  }
  
  return matches
}