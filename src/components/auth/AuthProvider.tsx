'use client'

import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from '@/lib/msalConfig'
import { ReactNode, useEffect } from 'react'

const msalInstance = new PublicClientApplication(msalConfig)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Handle redirect response when user returns from authentication
  useEffect(() => {
    msalInstance.handleRedirectPromise().catch((error) => {
      console.error('Error handling redirect:', error)
    })
  }, [])

  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  )
} 