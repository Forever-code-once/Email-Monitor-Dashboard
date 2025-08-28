'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import {
  Box,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material'
import { MapPin } from '@/types/map'

// Set Mapbox access token - use public token for client-side
// For production, you'll need to either:
// 1. Use a public token (pk.*) for client-side
// 2. Or implement a custom map solution
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface TruckMapProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  onPinClick: (pin: MapPin) => void
  pins: MapPin[]
  loadPins?: any[]
  loading?: boolean
}

export function TruckMap({ 
  selectedDate, 
  onDateChange, 
  onPinClick, 
  pins, 
  loadPins = [],
  loading = false 
}: TruckMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map())

  // Debug: Log Mapbox token status
  useEffect(() => {
    console.log('🗺️ Mapbox token status:', {
      hasToken: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      tokenLength: process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.length || 0,
      tokenPrefix: process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.substring(0, 3) || 'none'
    })
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-98.5795, 39.8283], // Center of USA
      zoom: 4,
      maxBounds: [
        [-125, 24], // Southwest coordinates (roughly USA boundaries)
        [-66, 50]   // Northeast coordinates
      ],
      minZoom: 3,
      maxZoom: 12
    })

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    // Add scale control
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left')

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update pins when pins array changes
  useEffect(() => {
    if (!map.current) return

    // Remove existing markers
    markers.current.forEach(marker => marker.remove())
    markers.current.clear()

    // Add truck markers
    pins.forEach(pin => {
      // Create truck marker element (blue circle with truck count)
      const markerElement = document.createElement('div')
      markerElement.className = 'custom-marker truck-marker'
      markerElement.innerHTML = `
        <div style="
          background: #1976d2;
          color: white;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          🚛
        </div>
      `

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'custom-popup'
      }).setHTML(`
        <div style="padding: 8px; min-width: 150px;">
          <div style="font-weight: bold; margin-bottom: 4px;">
            ${pin.city}, ${pin.state}
          </div>
          <div style="font-size: 12px; color: #666;">
            ${pin.truckCount} truck${pin.truckCount !== 1 ? 's' : ''} available
          </div>
          <div style="font-size: 11px; color: #999; margin-top: 4px;">
            Click for details
          </div>
        </div>
      `)

      // Create marker
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([pin.longitude, pin.latitude])
        .setPopup(popup)
        .addTo(map.current!)

      // Add click handler
      markerElement.addEventListener('click', () => {
        onPinClick(pin)
      })

      // Store marker reference
      markers.current.set(pin.id, marker)
    })

    // Add load markers
    loadPins.forEach(loadPin => {
      // Create load marker element (orange square with package icon)
      const markerElement = document.createElement('div')
      markerElement.className = 'custom-marker load-marker'
      markerElement.innerHTML = `
        <div style="
          background: #ff9800;
          color: white;
          border-radius: 4px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 16px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          📦
        </div>
      `

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'custom-popup'
      }).setHTML(`
        <div style="padding: 8px; min-width: 150px;">
          <div style="font-weight: bold; margin-bottom: 4px;">
            ${loadPin.data.company_name}
          </div>
          <div style="font-size: 12px; color: #666;">
            Load #${loadPin.data.ref_number}
          </div>
          <div style="font-size: 11px; color: #999; margin-top: 4px;">
            Click for details
          </div>
        </div>
      `)

      // Create marker
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([loadPin.longitude, loadPin.latitude])
        .setPopup(popup)
        .addTo(map.current!)

      // Add click handler
      markerElement.addEventListener('click', () => {
        onPinClick(loadPin)
      })

      // Store marker reference
      markers.current.set(loadPin.id, marker)
    })

    // Fit map to show all pins if there are any
    const allPins = [...pins, ...loadPins]
    if (allPins.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      allPins.forEach(pin => {
        bounds.extend([pin.longitude, pin.latitude])
      })
      
      map.current!.fitBounds(bounds, {
        padding: 50,
        maxZoom: 8
      })
    }
  }, [pins, loadPins, onPinClick])

  // Add custom CSS for markers and popups
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .custom-popup .mapboxgl-popup-content {
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border: none;
      }
      
      .custom-popup .mapboxgl-popup-tip {
        border-top-color: white;
      }
      
      .mapboxgl-popup-close-button {
        display: none;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Mapbox access token not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN environment variable.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          To use the map view, you need to:
          <br />
          1. Sign up for a free Mapbox account
          <br />
          2. Get your access token
          <br />
          3. Add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ position: 'relative', height: '70vh', width: '100%' }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.8)',
            zIndex: 1000,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      
      <div 
        ref={mapContainer} 
        style={{ 
          height: '100%', 
          width: '100%',
          borderRadius: '8px',
          overflow: 'hidden'
        }} 
      />
      
      {pins.length === 0 && !loading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: 2,
            borderRadius: 2,
            boxShadow: 2,
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No trucks available for this date
          </Typography>
        </Box>
      )}
    </Box>
  )
} 