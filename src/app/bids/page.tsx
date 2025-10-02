'use client'

import { useState } from 'react'
import { Box } from '@mui/material'
import { BidRequestSidebar } from '@/components/bid/BidRequestSidebar'

export default function BidsPage() {
  const [selectedDate] = useState<Date>(new Date())

  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100vw', 
      overflow: 'hidden',
      display: 'flex',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Full Width Bid Request Sidebar */}
      <BidRequestSidebar 
        truckPins={[]}
        onRefresh={() => {}}
        selectedDate={selectedDate}
        collapsed={false}
      />
      
      {/* Empty space - sidebar takes full width */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e0e0e0'
      }}>
        <Box sx={{ 
          textAlign: 'center',
          p: 4,
          borderRadius: 2,
          backgroundColor: '#f8f9fa',
          border: '2px dashed #dee2e6'
        }}>
          <h2 style={{ color: '#6c757d', marginBottom: '16px' }}>
            🚛 Bid Requests Dashboard
          </h2>
          <p style={{ color: '#6c757d', margin: 0 }}>
            Use the sidebar to manage bid requests and truck availability
          </p>
        </Box>
      </Box>
    </Box>
  )
}