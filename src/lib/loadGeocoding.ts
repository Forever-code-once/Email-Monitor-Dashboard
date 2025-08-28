import { LoadData, MapPin } from '@/types'
import { geocodeAddress } from './geocoding'

export interface LoadPin extends MapPin {
  type: 'load'
  data: LoadData
}

/**
 * Convert load data to map pins by geocoding locations
 */
export async function convertLoadsToPins(loads: LoadData[]): Promise<LoadPin[]> {
  const pins: LoadPin[] = []
  
  for (const load of loads) {
    try {
      // Try to geocode the pickup location first
      let location = ''
      let coordinates: [number, number] | null = null
      
      // Try different location fields from the load data
      if (load.origin_city && load.origin_state) {
        location = `${load.origin_city}, ${load.origin_state}, USA`
      } else if (load.pu_drop_date1) {
        // If we have pickup info, try to extract location from notes or other fields
        location = `${load.pu_drop_date1}, USA`
      }
      
      if (location) {
        const geocodeResult = await geocodeAddress(location.split(',')[0].trim(), location.split(',')[1].trim())
        if (geocodeResult) {
          const pin: LoadPin = {
            id: `load-${load.ref_number}`,
            type: 'load',
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            title: `${load.company_name} - Load ${load.ref_number}`,
            data: load
          }
        
          pins.push(pin)
          console.log(`✅ Created load pin for ${load.company_name} at ${location}`)
        } else {
          console.log(`⚠️ Could not geocode location for load ${load.ref_number}`)
        }
      }
    } catch (error) {
      console.error(`❌ Error creating pin for load ${load.ref_number}:`, error)
    }
  }
  
  return pins
}

/**
 * Format load data for display in popup
 */
export function formatLoadInfo(load: LoadData) {
  return {
    company: load.company_name,
    refNumber: load.ref_number,
    startLocation: load.origin_city && load.origin_state 
      ? `${load.origin_city}, ${load.origin_state}` 
      : 'Location TBD',
    startDate: load.pu_drop_date1 || 'TBD',
    startTime: load.pu_drop_time1 || 'TBD',
    endLocation: load.destination_city && load.destination_state 
      ? `${load.destination_city}, ${load.destination_state}` 
      : 'Location TBD',
    endDate: load.dropoff_date || 'TBD',
    endTime: load.dropoff_time || 'TBD',
    dispatcher: load.dispatcher_initials || 'N/A',
    notes: load.notes || 'No notes available',
    departDate: load.use_depart_date || 'TBD'
  }
} 