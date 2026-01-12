'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import {
  Box,
  CircularProgress,
  Alert,
  Typography,
  IconButton,
  Tooltip,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { Cloud, Satellite, Layers } from '@mui/icons-material'
import { MapPin } from '@/types/map'
import { LoadPin } from '@/lib/loadGeocoding'
import { detectDominantTruckType } from '@/lib/truckTypeDetector'
import { useTheme } from '@/components/providers/ThemeProvider'
import { normalizeCityName } from '@/lib/geocoding'

// Set Mapbox access token - use public token for client-side
// For production, you'll need to either:
// 1. Use a public token (pk.*) for client-side
// 2. Or implement a custom map solution
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface TruckMapProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  onPinClick: (pin: MapPin | LoadPin) => void
  pins: MapPin[]
  loadPins?: LoadPin[]
  loading?: boolean
  onLoadRightClick?: (loadPin: LoadPin) => void
  onTruckRightClick?: (truckPin: MapPin) => void
  selectedLoad?: LoadPin | null
  selectedTruck?: MapPin | null
  distanceMeasurement?: {
    distance: number
    unit: string
    fromLoad: string
    toTruck: string
  } | null
  onClearDistanceMeasurement?: () => void
}

export function TruckMap({ 
  selectedDate, 
  onDateChange, 
  onPinClick, 
  pins, 
  loadPins = [],
  loading = false,
  onLoadRightClick,
  onTruckRightClick,
  selectedLoad,
  selectedTruck,
  distanceMeasurement,
  onClearDistanceMeasurement
}: TruckMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const { darkMode } = useTheme()
  const [weatherLayer, setWeatherLayer] = useState<'none' | 'precipitation'>('precipitation')
  const weatherCache = useRef<Map<string, { data: any; timestamp: number }>>(new Map())

  // Debug: Log Mapbox token status
  useEffect(() => {
    // Token validation removed
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
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

    // Add scale control with imperial units (miles/feet)
    map.current.addControl(new mapboxgl.ScaleControl({
      maxWidth: 100,
      unit: 'imperial' // This ensures distances are displayed in miles and feet
    }), 'bottom-left')

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update map style when dark mode changes
  useEffect(() => {
    if (!map.current) return
    
    // Keep satellite style regardless of dark mode
    const newStyle = 'mapbox://styles/mapbox/satellite-streets-v12'
    map.current.setStyle(newStyle)
    
    // Re-add weather layer after style change
    if (weatherLayer !== 'none') {
      map.current.once('style.load', () => {
        addWeatherLayer(weatherLayer)
      })
    }
  }, [darkMode])

  // Fetch weather forecast for a location
  const fetchWeatherForecast = useCallback(async (lat: number, lon: number): Promise<any> => {
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`
    const cached = weatherCache.current.get(cacheKey)
    
    // Use cache if less than 2 hours old
    if (cached && Date.now() - cached.timestamp < 2 * 60 * 60 * 1000) {
      return cached.data
    }

    try {
      const response = await fetch(`/api/weather-forecast?lat=${lat}&lon=${lon}`)
      if (!response.ok) {
        console.warn('⚠️ Weather forecast unavailable')
        return null
      }
      
      const data = await response.json()
      
      // Cache the result
      weatherCache.current.set(cacheKey, {
        data,
        timestamp: Date.now()
      })
      
      return data
    } catch (error) {
      console.error('❌ Error fetching weather forecast:', error)
      return null
    }
  }, [])

  // Format weather forecast HTML
  const formatWeatherHTML = (forecast: any): string => {
    if (!forecast || !forecast.forecasts || forecast.forecasts.length === 0) {
      return '<div style="font-size: 11px; color: #999; margin-top: 4px;">Weather data unavailable</div>'
    }

    const getWeatherEmoji = (condition: string): string => {
      const emojiMap: Record<string, string> = {
        'Clear': '☀️',
        'Clouds': '☁️',
        'Rain': '🌧️',
        'Drizzle': '🌦️',
        'Thunderstorm': '⛈️',
        'Snow': '❄️',
        'Mist': '🌫️',
        'Fog': '🌫️',
        'Haze': '🌫️'
      }
      return emojiMap[condition] || '🌤️'
    }

    let html = '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">'
    html += '<div style="font-size: 11px; font-weight: bold; color: #666; margin-bottom: 4px;">4-Day Forecast</div>'
    
    forecast.forecasts.slice(0, 4).forEach((day: any) => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin: 2px 0;">
          <span style="width: 35px;">${day.dayOfWeek}</span>
          <span style="width: 20px; text-align: center;">${getWeatherEmoji(day.condition)}</span>
          <span style="width: 60px; text-align: right; color: #666;">
            <span style="color: #d32f2f;">${day.tempHigh}°</span>/<span style="color: #1976d2;">${day.tempLow}°</span>
          </span>
          ${day.precipitation > 0 ? `<span style="width: 40px; text-align: right; color: #2196f3; font-size: 10px;">${day.precipitation}mm</span>` : ''}
        </div>
      `
    })
    
    html += '</div>'
    return html
  }

  // Fetch latest radar timestamp from RainViewer
  const fetchRadarTimestamp = useCallback(async () => {
    try {
      const response = await fetch('https://api.rainviewer.com/public/weather-maps.json')
      const data = await response.json()
      
      if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
        // Get the most recent timestamp
        const latestTimestamp = data.radar.past[data.radar.past.length - 1].time
        console.log('✅ Radar timestamp fetched:', latestTimestamp)
        return latestTimestamp
      }
      
      // Fallback to current time rounded to 10 minutes
      return Math.floor(Date.now() / 1000 / 600) * 600
    } catch (error) {
      console.error('❌ Error fetching radar timestamp:', error)
      // Fallback to current time rounded to 10 minutes
      return Math.floor(Date.now() / 1000 / 600) * 600
    }
  }, [])

  // Add weather layer function
  const addWeatherLayer = useCallback(async (layerType: 'precipitation') => {
    if (!map.current) return

    try {
      // Remove existing weather layers
      if (map.current.getLayer('weather-layer')) {
        map.current.removeLayer('weather-layer')
      }
      if (map.current.getSource('weather-source')) {
        map.current.removeSource('weather-source')
      }

      const baseUrl = window.location.origin

      // Use RainViewer for real-time precipitation radar
      const timestamp = await fetchRadarTimestamp()
      
      map.current.addSource('weather-source', {
        type: 'raster',
        tiles: [
          `${baseUrl}/api/weather-proxy?layer=precipitation&timestamp=${timestamp}&z={z}&x={x}&y={y}`
        ],
        tileSize: 256
      })
      
      map.current.addLayer({
        id: 'weather-layer',
        type: 'raster',
        source: 'weather-source',
        paint: {
          'raster-opacity': 0.85,
          'raster-fade-duration': 0
        }
      })
      
      console.log(`✅ Weather radar added with timestamp: ${timestamp}`)
    } catch (error) {
      console.error('❌ Error adding weather layer:', error)
      console.warn('⚠️ Weather data may be temporarily unavailable')
    }
  }, [fetchRadarTimestamp])

  // Handle weather layer toggle
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return

    // Remove existing weather layers
    if (map.current.getLayer('weather-layer')) {
      map.current.removeLayer('weather-layer')
    }
    if (map.current.getSource('weather-source')) {
      map.current.removeSource('weather-source')
    }

    // Add new weather layer if selected
    if (weatherLayer === 'precipitation') {
      addWeatherLayer('precipitation')
    }
  }, [weatherLayer, addWeatherLayer])

  // Re-render markers when selection changes
  useEffect(() => {
    if (!map.current || pins.length === 0) return
    
    // Re-render all markers to update selection styling
    markers.current.forEach(marker => marker.remove())
    markers.current.clear()
    
    // Re-add truck markers
    pins.forEach(pin => {
      const isSelected = selectedTruck && selectedTruck.id === pin.id
      
      // Detect truck type from additionalInfo
      const truckTypeInfo = detectDominantTruckType(pin.trucks)
      
      const markerElement = document.createElement('div')
      markerElement.className = 'custom-marker truck-marker'
      markerElement.innerHTML = `
        <div style="
          background: ${truckTypeInfo.color};
          color: white;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          border: 2px solid ${isSelected ? '#FF5722' : 'white'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.2s;
          ${isSelected ? 'transform: scale(1.3); z-index: 1000;' : ''}
        " onmouseover="this.style.transform='${isSelected ? 'scale(1.4)' : 'scale(1.1)'}'" onmouseout="this.style.transform='${isSelected ? 'scale(1.3)' : 'scale(1)'}'">
          ${truckTypeInfo.icon}
        </div>
      `

      // Create unique ID for weather div
      const weatherId = `weather-${pin.latitude.toFixed(4)}-${pin.longitude.toFixed(4)}-${Date.now()}`
      
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        className: 'custom-popup'
      }).setHTML(`
        <div style="padding: 12px; min-width: 200px;">
          <div style="font-weight: bold; margin-bottom: 6px; font-size: 14px;">
            ${normalizeCityName(pin.city, pin.state)}, ${pin.state}
          </div>
          <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
            ${pin.truckCount} truck${pin.truckCount !== 1 ? 's' : ''} available
          </div>
          <div style="font-size: 12px; color: ${truckTypeInfo.color}; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
            <span>${truckTypeInfo.icon}</span>
            <span>${truckTypeInfo.label}</span>
          </div>
          <div id="${weatherId}" style="min-height: 20px;">
            <div style="font-size: 11px; color: #999; margin-top: 4px;">Loading weather...</div>
          </div>
        </div>
      `)

      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([pin.longitude, pin.latitude])
        .setPopup(popup)
        .addTo(map.current!)

      // Load weather forecast when popup opens
      popup.on('open', async () => {
        const weatherDiv = document.getElementById(weatherId)
        if (weatherDiv) {
          console.log(`🌦️ Loading weather for ${pin.city}, ${pin.state}`)
          const forecast = await fetchWeatherForecast(pin.latitude, pin.longitude)
          if (forecast) {
            weatherDiv.innerHTML = formatWeatherHTML(forecast)
          } else {
            weatherDiv.innerHTML = '<div style="font-size: 11px; color: #999;">Weather unavailable</div>'
          }
        }
      })

      markerElement.addEventListener('click', (e) => {
        e.stopPropagation()
        // Toggle popup on click
        if (popup.isOpen()) {
          popup.remove()
        } else {
          popup.addTo(map.current!)
        }
        onPinClick(pin)
      })

      markerElement.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        if (onTruckRightClick) {
          onTruckRightClick(pin)
        }
      })

      markers.current.set(pin.id, marker)
    })

    // Re-add load markers
    loadPins.forEach(loadPin => {
      const isSelected = selectedLoad && selectedLoad.id === loadPin.id
      
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
          font-size: 12px;
          border: 2px solid ${isSelected ? '#FF5722' : 'white'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.2s;
          ${isSelected ? 'transform: scale(1.3); z-index: 1000;' : ''}
        " onmouseover="this.style.transform='${isSelected ? 'scale(1.4)' : 'scale(1.1)'}'" onmouseout="this.style.transform='${isSelected ? 'scale(1.3)' : 'scale(1)'}'">
          📦
        </div>
      `

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'custom-popup'
      }).setHTML(`
        <div style="padding: 8px; min-width: 150px;">
          <div style="font-weight: bold; margin-bottom: 4px;">
            ${normalizeCityName(loadPin.city, loadPin.state)}, ${loadPin.state}
          </div>
          <div style="font-size: 12px; color: #666;">
            ${loadPin.loadCount} load${loadPin.loadCount !== 1 ? 's' : ''} available
          </div>
          <div style="font-size: 11px; color: #999; margin-top: 4px;">
            Click for details
          </div>
        </div>
      `)

      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([loadPin.longitude, loadPin.latitude])
        .setPopup(popup)
        .addTo(map.current!)

      markerElement.addEventListener('click', () => {
        onPinClick(loadPin)
      })

      markerElement.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        if (onLoadRightClick) {
          onLoadRightClick(loadPin)
        }
      })

      markers.current.set(loadPin.id, marker)
    })
  }, [selectedLoad, selectedTruck, pins, loadPins, onPinClick, onTruckRightClick, onLoadRightClick])

  // Fit map to show all pins when pins change
  useEffect(() => {
    if (!map.current) return
    
    const allPins = [...pins, ...loadPins]
    if (allPins.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      allPins.forEach(pin => {
        bounds.extend([pin.longitude, pin.latitude])
      })
      
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 8
      })
    }
  }, [pins, loadPins])

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
    <Box sx={{ position: 'relative', height: '75vh', width: '100%' }}>
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
            backgroundColor: darkMode ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)',
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
      
      {/* Truck Type Legend */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          bottom: 40,
          left: 20,
          zIndex: 1000,
          p: 1.5,
          backgroundColor: darkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
          minWidth: 160,
        }}
      >
        <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 1 }}>
          Truck Types
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 24, 
              height: 24, 
              bgcolor: '#4CAF50', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              🚐
            </Box>
            <Typography variant="caption">Van / Dry Van</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 24, 
              height: 24, 
              bgcolor: '#2196F3', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              ❄️
            </Box>
            <Typography variant="caption">Refrigerated</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 24, 
              height: 24, 
              bgcolor: '#795548', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              📦
            </Box>
            <Typography variant="caption">Flatbed</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 24, 
              height: 24, 
              bgcolor: '#FF6B00', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              ☢️
            </Box>
            <Typography variant="caption">Hazmat</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 24, 
              height: 24, 
              bgcolor: '#1976d2', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              🚛
            </Box>
            <Typography variant="caption">Standard</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Precipitation Legend */}
      {weatherLayer === 'precipitation' && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: 40,
            left: 200,
            zIndex: 1000,
            p: 1.5,
            backgroundColor: darkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
            minWidth: 140,
          }}
        >
          <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
            Precipitation Radar
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, fontSize: '11px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: '#00BFFF', borderRadius: 0.5 }} />
              <Typography variant="caption">Light</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: '#00FF00', borderRadius: 0.5 }} />
              <Typography variant="caption">Moderate</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: '#FFFF00', borderRadius: 0.5 }} />
              <Typography variant="caption">Heavy</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: '#FF0000', borderRadius: 0.5 }} />
              <Typography variant="caption">Severe</Typography>
            </Box>
          </Box>
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block', 
              mt: 1, 
              pt: 1, 
              borderTop: '1px solid',
              borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              fontSize: '10px',
              fontStyle: 'italic',
              color: 'text.secondary'
            }}
          >
            Colors appear when rain is detected
          </Typography>
        </Paper>
      )}
      
      {/* Weather Layer Toggle */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 1000,
          backgroundColor: 'background.paper',
          borderRadius: 2,
          p: 1
        }}
      >
        <ToggleButtonGroup
          value={weatherLayer}
          exclusive
          onChange={(_, newLayer) => {
            if (newLayer !== null) {
              setWeatherLayer(newLayer)
            }
          }}
          size="small"
          orientation="vertical"
        >
          <ToggleButton value="none" aria-label="no weather">
            <Tooltip title="Hide Weather Radar" placement="right">
              <Layers fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="precipitation" aria-label="precipitation">
            <Tooltip 
              title={
                <Box>
                  <Typography variant="caption" display="block" fontWeight="bold">
                    Weather Radar
                  </Typography>
                  <Box sx={{ mt: 0.5, fontSize: '10px' }}>
                    <div>🔵 Light rain</div>
                    <div>🟢 Moderate rain</div>
                    <div>🟡 Heavy rain</div>
                    <div>🔴 Severe storms</div>
                  </Box>
                </Box>
              } 
              placement="right"
            >
              <Cloud fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>
      
      {/* Distance Measurement Display */}
      {distanceMeasurement && (
        <Box
          sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            boxShadow: 2,
            zIndex: 1000,
            minWidth: 200
          }}
        >
          <Typography variant="h6" color="primary" gutterBottom>
            Distance Measurement
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            From: {distanceMeasurement.fromLoad}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            To: {distanceMeasurement.toTruck}
          </Typography>
          <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold' }}>
            {distanceMeasurement.distance} {distanceMeasurement.unit}
          </Typography>
          {onClearDistanceMeasurement && (
            <Box sx={{ mt: 2 }}>
              <button
                onClick={onClearDistanceMeasurement}
                style={{
                  background: 'none',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: darkMode ? '#ffffff' : '#000000'
                }}
              >
                Clear Measurement
              </button>
            </Box>
          )}
        </Box>
      )}
      
      {/* Selection Status */}
      {(selectedLoad || selectedTruck) && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            boxShadow: 2,
            zIndex: 1000
          }}
        >
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Distance Measurement Mode
          </Typography>
          {selectedLoad && (
            <Typography variant="body2" color="success.main">
              ✓ Load selected: {selectedLoad.city}, {selectedLoad.state}
            </Typography>
          )}
          {selectedTruck && (
            <Typography variant="body2" color="info.main">
              ✓ Truck selected: {selectedTruck.city}, {selectedTruck.state}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Right-click on {selectedLoad ? 'a truck' : 'a load'} to measure distance
          </Typography>
        </Box>
      )}
      
      {pins.length === 0 && !loading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            backgroundColor: darkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
            color: darkMode ? '#ffffff' : '#000000',
            padding: 3,
            borderRadius: 2,
            boxShadow: 3,
            border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
          }}
        >
          <Typography variant="body1" color={darkMode ? 'inherit' : 'text.secondary'}>
            No trucks available for this date
          </Typography>
        </Box>
      )}
    </Box>
  )
} 