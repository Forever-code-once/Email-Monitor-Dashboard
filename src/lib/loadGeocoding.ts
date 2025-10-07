import { LoadData, MapPin } from '@/types'
import { geocodeAddress } from './geocoding'

/**
 * Get the next business day (Monday-Friday)
 */
function getNextBusinessDay(): Date {
  const today = new Date()
  const nextDay = new Date(today)
  nextDay.setDate(today.getDate() + 1)
  
  // Keep adding days until we find a business day (Monday = 1, Friday = 5)
  while (nextDay.getDay() === 0 || nextDay.getDay() === 6) { // Sunday = 0, Saturday = 6
    nextDay.setDate(nextDay.getDate() + 1)
  }
  
  return nextDay
}

export interface LoadPin extends MapPin {
  type: 'load'
  data: LoadData
  city: string
  state: string
  loads: LoadData[]
  loadCount: number
  date: string
}

/**
 * Convert load data to map pins grouped by location (like truck pins)
 */
export async function convertLoadsToPins(loads: LoadData[]): Promise<LoadPin[]> {
  
  // Group loads by location
  const locationGroups = new Map<string, LoadData[]>()
  
  for (const load of loads) {
    try {
      
      let city = ''
      let state = ''
      let coordinates: [number, number] | null = null
      
      // Use the actual API response fields
      if (load.FROMCITY && load.FROMSTATE) {
        city = load.FROMCITY.trim()
        state = load.FROMSTATE.trim()
        // Use coordinates if available (more accurate than geocoding)
        if (load.FROMLAT && load.FROMLONG) {
          // FROMLAT is latitude, FROMLONG is longitude
          coordinates = [load.FROMLAT, load.FROMLONG]
        }
      } else if (load.origin_city && load.origin_state) {
        // Fallback to legacy fields
        city = load.origin_city.trim()
        state = load.origin_state.trim()
      }
      
      if (city && state) {
        const locationKey = `${city}, ${state}`
        
        if (!locationGroups.has(locationKey)) {
          locationGroups.set(locationKey, [])
        }
        locationGroups.get(locationKey)!.push(load)
        
      } else {
      }
    } catch (error) {
      console.error(`❌ Error processing load ${load.REF_NUMBER}:`, error)
    }
  }
  
  
  // Create pins for each location group
  const pins: LoadPin[] = []
  
  for (const [locationKey, locationLoads] of Array.from(locationGroups.entries())) {
    try {
      const [city, state] = locationKey.split(', ')
      const firstLoad = locationLoads[0]
      
      let latitude: number
      let longitude: number
      let displayCity = city
      
      // Use coordinates from first load if available
      if (firstLoad.FROMLAT && firstLoad.FROMLONG) {
        latitude = firstLoad.FROMLAT
        longitude = firstLoad.FROMLONG
        
        // Apply longitude correction for US locations
        if (longitude > 0) {
          longitude = -longitude;
        }
        
        // Validate coordinates
        if (latitude < -90 || latitude > 90) {
          console.error(`❌ Invalid latitude value: ${latitude} for location ${locationKey}`)
          continue
        }
        if (longitude < -180 || longitude > 180) {
          console.error(`❌ Invalid longitude value: ${longitude} for location ${locationKey}`)
          continue
        }
        
      } else {
        // Fallback to geocoding
        const geocodeResult = await geocodeAddress(city, state)
        if (!geocodeResult) {
          continue
        }
        latitude = geocodeResult.latitude
        longitude = geocodeResult.longitude
        
        // Apply longitude correction for geocoded coordinates too
        if (longitude > 0) {
          longitude = -longitude;
        }
        
        // Use normalized city name from geocoding result
        displayCity = geocodeResult.formattedAddress.split(',')[0].trim()
      }
      
      // Get the most common date from loads (or use first load's date)
      const date = firstLoad.pu_drop_date1 || 'TBD'
      
      const pin: LoadPin = {
        id: `load-${city}-${state}`,
        type: 'load',
        latitude: latitude,
        longitude: longitude,
        city: displayCity,
        state: state,
        loads: locationLoads,
        loadCount: locationLoads.length,
        date: date,
        title: `${displayCity}, ${state} - ${locationLoads.length} load${locationLoads.length !== 1 ? 's' : ''}`,
        data: firstLoad // Keep first load as primary data for compatibility
      }
      
      pins.push(pin)
    } catch (error) {
      console.error(`❌ Error creating pin for location ${locationKey}:`, error)
    }
  }
  
  return pins
}

/**
 * Format time from HHMMSS format to HH:MM format
 */
function formatTime(timeStr: string): string {
  if (!timeStr || timeStr === 'TBD' || timeStr.length < 6) return 'TBD'
  
  const hours = timeStr.substring(0, 2)
  const minutes = timeStr.substring(2, 4)
  return `${hours}:${minutes}`
}

/**
 * Format date and time combination
 */
function formatDateTime(dateStr: string, timeStr: string, isDeliveryDate: boolean = false): string {
  if (!dateStr || dateStr === 'TBD') return 'TBD'
  
  // Check if this is the default SQL Server date (1753-01-01)
  const isDefaultDate = dateStr === '1753-01-01T00:00:00.000Z' || dateStr === '1753-01-01'
  
  if (isDefaultDate) {
    if (isDeliveryDate) {
      return 'TBD' // Delivery dates with default date show as TBD
    } else {
      // Start dates with default date show as next business day
      const nextBusinessDay = getNextBusinessDay()
      const formattedDate = nextBusinessDay.toISOString().split('T')[0] // YYYY-MM-DD
      const formattedTime = formatTime(timeStr)
      
      if (formattedTime === 'TBD') return formattedDate
      return `${formattedDate} ${formattedTime}`
    }
  }
  
  try {
    const date = new Date(dateStr)
    const formattedDate = date.toISOString().split('T')[0] // YYYY-MM-DD
    const formattedTime = formatTime(timeStr)
    
    if (formattedTime === 'TBD') return formattedDate
    return `${formattedDate} ${formattedTime}`
  } catch (error) {
    return 'TBD'
  }
}

/**
 * Format load data for display in popup
 */
export function formatLoadInfo(load: LoadData) {
  return {
    company: load.company_name?.trim() || 'Unknown Company',
    refNumber: load.REF_NUMBER || load.ref_number || 'Unknown',
    startLocation: load.FROMCITY && load.FROMSTATE 
      ? `${load.FROMCITY.trim()}, ${load.FROMSTATE.trim()}` 
      : (load.origin_city && load.origin_state 
        ? `${load.origin_city}, ${load.origin_state}` 
        : 'Location TBD'),
    startDate: formatDateTime(load.DEPART_DATE || load.pu_drop_date1 || '', load.pu_drop_time1 || '', false),
    startTime: formatTime(load.pu_drop_time1 || ''),
    endLocation: load.TOCITY && load.TOSTATE 
      ? `${load.TOCITY.trim()}, ${load.TOSTATE.trim()}` 
      : (load.destination_city && load.destination_state 
        ? `${load.destination_city}, ${load.destination_state}` 
        : 'Location TBD'),
    endDate: formatDateTime(load.dropoff_date || '', load.dropoff_time || '', true),
    endTime: formatTime(load.dropoff_time || ''),
    dispatcher: load.dispatcher_initials || 'N/A',
    notes: load.notes || 'No notes available',
    departDate: load.use_depart_date || 'TBD'
  }
}