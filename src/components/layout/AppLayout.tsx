'use client'

import { ReactNode } from 'react'
import { Box } from '@mui/material'
import { BidRequestSidebar } from '../bid/BidRequestSidebar'
import { Header } from './Header'

interface AppLayoutProps {
  children: ReactNode
  truckPins?: any[]
  onRefresh?: () => void
  lastRefresh?: Date
  wsConnected?: boolean
  onLogout?: () => void
  onSendToken?: () => void
}

export function AppLayout({ 
  children, 
  truckPins = [], 
  onRefresh, 
  lastRefresh = new Date(), 
  wsConnected = false, 
  onLogout = () => {}, 
  onSendToken = () => {} 
}: AppLayoutProps) {
  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100vw', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Full Width Header */}
      <Header 
        lastRefresh={lastRefresh}
        wsConnected={wsConnected}
        onLogout={onLogout}
        onSendToken={onSendToken}
      />
      
      {/* Content Area with Sidebar */}
      <Box sx={{ 
        width: '100vw', 
        height: 'calc(100vh-80px)',
        overflow: 'hidden',
        display: 'flex',
        position: 'relative'
      }}>
        {/* Standalone Bid Request Sidebar */}
        <BidRequestSidebar 
          truckPins={truckPins}
          onRefresh={onRefresh}
        />
        
        {/* Main Content Area */}
        <Box sx={{ 
          marginLeft: '20px', 
          marginRight: '20px',
          marginTop: '20px',
          width: 'calc(100vw - 25%)',
          overflow: 'hidden'
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}