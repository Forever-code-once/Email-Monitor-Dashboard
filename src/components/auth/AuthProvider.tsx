'use client'

import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from '@/lib/msalConfig'
import { ReactNode, useEffect, useState } from 'react'

const msalInstance = new PublicClientApplication(msalConfig)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize MSAL instance
  useEffect(() => {
    const initializeMsal = async () => {
      try {
        // Initialize the MSAL instance first
        await msalInstance.initialize()

        // Then handle redirect promise
        await msalInstance.handleRedirectPromise()
        
        setIsInitialized(true)
      } catch (error) {
        console.error('❌ Error initializing MSAL:', error)
        setIsInitialized(true) // Set to true even on error to prevent infinite loading
      }
    }

    initializeMsal()
  }, [])

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#666'
      }}>
        Initializing authentication...
      </div>
    )
  }

  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  )
} 