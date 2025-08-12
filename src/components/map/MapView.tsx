'use client'

import { useState, useEffect, useCallback } from 'react'
import { Box, Alert, Typography } from '@mui/material'
import { DateNavigation } from './DateNavigation'
import { TruckMap } from './TruckMap'
import { TruckDetailCard } from './TruckDetailCard'
import { MapPin } from '@/types/map'
import { TruckAvailability } from '@/types'
import { geocodeAddress, preCacheCommonCities } from '@/lib/geocoding'

interface MapViewProps {
  customerCards: any[] // Using existing customer cards data
  onViewEmails?: (customerEmail: string) => void
}

export function MapView({ customerCards, onViewEmails }: MapViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)
  const [pins, setPins] = useState<MapPin[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null)
  const [detailCardOpen, setDetailCardOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Debug: Log customer cards data
  useEffect(() => {
    console.log('🗺️ MapView received customerCards:', {
      count: customerCards.length,
      sampleCard: customerCards[0] ? {
        customer: customerCards[0].customer,
        email: customerCards[0].customerEmail,
        truckCount: customerCards[0].trucks.length,
        sampleTruck: customerCards[0].trucks[0]
      } : null
    })
  }, [customerCards])

  // Get all available dates from customer cards
  const availableDates = useCallback(() => {
    const dates = new Set<string>()
    customerCards.forEach(card => {
      card.trucks.forEach((truck: TruckAvailability) => {
        dates.add(truck.date)
      })
    })
    
    // Filter and validate dates
    const validDates = Array.from(dates)
      .filter(dateStr => {
        if (!dateStr || typeof dateStr !== 'string') return false
        const date = new Date(dateStr)
        return !isNaN(date.getTime())
      })
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime())
    
    console.log('🗺️ Available dates from customer cards:', validDates.map(d => d.toISOString().split('T')[0]))
    return validDates
  }, [customerCards])

  // Convert truck data to map pins
  const createMapPins = useCallback(async (date: Date, range?: { start: Date; end: Date } | null) => {
    console.log('🗺️ createMapPins called with:', { date, range, customerCardsLength: customerCards.length })
    
    if (customerCards.length === 0) {
      console.log('🗺️ No customer cards available, skipping pin creation')
      setPins([])
      return
    }
    
    // Validate date parameters
    if (isNaN(date.getTime())) {
      console.log('🗺️ Invalid date provided, skipping pin creation')
      setPins([])
      return
    }
    
    if (range && (isNaN(range.start.getTime()) || isNaN(range.end.getTime()))) {
      console.log('🗺️ Invalid date range provided, skipping pin creation')
      setPins([])
      return
    }
    
    setLoading(true)
    
    try {
      let trucksForDate: TruckAvailability[] = []
      
      console.log('🗺️ Creating map pins for:', { 
        date: isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString().split('T')[0], 
        range 
      })
      console.log('🗺️ Available customer cards:', customerCards.length)
      
      // Debug: Log first few customer cards
      if (customerCards.length > 0) {
        console.log('🗺️ Sample customer card:', {
          customer: customerCards[0].customer,
          email: customerCards[0].customerEmail,
          truckCount: customerCards[0].trucks.length,
          sampleTruck: customerCards[0].trucks[0]
        })
      }
      
      if (range) {
        // Filter trucks for the date range
        // Convert range dates to MM/DD format for comparison
        const startMonth = (range.start.getMonth() + 1).toString()
        const startDay = range.start.getDate().toString()
        const startStr = `${startMonth}/${startDay}`
        
        const endMonth = (range.end.getMonth() + 1).toString()
        const endDay = range.end.getDate().toString()
        const endStr = `${endMonth}/${endDay}`
        
        console.log('🗺️ Filtering for date range:', startStr, 'to', endStr)
        
        customerCards.forEach(card => {
          card.trucks.forEach((truck: TruckAvailability) => {
            let truckDateStr = truck.date
            
            // If truck date is in YYYY-MM-DD format, convert to MM/DD
            if (truckDateStr.includes('-') && truckDateStr.length > 5) {
              const [year, month, day] = truckDateStr.split('-')
              truckDateStr = `${parseInt(month)}/${parseInt(day)}`
            }
            
            // Simple string comparison for MM/DD format
            if (truckDateStr >= startStr && truckDateStr <= endStr) {
              trucksForDate.push(truck)
            }
          })
        })
      } else {
        // Filter trucks for the selected date
        // Convert selected date to MM/DD format to match truck dates
        const month = (date.getMonth() + 1).toString() // getMonth() is 0-indexed
        const day = date.getDate().toString()
        const dateStr = `${month}/${day}` // MM/DD format
        
        console.log('🗺️ Filtering for single date:', dateStr)
        
        customerCards.forEach(card => {
          card.trucks.forEach((truck: TruckAvailability) => {
            // Handle different date formats in truck data
            let truckDateStr = truck.date
            
            // If truck date is in YYYY-MM-DD format, convert to MM/DD
            if (truckDateStr.includes('-') && truckDateStr.length > 5) {
              const [year, month, day] = truckDateStr.split('-')
              truckDateStr = `${parseInt(month)}/${parseInt(day)}`
            }
            
            if (truckDateStr === dateStr) {
              trucksForDate.push(truck)
            }
          })
        })
      }

      console.log('🗺️ Found trucks for date/range:', trucksForDate.length)

      if (trucksForDate.length === 0) {
        setPins([])
        return
      }

      // Filter out deleted trucks from localStorage
      const filteredTrucks = trucksForDate.filter(truck => {
        try {
          const storageKey = `truck-state-${truck.city}-${truck.state}`
          const deletedTrucksData = localStorage.getItem(`${storageKey}-deleted`)
          const deletedTrucks = deletedTrucksData ? JSON.parse(deletedTrucksData) : []
          
          if (!Array.isArray(deletedTrucks)) {
            console.warn('Invalid deleted trucks data, clearing corrupted data')
            localStorage.removeItem(`${storageKey}-deleted`)
            return true // Show the truck if data is corrupted
          }
          
          return !deletedTrucks.includes(truck.id)
        } catch (error) {
          console.error('Error checking deleted trucks:', error)
          return true // Show the truck if there's an error
        }
      })

      console.log('🗺️ Filtered trucks after removing deleted:', filteredTrucks.length)

      // Group trucks by location
      const locationGroups = new Map<string, TruckAvailability[]>()
      
      filteredTrucks.forEach(truck => {
        const key = `${truck.city}, ${truck.state}`.toLowerCase()
        if (!locationGroups.has(key)) {
          locationGroups.set(key, [])
        }
        locationGroups.get(key)!.push(truck)
      })

      // Geocode locations and create pins
      const pinPromises = Array.from(locationGroups.entries()).map(async ([locationKey, trucks]) => {
        const [city, state] = locationKey.split(', ')
        
        // Geocode the location
        const geocodeResult = await geocodeAddress(city, state)
        
        if (geocodeResult) {
          return {
            id: locationKey,
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            city: trucks[0].city,
            state: trucks[0].state,
            trucks: trucks,
            date: range ? 
              `${range.start.getMonth() + 1}/${range.start.getDate()} - ${range.end.getMonth() + 1}/${range.end.getDate()}` : 
              `${date.getMonth() + 1}/${date.getDate()}`,
            truckCount: trucks.length
          } as MapPin
        }
        
        return null
      })

      const pinResults = await Promise.all(pinPromises)
      const validPins = pinResults.filter(pin => pin !== null) as MapPin[]
      
      setPins(validPins)
                  const dateDisplay = range ? 
              `${isNaN(range.start.getTime()) ? new Date().toISOString().split('T')[0] : range.start.toISOString().split('T')[0]} - ${isNaN(range.end.getTime()) ? new Date().toISOString().split('T')[0] : range.end.toISOString().split('T')[0]}` : 
              (isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0])
      console.log(`🗺️ Created ${validPins.length} map pins for ${dateDisplay}`)
      
    } catch (error) {
      console.error('❌ Error creating map pins:', error)
    } finally {
      setLoading(false)
    }
  }, [customerCards])

  // Initialize with first available date
  useEffect(() => {
    if (!initialized && customerCards.length > 0) {
      const dates = availableDates()
      if (dates.length > 0 && !isNaN(dates[0].getTime())) {
        console.log('🗺️ Initializing with first available date:', dates[0].toISOString().split('T')[0])
        setSelectedDate(dates[0])
        setInitialized(true)
      }
    }
  }, [customerCards, availableDates, initialized])

  // Update pins when date or date range changes
  useEffect(() => {
    if (initialized && !isNaN(selectedDate.getTime())) {
      createMapPins(selectedDate, dateRange)
    }
  }, [selectedDate, dateRange, createMapPins, initialized])

  // Pre-cache common cities on component mount
  useEffect(() => {
    preCacheCommonCities()
  }, [])

  const handlePreviousDay = () => {
    if (!isNaN(selectedDate.getTime())) {
      const prevDate = new Date(selectedDate)
      prevDate.setDate(prevDate.getDate() - 1)
      setSelectedDate(prevDate)
    }
    setDateRange(null) // Clear date range when using single date navigation
  }

  const handleNextDay = () => {
    if (!isNaN(selectedDate.getTime())) {
      const nextDate = new Date(selectedDate)
      nextDate.setDate(nextDate.getDate() + 1)
      setSelectedDate(nextDate)
    }
    setDateRange(null) // Clear date range when using single date navigation
  }

  const handleDateSelect = (date: Date, range?: { start: Date; end: Date }) => {
    if (!isNaN(date.getTime())) {
      setSelectedDate(date)
    }
    if (range && !isNaN(range.start.getTime()) && !isNaN(range.end.getTime())) {
      setDateRange(range)
    } else {
      setDateRange(null)
    }
  }

  const handlePinClick = (pin: MapPin) => {
    setSelectedPin(pin)
    setDetailCardOpen(true)
  }

  const handleCloseDetailCard = () => {
    setDetailCardOpen(false)
    setSelectedPin(null)
  }

  const handleTruckDeleted = () => {
    // Refresh the map pins to reflect the deletion
    if (initialized && !isNaN(selectedDate.getTime())) {
      createMapPins(selectedDate, dateRange)
    }
  }

  const dates = availableDates()

  if (customerCards.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          The map will display truck availability pins for different cities across the USA.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <DateNavigation
        selectedDate={selectedDate}
        onPreviousDay={handlePreviousDay}
        onNextDay={handleNextDay}
        onDateSelect={handleDateSelect}
        availableDates={dates}
      />
      
      <TruckMap
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onPinClick={handlePinClick}
        pins={pins}
        loading={loading}
      />
      
             {selectedPin && (
         <TruckDetailCard
           pin={selectedPin}
           onClose={handleCloseDetailCard}
           open={detailCardOpen}
           onTruckDeleted={handleTruckDeleted}
         />
       )}
    </Box>
  )
} 