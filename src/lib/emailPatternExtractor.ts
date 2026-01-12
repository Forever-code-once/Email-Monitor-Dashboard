/**
 * Hybrid Email Pattern Extractor
 * Combines regex-based pattern matching with AI parsing for better accuracy
 */

export interface ExtractedPattern {
  dates: string[]
  locations: Array<{ city: string; state: string; raw: string }>
  tables: string[]
  routes: Array<{ origin: string; destination: string; raw: string }>
  quantities: Array<{ location: string; count: number; raw: string }>
  confidence: number
}

/**
 * Extract dates from email content
 */
export function extractDates(content: string): string[] {
  const dates: string[] = []
  const datePatterns = [
    // MM/DD or M/D format
    /\b(\d{1,2})\/(\d{1,2})\b/g,
    // YYYY-MM-DD format
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    // Month Day format (e.g., "August 12", "Aug 12")
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\b/gi,
    // Day of week with date (e.g., "Monday 7/28")
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\/(\d{1,2})\b/gi,
    // Date range format (e.g., "8/1-8/2")
    /\b(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})\b/g,
  ]

  for (const pattern of datePatterns) {
    const matches = Array.from(content.matchAll(pattern))
    for (const match of matches) {
      dates.push(match[0])
    }
  }

  return Array.from(new Set(dates)) // Remove duplicates
}

/**
 * Extract city/state locations from email content
 */
export function extractLocations(content: string): Array<{ city: string; state: string; raw: string }> {
  const locations: Array<{ city: string; state: string; raw: string }> = []
  
  // Pattern: City, State (e.g., "Nashville, TN")
  const cityStatePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/g
  
  const matches = Array.from(content.matchAll(cityStatePattern))
  for (const match of matches) {
    const city = match[1].trim()
    const state = match[2].trim().toUpperCase()
    
    // Validate state code
    if (isValidStateCode(state)) {
      locations.push({
        city,
        state,
        raw: match[0]
      })
    }
  }

  return locations
}

/**
 * Extract table structures from email content
 */
export function extractTables(content: string): string[] {
  const tables: string[] = []
  
  // Pattern 1: Pipe-delimited tables (e.g., "City | State | Date")
  const pipeTablePattern = /(?:^|\n)((?:[^\n]*\|[^\n]*\n?)+)/gm
  const pipeMatches = Array.from(content.matchAll(pipeTablePattern))
  for (const match of pipeMatches) {
    if (match[1].split('|').length >= 2) { // At least 2 columns
      tables.push(match[1].trim())
    }
  }
  
  // Pattern 2: Tab-delimited tables
  const tabTablePattern = /(?:^|\n)((?:[^\n]*\t[^\n]*\n?){2,})/gm
  const tabMatches = Array.from(content.matchAll(tabTablePattern))
  for (const match of tabMatches) {
    tables.push(match[1].trim())
  }

  return tables
}

/**
 * Extract route arrows (e.g., "Nashville → Memphis, TN")
 */
export function extractRoutes(content: string): Array<{ origin: string; destination: string; raw: string }> {
  const routes: Array<{ origin: string; destination: string; raw: string }> = []
  
  // Arrow patterns: →, à, ->, to
  const routePatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:→|à|->|to)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})\b/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s*(?:→|à|->|to)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})\b/g,
  ]

  for (const pattern of routePatterns) {
    const matches = Array.from(content.matchAll(pattern))
    for (const match of matches) {
      routes.push({
        origin: match[1].trim(),
        destination: match[2]?.trim() || '',
        raw: match[0]
      })
    }
  }

  return routes
}

/**
 * Extract quantity multipliers (e.g., "Kansas City, MO – X 4")
 */
export function extractQuantities(content: string): Array<{ location: string; count: number; raw: string }> {
  const quantities: Array<{ location: string; count: number; raw: string }> = []
  
  // Patterns: "City, State X 4", "City, State – X 4", "City, State-X4", etc.
  const quantityPatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s*[–\-]?\s*X?\s*(\d+)\b/gi,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})X(\d+)\b/gi,
  ]

  for (const pattern of quantityPatterns) {
    const matches = Array.from(content.matchAll(pattern))
    for (const match of matches) {
      const city = match[1].trim()
      const state = match[2].trim().toUpperCase()
      const count = parseInt(match[3], 10)
      
      if (count > 0 && count <= 100 && isValidStateCode(state)) { // Sanity check
        quantities.push({
          location: `${city}, ${state}`,
          count,
          raw: match[0]
        })
      }
    }
  }

  return quantities
}

/**
 * Calculate confidence score based on extracted patterns
 */
export function calculateConfidence(patterns: ExtractedPattern): number {
  let score = 0
  
  // Dates found (+20 points)
  if (patterns.dates.length > 0) score += 20
  
  // Locations found (+30 points)
  if (patterns.locations.length > 0) score += 30
  
  // Tables found (+25 points - structured data)
  if (patterns.tables.length > 0) score += 25
  
  // Routes found (+15 points)
  if (patterns.routes.length > 0) score += 15
  
  // Quantities found (+10 points)
  if (patterns.quantities.length > 0) score += 10
  
  // Normalize to 0-1 range
  return Math.min(score / 100, 1)
}

/**
 * Validate US state code
 */
function isValidStateCode(state: string): boolean {
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ]
  return validStates.includes(state.toUpperCase())
}

/**
 * Extract all patterns from email content
 */
export function extractAllPatterns(content: string): ExtractedPattern {
  const dates = extractDates(content)
  const locations = extractLocations(content)
  const tables = extractTables(content)
  const routes = extractRoutes(content)
  const quantities = extractQuantities(content)
  
  const patterns: ExtractedPattern = {
    dates,
    locations,
    tables,
    routes,
    quantities,
    confidence: 0
  }
  
  patterns.confidence = calculateConfidence(patterns)
  
  return patterns
}

/**
 * Format extracted patterns for AI prompt enhancement
 */
export function formatPatternsForPrompt(patterns: ExtractedPattern): string {
  let prompt = '\n\n=== PRE-EXTRACTED PATTERNS (Use these as hints) ===\n'
  
  if (patterns.dates.length > 0) {
    prompt += `\nDates found: ${patterns.dates.join(', ')}`
  }
  
  if (patterns.locations.length > 0) {
    prompt += `\nLocations found: ${patterns.locations.map(l => `${l.city}, ${l.state}`).join('; ')}`
  }
  
  if (patterns.routes.length > 0) {
    prompt += `\nRoutes found: ${patterns.routes.map(r => r.raw).join('; ')}`
  }
  
  if (patterns.quantities.length > 0) {
    prompt += `\nQuantity multipliers: ${patterns.quantities.map(q => `${q.location} x${q.count}`).join('; ')}`
  }
  
  if (patterns.tables.length > 0) {
    prompt += `\nTable structures detected: ${patterns.tables.length} table(s)`
  }
  
  prompt += `\n\nConfidence Score: ${(patterns.confidence * 100).toFixed(0)}%`
  prompt += '\n=== END PRE-EXTRACTED PATTERNS ===\n\n'
  
  return prompt
}

