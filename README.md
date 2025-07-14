# ExtrctAI
A social media app where you create posts see how much engagement or quality of the posts and have a centralized home feed with vids from different platforms with customizability for how you want your home feed to look. Also, you can highlight the best vids on your home feed for the app to recommend and to use when generating your own posts.

# X Profile Analyzer Chrome Extension

A powerful Chrome extension for analyzing X (Twitter) profiles with real-time data and AI-powered insights.

## 🚀 Features

- **Real-time Profile Analysis**: Fetch live data directly from X API
- **Comprehensive Metrics**: Followers, engagement rates, posting patterns, and more
- **Growth Recommendations**: AI-powered suggestions for improving your X presence
- **Content Strategy**: Personalized recommendations based on your content themes
- **Historical Tracking**: Save and compare profile analyses over time
- **Professional UI**: Clean, modern interface with smooth animations

## 🔧 Setup Instructions

### Prerequisites

1. **X Developer Account**: You need access to the X API
2. **Chrome Browser**: Version 88 or higher
3. **Internet Connection**: For API calls and proxy server communication

### Step 1: Get X API Credentials

1. **Apply for X API Access**:
   - Go to [X Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Sign up for a developer account if you don't have one
   - Create a new project/app or use an existing one

2. **Get Your Bearer Token**:
   - In your X Developer Portal dashboard
   - Navigate to your project → App → "Keys and tokens"
   - Generate a **Bearer Token** (this is the most important credential)
   - Copy and save it securely

3. **Optional - Get Additional Credentials**:
   - **API Key** (Consumer Key)
   - **API Key Secret** (Consumer Secret)
   - **Client ID** and **Client Secret** (for OAuth 2.0)
   - **Access Token** and **Access Token Secret** (for user context)

### Step 2: Configure the Extension

1. **Update API Credentials**:
   ```javascript
   // In env.js file, replace the empty strings with your real credentials:
   const DEFAULT_CONFIG = {
     twitter: {
       config1: {
         bearerToken: 'YOUR_REAL_BEARER_TOKEN_HERE', // Required
         xApiKey: 'YOUR_API_KEY_HERE', // Optional but recommended
         clientId: 'YOUR_CLIENT_ID_HERE', // Optional
         clientSecret: 'YOUR_CLIENT_SECRET_HERE', // Optional
         // ... other fields
       }
     }
   };
   ```

2. **Important Security Notes**:
   - Never commit real API keys to public repositories
   - Consider using environment variables for production
   - The extension uses a proxy server to avoid CORS issues

### Step 3: Install the Extension

1. **Load in Chrome**:
   ```bash
   # Clone the repository
   git clone https://github.com/your-username/x-analyzer.git
   cd x-analyzer
   
   # Open Chrome and go to chrome://extensions/
   # Enable "Developer mode"
   # Click "Load unpacked" and select the project folder
   ```

2. **Verify Installation**:
   - Look for the X Profile Analyzer icon in your Chrome toolbar
   - Click the icon to open the popup
   - Check the console for any configuration warnings

### Step 4: Test the Setup

1. **Basic Connection Test**:
   - Open the extension popup
   - Go to the "Analyze" tab
   - Try analyzing a public X profile (e.g., @elonmusk)

2. **Check for Real Data**:
   - Successfully analyzed profiles should show "✅ Analysis completed using real X API data"
   - If you see "⚠️ Some data may be estimated due to API limitations", check your API credentials

## 📊 Understanding API Rate Limits

The X API has rate limits to prevent abuse:

- **Bearer Token**: 300 requests per 15-minute window (per app)
- **User Context**: Additional limits for user-specific data

The extension automatically:
- Tracks your rate limit usage
- Switches between multiple configurations if available
- Shows warnings when approaching limits
- Provides fallback data when limits are exceeded

## 🔧 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Extension     │───▶│   Proxy Server   │───▶│    X API        │
│   (Frontend)    │    │   (CORS Handler) │    │   (Real Data)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Why Use a Proxy Server?

1. **CORS Prevention**: Direct browser-to-X API calls are blocked by CORS policy
2. **Credential Security**: API keys are not exposed in the browser
3. **Rate Limit Management**: Centralized tracking and optimization
4. **Caching**: Reduce redundant API calls

## 🛠 Development

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server** (for proxy):
   ```bash
   cd server
   npm install
   npm start
   ```

3. **Build Extension**:
   ```bash
   npm run build
   ```

### Environment Variables

Create a `.env` file in the server directory:

```env
# Required
TWITTER_API_BEARER_TOKEN=your_bearer_token_here

# Optional
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
PORT=3000

# Proxy settings (if using external proxy)
PROXY_HOST=your.proxy.host
PROXY_PORT=3000
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```

## 🐛 Troubleshooting

### Common Issues

1. **"API connection failed" Error**:
   - Check your Bearer Token is valid and correctly formatted
   - Ensure the proxy server is running (if using local setup)
   - Verify your X Developer account has API access

2. **"Rate limit exceeded" Warning**:
   - Wait for the rate limit window to reset (15 minutes)
   - Add a secondary API configuration for redundancy
   - Consider upgrading your X API plan for higher limits

3. **"User not found" Error**:
   - Verify the username is correct and the profile is public
   - Some profiles may be private or suspended
   - Check if the user has blocked API access

4. **Extension Shows Estimated Data**:
   - This means the real API is not accessible
   - Check your API credentials in `env.js`
   - Verify the proxy server is running and accessible

### Debug Mode

Enable debug logging by opening Chrome DevTools:

1. Right-click the extension icon → "Inspect popup"
2. Check the Console tab for detailed logs
3. Look for API request/response information

## 📝 API Credentials Setup Guide

### Detailed X API Setup

1. **Create X Developer Account**:
   - Visit [developer.twitter.com](https://developer.twitter.com)
   - Apply for a developer account (may require approval)
   - Describe your use case (profile analysis tool)

2. **Create a Project/App**:
   - Once approved, create a new project
   - Choose "Making a bot" or "Exploring the API" use case
   - Name your app (e.g., "X Profile Analyzer")

3. **Generate Credentials**:
   - Navigate to your app's "Keys and tokens" section
   - Generate a **Bearer Token** (essential for API v2)
   - Optionally generate API Key & Secret for additional features

4. **Set Permissions**:
   - Set app permissions to "Read" (sufficient for profile analysis)
   - No need for write permissions unless adding post features

### Security Best Practices

- **Never share your API credentials**
- **Use environment variables in production**
- **Regularly rotate your tokens**
- **Monitor your API usage in the X Developer Portal**
- **Set up usage alerts to avoid unexpected charges**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push to your branch: `git push origin feature-name`
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review the browser console for error messages
3. Ensure your X API credentials are valid and properly configured
4. Create an issue on GitHub with detailed error information

## 🔄 Updates

The extension automatically checks for updates and will notify you when new versions are available. Always keep your API credentials secure when updating.

---

**Note**: This extension requires valid X API credentials to function properly. Without real API access, it will show estimated/fallback data only. The setup process is essential for getting accurate, real-time profile analytics.
