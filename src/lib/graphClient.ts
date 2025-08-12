import { Client } from '@microsoft/microsoft-graph-client'
import { PublicClientApplication } from '@azure/msal-browser'
import { loginRequest } from './msalConfig'

export function getGraphClient(msalInstance: PublicClientApplication) {
  // Use the simpler approach with access token
  const authProvider = {
    getAccessToken: async () => {
      const account = msalInstance.getActiveAccount()
      if (!account) {
        throw new Error('No active account found. Please sign in again.')
      }

      try {
        const response = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: account,
        })

        return response.accessToken
      } catch (error) {
        console.error('Failed to acquire token silently:', error)
        // Try to acquire token interactively using redirect instead of popup
        await msalInstance.acquireTokenRedirect(loginRequest)
        throw new Error('Redirecting to login...')
      }
    }
  }

  return Client.initWithMiddleware({
    authProvider: authProvider,
  })
}

export async function getEmails(graphClient: Client, top: number = 50) {
  try {
    // Specifically target emails from the Inbox folder only
    const messages = await graphClient
      .api('/me/mailFolders/inbox/messages')
      .select('id,subject,bodyPreview,body,from,receivedDateTime')
      .top(top)
      .orderby('receivedDateTime desc')
      .get()

    return messages.value
  } catch (error) {
    console.error('Error fetching emails from inbox:', error)
    throw error
  }
} 