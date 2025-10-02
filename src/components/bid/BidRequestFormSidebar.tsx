'use client'

import { useState } from 'react'
import { 
  Box, 
  Typography,
  useTheme
} from '@mui/material'
import { BidRequestForm } from './BidRequestForm'
import { BidRequestFormData } from '@/types/bid'
import { useTheme as useCustomTheme } from '@/components/providers/ThemeProvider'

interface BidRequestFormSidebarProps {
  truckPins?: any[] // Optional truck pins for matching
  onRefresh?: () => void
  className?: string
  selectedDate?: Date
  collapsed?: boolean
}

export function BidRequestFormSidebar({ truckPins = [], onRefresh, className, selectedDate = new Date(), collapsed = false }: BidRequestFormSidebarProps) {
  const [loading, setLoading] = useState(false)
  const theme = useTheme()
  const { darkMode } = useCustomTheme()

  // Create new bid request
  const createBidRequest = async (formData: BidRequestFormData) => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/bid-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Trigger refresh in parent component
        if (onRefresh) onRefresh()
      } else {
        throw new Error(data.error || 'Failed to create bid request')
      }
    } catch (err) {
      console.error('Error creating bid request:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box 
      className={className}
      sx={{ 
        width: collapsed ? '60px' : '25%', 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRight: `2px solid ${darkMode ? theme.palette.divider : '#e3f2fd'}`,
        backgroundColor: darkMode ? theme.palette.background.paper : '#ffffff',
        boxShadow: darkMode 
          ? '2px 0 8px rgba(0,0,0,0.3)' 
          : '2px 0 8px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease-in-out'
      }}
    >
      {/* Content - Only Form */}
      {!collapsed && (
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto', 
          p: 3,
          backgroundColor: darkMode ? theme.palette.background.default : '#f8f9fa',
          transition: 'all 0.3s ease-in-out'
        }}>
          <BidRequestForm 
            onSubmit={createBidRequest}
            loading={loading}
          />
        </Box>
      )}
    </Box>
  )
}