'use client'

import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  IconButton,
  Chip,
  Box,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material'
import { Delete, LocationOn, Event, Email } from '@mui/icons-material'
import { CustomerCard as CustomerCardType } from '@/types'
import { formatDate } from '@/lib/emailParser'
import { useState, useCallback } from 'react'
import { normalizeCityName } from '@/lib/geocoding'

interface CustomerCardProps {
  customer: CustomerCardType
  onCheckTruck: (truckId: string) => void
  onDeleteTruck: (truckId: string) => void
  onViewEmails?: (customerEmail: string) => void
}

export function CustomerCard({
  customer,
  onCheckTruck,
  onDeleteTruck,
  onViewEmails,
}: CustomerCardProps) {
  const [deletingTrucks, setDeletingTrucks] = useState<Set<string>>(new Set())
  
  const handleDeleteTruck = useCallback((truckId: string) => {
    if (deletingTrucks.has(truckId)) {
      return // Prevent duplicate delete operations
    }
    
    setDeletingTrucks(prev => new Set(prev.add(truckId)))
    
    onDeleteTruck(truckId)
    
    // Clean up the deleting state after a brief delay
    setTimeout(() => {
      setDeletingTrucks(prev => {
        const newSet = new Set(prev)
        newSet.delete(truckId)
        return newSet
      })
    }, 500)
  }, [deletingTrucks, onDeleteTruck])
  const formatEmailDate = (date: Date): string => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const groupTrucksByDate = () => {
    const grouped = new Map<string, typeof customer.trucks>()
    
    customer.trucks.forEach(truck => {
      if (!grouped.has(truck.date)) {
        grouped.set(truck.date, [])
      }
      grouped.get(truck.date)!.push(truck)
    })

    return Array.from(grouped.entries()).sort((a, b) => {
      // Sort dates chronologically (this is basic, could be improved)
      return a[0].localeCompare(b[0])
    })
  }

  const groupedTrucks = groupTrucksByDate()

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Typography 
            variant="h6" 
            component="div" 
            noWrap 
            sx={{ 
              cursor: onViewEmails ? 'pointer' : 'default',
              '&:hover': onViewEmails ? {
                color: 'primary.main',
                textDecoration: 'underline'
              } : {}
            }}
            onClick={() => onViewEmails?.(customer.customerEmail)}
          >
            {customer.customer}
          </Typography>
        }
        subheader={
          <Box>
            <Typography variant="body2" color="text.secondary" noWrap>
              {customer.customerEmail}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last email: {formatEmailDate(customer.lastEmailDate)}
            </Typography>
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Chip
            label={`${customer.trucks.length} trucks`}
            color="primary"
            size="small"
          />
            {onViewEmails && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Email />}
                onClick={() => onViewEmails(customer.customerEmail)}
                sx={{ 
                  textTransform: 'none',
                  fontSize: '0.7rem',
                  py: 0.25,
                  px: 1
                }}
              >
                View Emails
              </Button>
            )}
          </Box>
        }
      />

      <CardContent sx={{ flexGrow: 1, pt: 0 }}>
        {groupedTrucks.length === 0 ? (
          <Typography color="text.secondary" align="center">
            No trucks available
          </Typography>
        ) : (
          groupedTrucks.map(([date, trucks]) => (
            <Box key={date} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Event sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="primary.main" fontWeight="bold">
                  {date}
                </Typography>
              </Box>
              
              <List dense disablePadding>
                {trucks.map((truck) => (
                  <ListItem
                    key={truck.id}
                    sx={{
                      py: 0.5,
                      px: 1,
                      backgroundColor: truck.isChecked ? 'action.selected' : 'transparent',
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                  >
                    <Checkbox
                      edge="start"
                      checked={truck.isChecked}
                      onChange={() => onCheckTruck(truck.id)}
                      size="small"
                    />
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocationOn sx={{ fontSize: 14 }} />
                          <Typography variant="body2" fontWeight="medium">
                            {normalizeCityName(truck.city, truck.state)}, {truck.state}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        truck.additionalInfo && (
                          <Typography variant="caption" color="text.secondary">
                            {truck.additionalInfo}
                          </Typography>
                        )
                      }
                      sx={{ ml: 0.5 }}
                    />
                    
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleDeleteTruck(truck.id)}
                        disabled={deletingTrucks.has(truck.id)}
                        sx={{ 
                          color: deletingTrucks.has(truck.id) ? 'action.disabled' : 'error.main',
                          minWidth: 32,
                          minHeight: 32
                        }}
                      >
                        {deletingTrucks.has(truck.id) ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <Delete fontSize="small" />
                        )}
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
              
              {date !== groupedTrucks[groupedTrucks.length - 1][0] && (
                <Divider sx={{ mt: 1 }} />
              )}
            </Box>
          ))
        )}
      </CardContent>
    </Card>
  )
} 