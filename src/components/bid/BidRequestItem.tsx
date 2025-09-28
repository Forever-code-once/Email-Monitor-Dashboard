'use client'

import { useState, useEffect } from 'react'
import { 
  Box, 
  Typography, 
  Paper,
  Chip,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material'
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material'
import { BidRequest } from '@/types/bid'
import { useTheme as useCustomTheme } from '@/components/providers/ThemeProvider'

interface BidRequestItemProps {
  bidRequest: BidRequest
  onDelete: (id: string) => void
  onEdit?: (id: string) => void
}

export function BidRequestItem({ bidRequest, onDelete, onEdit }: BidRequestItemProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [isExpired, setIsExpired] = useState(false)
  const theme = useTheme()
  const { darkMode } = useCustomTheme()

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const expiresAt = new Date(bidRequest.expiresAt)
      const diffMs = expiresAt.getTime() - now.getTime()
      
      if (diffMs <= 0) {
        setIsExpired(true)
        setTimeRemaining('EXPIRED')
        return
      }
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
      
      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`)
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`)
      } else {
        setTimeRemaining(`${seconds}s`)
      }
    }
    
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    
    return () => clearInterval(interval)
  }, [bidRequest.expiresAt])

  const getStatusColor = () => {
    if (isExpired) return 'error'
    if (timeRemaining.includes('s') && !timeRemaining.includes('m')) return 'warning'
    return 'default'
  }

  const getStatusDot = () => {
    if (bidRequest.hasMatchingTruck) {
      return (
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: '#4caf50',
            mr: 2,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(76, 175, 80, 0.3)',
            '&::after': {
              content: '"✓"',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 'bold'
            }
          }}
        />
      )
    } else {
      return (
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: '#f44336',
            mr: 2,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(244, 67, 54, 0.3)',
            '&::after': {
              content: '"✕"',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 'bold'
            }
          }}
        />
      )
    }
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this bid request?')) {
      onDelete(bidRequest.id)
    }
  }

  return (
    <Paper 
      sx={{ 
        p: 2.5, 
        borderRadius: 3,
        border: isExpired 
          ? '2px solid #f44336' 
          : `1px solid ${darkMode ? theme.palette.divider : '#e3f2fd'}`,
        backgroundColor: isExpired 
          ? '#ffebee' 
          : darkMode ? theme.palette.background.paper : 'white',
        opacity: isExpired ? 0.7 : 1,
        boxShadow: isExpired 
          ? '0 2px 8px rgba(244, 67, 54, 0.2)' 
          : darkMode 
            ? '0 2px 8px rgba(0,0,0,0.3)' 
            : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: isExpired 
            ? '0 4px 12px rgba(244, 67, 54, 0.3)' 
            : darkMode 
              ? '0 4px 12px rgba(0,0,0,0.4)' 
              : '0 4px 12px rgba(0,0,0,0.12)',
          transform: 'translateY(-1px)',
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        {getStatusDot()}
        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ 
            mb: 0.5, 
            color: darkMode ? theme.palette.primary.light : '#1976d2',
            transition: 'all 0.3s ease-in-out'
          }}>
            {bidRequest.customerName}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
              📍 {bidRequest.pickupCity}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>
              →
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
              📍 {bidRequest.destinationCity}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              label={timeRemaining}
              size="small"
              color={getStatusColor()}
              variant={isExpired ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 'bold',
                borderRadius: 2,
                ...(getStatusColor() === 'warning' && {
                  backgroundColor: '#ff9800',
                  color: 'white',
                  border: 'none'
                })
              }}
            />
            
            <Chip 
              label={`${bidRequest.radiusMiles}mi radius`} 
              size="small" 
              variant="outlined"
              sx={{ 
                borderRadius: 2,
                borderColor: darkMode ? theme.palette.primary.light : '#1976d2',
                color: darkMode ? theme.palette.primary.light : '#1976d2',
                fontSize: '0.7rem',
                transition: 'all 0.3s ease-in-out'
              }}
            />
            
            {bidRequest.hasMatchingTruck ? (
              <Chip 
                label="✅ Truck Available" 
                size="small" 
                color="success" 
                variant="filled"
                sx={{ borderRadius: 2, fontWeight: 'medium' }}
              />
            ) : (
              <Chip 
                label="❌ No Truck" 
                size="small" 
                color="error" 
                variant="filled"
                sx={{ borderRadius: 2, fontWeight: 'medium' }}
              />
            )}
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {onEdit && (
            <Tooltip title="Edit bid request">
              <IconButton
                size="small"
                onClick={() => onEdit(bidRequest.id)}
                sx={{ 
                  flexShrink: 0,
                  backgroundColor: darkMode ? theme.palette.action.hover : '#e3f2fd',
                  '&:hover': {
                    backgroundColor: darkMode ? theme.palette.primary.main : '#1976d2',
                    color: 'white'
                  },
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          <Tooltip title="Delete bid request">
            <IconButton
              size="small"
              onClick={handleDelete}
              sx={{ 
                flexShrink: 0,
                backgroundColor: darkMode ? theme.palette.error.dark : '#ffebee',
                '&:hover': {
                  backgroundColor: '#f44336',
                  color: 'white'
                },
                transition: 'all 0.3s ease-in-out'
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  )
}