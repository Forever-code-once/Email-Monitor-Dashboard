import { LoadData, MapPin } from '@/types'
import { geocodeAddress } from './geocoding'

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
  console.log(`🔄 Converting ${loads.length} loads to grouped pins by location...`)
  
  // Group loads by location
  const locationGroups = new Map<string, LoadData[]>()
  
  for (const load of loads) {
    try {
      console.log(`📋 Processing load: REF_NUMBER=${load.REF_NUMBER}, FROMCITY=${load.FROMCITY}, FROMSTATE=${load.FROMSTATE}`)
      
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
        
        console.log(`📍 Grouped load ${load.REF_NUMBER} under location: ${locationKey}`)
      } else {
        console.log(`⚠️ No location data for load ${load.REF_NUMBER}`)
      }
    } catch (error) {
      console.error(`❌ Error processing load ${load.REF_NUMBER}:`, error)
    }
  }
  
  console.log(`🗺️ Created ${locationGroups.size} location groups`)
  
  // Create pins for each location group
  const pins: LoadPin[] = []
  
  for (const [locationKey, locationLoads] of Array.from(locationGroups.entries())) {
    try {
      const [city, state] = locationKey.split(', ')
      const firstLoad = locationLoads[0]
      
      let latitude: number
      let longitude: number
      
      // Use coordinates from first load if available
      if (firstLoad.FROMLAT && firstLoad.FROMLONG) {
        latitude = firstLoad.FROMLAT
        longitude = firstLoad.FROMLONG
        
        // Apply longitude correction for US locations
        if (longitude > 0) {
          longitude = -longitude;
          console.log(`🔄 Corrected positive longitude to negative: ${longitude}`);
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
        
        console.log(`📍 Using exact coordinates for ${locationKey}: latitude=${latitude}, longitude=${longitude}`)
      } else {
        // Fallback to geocoding
        const geocodeResult = await geocodeAddress(city, state)
        if (!geocodeResult) {
          console.log(`⚠️ Could not geocode location: ${locationKey}`)
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
      
      // Get the most common date from loads (or use first load's date)
      const date = firstLoad.pu_drop_date1 || 'TBD'
      
      const pin: LoadPin = {
        id: `load-${city}-${state}`,
        type: 'load',
        latitude: latitude,
        longitude: longitude,
        city: city,
        state: state,
        loads: locationLoads,
        loadCount: locationLoads.length,
        date: date,
        title: `${city}, ${state} - ${locationLoads.length} load${locationLoads.length !== 1 ? 's' : ''}`,
        data: firstLoad // Keep first load as primary data for compatibility
      }
      
      pins.push(pin)
      console.log(`✅ Created grouped load pin for ${locationKey}: ${locationLoads.length} loads`)
    } catch (error) {
      console.error(`❌ Error creating pin for location ${locationKey}:`, error)
    }
  }
  
  console.log(`🎯 Created ${pins.length} grouped load pins`)
  return pins
}

/**
 * Format load data for display in popup
 */
export function formatLoadInfo(load: LoadData) {
  return {
    company: load.company_name,
    refNumber: load.REF_NUMBER || load.ref_number,
    startLocation: load.FROMCITY && load.FROMSTATE 
      ? `${load.FROMCITY.trim()}, ${load.FROMSTATE.trim()}` 
      : (load.origin_city && load.origin_state 
        ? `${load.origin_city}, ${load.origin_state}` 
        : 'Location TBD'),
    startDate: load.pu_drop_date1 || 'TBD',
    startTime: load.pu_drop_time1 || 'TBD',
    endLocation: load.TOCITY && load.TOSTATE 
      ? `${load.TOCITY.trim()}, ${load.TOSTATE.trim()}` 
      : (load.destination_city && load.destination_state 
        ? `${load.destination_city}, ${load.destination_state}` 
        : 'Location TBD'),
    endDate: load.dropoff_date || 'TBD',
    endTime: load.dropoff_time || 'TBD',
    dispatcher: load.dispatcher_initials || 'N/A',
    notes: load.notes || 'No notes available',
    departDate: load.use_depart_date || 'TBD'
  }
}