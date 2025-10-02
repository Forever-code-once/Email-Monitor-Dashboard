'use client'

import { ReactNode, useState } from 'react'
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
  selectedDate?: Date
}

export function AppLayout({ 
  children, 
  truckPins = [], 
  onRefresh, 
  lastRefresh = new Date(), 
  wsConnected = false, 
  onLogout = () => {}, 
  onSendToken = () => {},
  selectedDate = new Date()
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
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
          selectedDate={selectedDate}
          collapsed={sidebarCollapsed}
        />
        
        {/* Main Content Area */}
        <Box sx={{ 
          marginLeft: '20px', 
          marginRight: '20px',
          marginTop: '20px',
          width: sidebarCollapsed ? 'calc(100vw - 80px)' : 'calc(100vw - 25%)',
          overflow: 'hidden',
          transition: 'width 0.3s ease-in-out'
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}