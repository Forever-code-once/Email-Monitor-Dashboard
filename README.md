# Email Monitor Dashboard

An AI-powered truck availability monitoring dashboard that integrates with Microsoft Graph API to read emails and extract truck availability data using OpenAI.

## Features

- **Microsoft Graph API Integration**: Secure authentication and email reading
- **AI-Powered Email Parsing**: Uses OpenAI GPT to extract truck availability data
- **Real-time Dashboard**: Live feed of truck availability organized by customer
- **Card-based UI**: Clean, modern interface with Material-UI components
- **Interactive Controls**: Check/uncheck and delete truck availability entries
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

### 5. Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Visit `http://localhost:3000` to access the dashboard.

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

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Update Azure app registration redirect URI to production URL

### Other Platforms

The app can be deployed on any platform supporting Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

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