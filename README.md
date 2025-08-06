# Email Monitor Dashboard

An AI-powered truck availability monitoring dashboard that integrates with Microsoft Graph API to read emails and extract truck availability data using OpenAI, with **real-time WebSocket updates**.

## Features

- **Microsoft Graph API Integration**: Secure authentication and email reading
- **AI-Powered Email Parsing**: Uses OpenAI GPT to extract truck availability data
- **Real-time WebSocket Updates**: Live email monitoring with instant AI processing (NEW!)
- **Card-based UI**: Clean, modern interface with Material-UI components
- **Interactive Controls**: Check/uncheck and delete truck availability entries
- **Email Modal**: View full email content from customers with lightbox popup
- **Multiple Views**: AI-parsed customer cards, sender-based cards, and raw email feed
- **Connection Status**: Visual indicators showing real-time connection status
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js 18+ and npm
- Microsoft Azure account with app registration
- OpenAI API account
- An email account that will receive truck availability emails

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd email-monitor-dashboard
npm install
```

### 2. Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Configure:
   - Name: "Email Monitor Dashboard"
   - Supported account types: "Accounts in this organizational directory only"
   - Redirect URI: Web - `http://localhost:3000` (for development)
5. After creation, note down:
   - Application (client) ID
   - Directory (tenant) ID
6. Go to "Certificates & secrets" > "New client secret"
   - Note down the secret value
7. Go to "API permissions" > "Add a permission" > "Microsoft Graph" > "Delegated permissions"
   - Add: `Mail.Read`, `Mail.ReadWrite`, `User.Read`
8. Click "Grant admin consent for [your organization]"

### 3. OpenAI API Setup

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Create an account or sign in
3. Go to "API Keys" and create a new secret key
4. Note down the API key

### 4. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Microsoft Graph API Configuration
NEXT_PUBLIC_AZURE_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_AZURE_TENANT_ID=your_tenant_id_here
AZURE_CLIENT_SECRET=your_client_secret_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Application Configuration
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### 5. Start the Application

#### For Real-time Monitoring (Recommended):
```bash
npm run dev:full
```
This starts both the Next.js dashboard and the WebSocket server for real-time email monitoring.

#### Or Start Separately:
```bash
# Terminal 1: Next.js Dashboard
npm run dev

# Terminal 2: WebSocket Server
npm run websocket
```

#### Manual Refresh Only:
```bash
npm run dev
```
This starts only the Next.js dashboard without real-time updates.

Visit `http://localhost:3000` to access the dashboard.

## Real-Time Features

### WebSocket Integration
The application now includes a standalone WebSocket server that provides **true real-time email monitoring**:

- **Automatic Email Polling**: Checks for new emails every 30 seconds
- **Instant AI Processing**: New emails are automatically processed with OpenAI
- **Live Dashboard Updates**: New truck availability appears instantly without refresh
- **Connection Status**: Visual indicators show real-time connection health
- **Auto-Reconnection**: Automatic reconnection with exponential backoff
- **Graceful Fallback**: Falls back to manual refresh if WebSocket fails

### Real-Time Indicators
- 🟢 **Green Pulsing Dot**: "Real-time Active" - WebSocket connected and monitoring
- 🔴 **Red Dot**: "Manual Refresh Only" - WebSocket disconnected
- 🔔 **Live Notifications**: Shows "New email received: [Subject]" for 5 seconds

### WebSocket Server Details
- **Port**: 8080 (WebSocket server)
- **API Integration**: Calls Next.js API routes for AI processing
- **Message Types**: CONNECTION_STATUS, NEW_EMAIL, MONITORING_STATUS, HEARTBEAT, SERVER_STATUS
- **Real-Time Processing**: Processes actual emails from Microsoft Graph API (no simulation)

## How It Works

### Email Processing Flow

1. **Authentication**: Users sign in with Microsoft account
2. **Email Fetching**: App retrieves recent emails using Microsoft Graph API
3. **AI Parsing**: Each email is sent to OpenAI GPT for data extraction
4. **Data Organization**: Extracted truck availability data is organized by customer
5. **Dashboard Display**: Data is displayed in interactive customer cards

### Expected Email Format

The AI parser is designed to handle emails like:

```
From: TNCC Inc Dispatch <dispatch@tnccinc.com>
Subject: Available Truck List

Friday 7/25
Gallipolis, OH
Greenville, SC

Monday 7/28
Stoughton, MA
Dyersburg, TN
Livonia, MI
```

### AI Extraction

The AI extracts:
- **Customer name**: From sender information
- **Dates**: Day of week and date (e.g., "Friday 7/25")
- **Locations**: City and state combinations
- **Additional info**: Times, truck numbers, special notes

## Architecture

### Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI Framework**: Material-UI (MUI) v5
- **Authentication**: Microsoft Authentication Library (MSAL)
- **API Integration**: Microsoft Graph SDK
- **AI Processing**: OpenAI API (GPT-3.5-turbo)
- **Styling**: Material-UI theme system

### Key Components

- `Dashboard`: Main dashboard component with email processing logic
- `CustomerCard`: Individual customer display with truck listings
- `AuthProvider`: Microsoft authentication wrapper
- `LoginScreen`: Authentication interface

### API Routes

- `/api/parse-email`: OpenAI-powered email parsing endpoint

## Usage

1. **Sign In**: Click "Sign in with Microsoft" and authenticate
2. **View Dashboard**: See all customers with available trucks
3. **Interact with Data**:
   - Check/uncheck truck entries for visual tracking
   - Delete entries to remove them from view
   - Refresh to fetch latest emails
4. **Monitor Real-time**: Dashboard shows last update time

## Deployment

### Development vs Production

#### Development (Local):
- Next.js: `http://localhost:3000` (or auto-assigned port)
- WebSocket server: `http://localhost:8080`
- Use `npm run dev:full` for complete real-time experience

#### Production Considerations:
The WebSocket server requires a separate hosting solution since most static hosting platforms (like Vercel) don't support persistent WebSocket connections.

### Next.js Dashboard Deployment

#### Vercel (Recommended for Dashboard):
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Update Azure app registration redirect URI to production URL

#### Other Platforms:
The dashboard can be deployed on any platform supporting Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

### WebSocket Server Deployment

For production WebSocket functionality, deploy the server separately:

#### Options:
- **Railway**: Great for Node.js WebSocket servers
- **Heroku**: Supports WebSocket connections
- **DigitalOcean Droplets**: Full control with Docker
- **AWS EC2**: Scalable cloud hosting
- **Google Cloud Run**: Serverless container hosting

#### Configuration:
1. Set `NEXTJS_URL` environment variable to your production Next.js URL
2. Update WebSocket client URL in Dashboard.tsx to production WebSocket server
3. Ensure CORS is properly configured for cross-origin WebSocket connections

#### Docker Example:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server/ ./server/
EXPOSE 8080
CMD ["node", "server/websocket-server.js"]
```

## Security Considerations

- Environment variables are never exposed to the client
- Microsoft Graph API requires proper authentication
- OpenAI API calls are made server-side only
- Email content is processed securely and not stored

## Troubleshooting

### Common Issues

1. **Authentication fails**: Check Azure app registration configuration
2. **No emails loading**: Verify Graph API permissions are granted
3. **AI parsing errors**: Check OpenAI API key and quota
4. **Missing environment variables**: Ensure all required vars are set

### Support

For issues related to:
- Azure setup: Check Microsoft Graph documentation
- OpenAI integration: Review OpenAI API documentation
- Application bugs: Check browser console for errors

## License

This project is intended for internal use and truck availability monitoring. 