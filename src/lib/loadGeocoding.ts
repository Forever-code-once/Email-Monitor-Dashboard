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
  console.log(`🔄 Converting ${loads.length} loads to individual pins...`)
  const pins: LoadPin[] = []
  
  for (const load of loads) {
    try {
      console.log(`📋 Processing load: REF_NUMBER=${load.REF_NUMBER}, FROMCITY=${load.FROMCITY}, FROMSTATE=${load.FROMSTATE}`)
      
      let location = ''
      let coordinates: [number, number] | null = null
      
      // Use the actual API response fields
      if (load.FROMCITY && load.FROMSTATE) {
        location = `${load.FROMCITY.trim()}, ${load.FROMSTATE.trim()}, USA`
        // Use coordinates if available (more accurate than geocoding)
        if (load.FROMLAT && load.FROMLONG) {
          // FROMLAT is latitude, FROMLONG is longitude
          coordinates = [load.FROMLAT, load.FROMLONG]
        }
      } else if (load.origin_city && load.origin_state) {
        // Fallback to legacy fields
        location = `${load.origin_city}, ${load.origin_state}, USA`
      }
      
      if (location) {
        let latitude: number
        let longitude: number
        
        if (coordinates) {
          // Use exact coordinates from API
          // coordinates = [FROMLAT, FROMLONG] = [latitude, longitude]
          [latitude, longitude] = coordinates
          
          // Apply longitude correction here, before validation and pin creation
          // US longitudes should be negative. If positive, make it negative.
          if (longitude > 0) {
            longitude = -longitude;
            console.log(`🔄 Corrected positive longitude to negative: ${longitude}`);
          }
          
          // Validate coordinates
          if (latitude < -90 || latitude > 90) {
            console.error(`❌ Invalid latitude value: ${latitude} for load ${load.REF_NUMBER}`)
            continue
          }
          if (longitude < -180 || longitude > 180) {
            console.error(`❌ Invalid longitude value: ${longitude} for load ${load.REF_NUMBER}`)
            continue
          }
          
          console.log(`📍 Using exact coordinates for ${load.company_name}: latitude=${latitude}, longitude=${longitude}`)
        } else {
          // Fallback to geocoding
          const geocodeResult = await geocodeAddress(location.split(',')[0].trim(), location.split(',')[1].trim())
          if (!geocodeResult) {
            console.log(`⚠️ Could not geocode location for load ${load.ref_number}`)
            continue
          }
          latitude = geocodeResult.latitude
          longitude = geocodeResult.longitude
          
          // Apply longitude correction for geocoded coordinates too
          if (longitude > 0) {
            longitude = -longitude;
            console.log(`🔄 Corrected geocoded positive longitude to negative: ${longitude}`);
          }
        }
        
        const pin: LoadPin = {
          id: `load-${load.REF_NUMBER || load.ref_number || 'unknown'}`,
          type: 'load',
          latitude: latitude,
          longitude: longitude,
          title: `${load.company_name || 'Unknown Company'} - Load ${load.REF_NUMBER || load.ref_number || 'unknown'}`,
          data: load
        }
      
        pins.push(pin)
        console.log(`✅ Created load pin for ${load.company_name} at ${location}`)
      } else {
        console.log(`⚠️ No location data for load ${load.ref_number}`)
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