'use client'

import { useState, useEffect } from 'react'
import { 
  Box, 
  Typography, 
  Alert,
  useTheme
} from '@mui/material'
import { BidRequestForm } from './BidRequestForm'
import { BidRequestItem } from './BidRequestItem'
import { BidRequest, BidRequestFormData } from '@/types/bid'
import { useTheme as useCustomTheme } from '@/components/providers/ThemeProvider'

interface BidRequestSidebarProps {
  truckPins?: any[] // Optional truck pins for matching
  onRefresh?: () => void
  className?: string
  selectedDate?: Date
}

export function BidRequestSidebar({ truckPins = [], onRefresh, className, selectedDate = new Date() }: BidRequestSidebarProps) {
  const [bidRequests, setBidRequests] = useState<BidRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const theme = useTheme()
  const { darkMode } = useCustomTheme()

  // Fetch bid requests from API
  const fetchBidRequests = async () => {
    try {
      const response = await fetch('/api/bid-requests')
      const data = await response.json()
      
      if (data.success) {
        setBidRequests(data.bidRequests)
      } else {
        setError(data.error || 'Failed to fetch bid requests')
      }
    } catch (err) {
      setError('Network error fetching bid requests')
      console.error('Error fetching bid requests:', err)
    }
  }

  // Create new bid request
  const createBidRequest = async (formData: BidRequestFormData) => {
    setLoading(true)
    setError('')
    
    try {
      // Convert selectedDate to string format for API
      const selectedDateStr = selectedDate.toISOString().split('T')[0] // YYYY-MM-DD format
      
      const response = await fetch('/api/bid-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          selectedDate: selectedDateStr
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        await fetchBidRequests() // Refresh the list
        if (onRefresh) onRefresh() // Trigger external refresh if needed
      } else {
        setError(data.error || 'Failed to create bid request')
      }
    } catch (err) {
      setError('Network error creating bid request')
      console.error('Error creating bid request:', err)
    } finally {
      setLoading(false)
    }
  }

  // Delete bid request
  const deleteBidRequest = async (id: string) => {
    try {
      const response = await fetch(`/api/bid-requests/${id}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (data.success) {
        await fetchBidRequests() // Refresh the list
        if (onRefresh) onRefresh() // Trigger external refresh if needed
      } else {
        setError(data.error || 'Failed to delete bid request')
      }
    } catch (err) {
      setError('Network error deleting bid request')
      console.error('Error deleting bid request:', err)
    }
  }

  // Check for expired requests and auto-delete them
  useEffect(() => {
    const checkExpiredRequests = () => {
      const now = new Date()
      const expiredRequests = bidRequests.filter(
        request => new Date(request.expiresAt) <= now
      )
      
      if (expiredRequests.length > 0) {
        
        // Delete expired requests
        expiredRequests.forEach(request => {
          deleteBidRequest(request.id)
        })
      }
    }
    
    // Check every 30 seconds for expired requests
    const interval = setInterval(checkExpiredRequests, 30000)
    
    return () => clearInterval(interval)
  }, [bidRequests])

  // Initial fetch
  useEffect(() => {
    fetchBidRequests()
  }, [])

  // Refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchBidRequests, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Box 
      className={className}
      sx={{ 
        width: '25%', 
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
      {/* Header */}
      <Box sx={{ 
        p: 3, 
        borderBottom: `2px solid ${darkMode ? theme.palette.divider : '#e3f2fd'}`,
        background: darkMode 
          ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
          : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
        color: 'white',
        transition: 'all 0.3s ease-in-out'
      }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
          🚛 Bid Requests
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            backgroundColor: bidRequests.length > 0 ? '#4caf50' : '#ff9800' 
          }} />
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {bidRequests.length} active request{bidRequests.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>
      
      {/* Content */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto', 
        p: 3,
        backgroundColor: darkMode ? theme.palette.background.default : '#f8f9fa',
        transition: 'all 0.3s ease-in-out'
      }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              '& .MuiAlert-message': { fontSize: '0.875rem' }
            }} 
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}
        
        <BidRequestForm 
          onSubmit={createBidRequest} 
          loading={loading}
        />
        
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          my: 3,
          gap: 1
        }}>
          <Box sx={{ 
            width: 4, 
            height: 20, 
            backgroundColor: darkMode ? theme.palette.primary.light : '#1976d2',
            borderRadius: 2,
            transition: 'all 0.3s ease-in-out'
          }} />
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold',
            color: darkMode ? theme.palette.primary.light : '#1976d2',
            fontSize: '1.1rem',
            transition: 'all 0.3s ease-in-out'
          }}>
            Active Requests
          </Typography>
        </Box>
        
        {bidRequests.length === 0 ? (
          <Box sx={{ 
            textAlign: 'center', 
            mt: 4,
            p: 3,
            backgroundColor: darkMode ? theme.palette.background.paper : 'white',
            borderRadius: 2,
            border: `2px dashed ${darkMode ? theme.palette.divider : '#e0e0e0'}`,
            transition: 'all 0.3s ease-in-out'
          }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              📋 No active bid requests
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add a new request above to get started
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {bidRequests.map((request) => (
              <BidRequestItem
                key={request.id}
                bidRequest={request}
                onDelete={deleteBidRequest}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}