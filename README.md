# ExtrctAI
A social media app where you create posts see how much engagement or quality of the posts and have a centralized home feed with vids from different platforms with customizability for how you want your home feed to look. Also, you can highlight the best vids on your home feed for the app to recommend and to use when generating your own posts.

# X-Analyzer - Twitter/X Profile Analyzer Chrome Extension

This Chrome extension analyzes Twitter/X profiles, providing engagement metrics, audience insights, and content recommendations.

## Features

- Profile analysis with engagement metrics
- Content strategy recommendations
- Posting time optimization
- API integration with Twitter/X
- Proxy support for reliable API access
- Caching for faster repeat analyses

## Installation

### Prerequisites

- Node.js and npm installed on your system
- Chrome browser
- Twitter/X API credentials (optional but recommended)

### Setup

1. Clone this repository or download the source code:

```bash
git clone https://github.com/yourusername/x-analyzer.git
cd x-analyzer
```

2. Copy the example environment file and configure it with your credentials:

```bash
cp .env.example .env
```

3. Edit the `.env` file with your Twitter API credentials and proxy settings:

```
# Twitter API Credentials
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_BEARER_TOKEN=your_bearer_token

# DigitalOcean Proxy Configuration
DO_PROXY_ENABLED=true
DO_PROXY_HOST=143.198.111.238
DO_PROXY_PORT=3000
DO_PROXY_USERNAME=Akhera24
DO_PROXY_PASSWORD=N5$Ny2_mGeJ8Y
```

4. Install dependencies and build the extension:

```bash
# Use the provided build script (recommended)
./build.sh

# Or install and build manually
npm install
npm run build
```

5. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked" and select the `dist` directory from this project

## Usage

1. Click the X-Analyzer icon in your Chrome toolbar
2. Enter a Twitter/X username or paste a profile URL
3. Click "Analyze" to see detailed metrics
4. View engagement statistics, audience insights, and content recommendations
5. Use the History tab to access previous analyses

## Configuration Options

### Twitter API Credentials

For the full functionality, you'll need Twitter API credentials:

1. Sign up for a Twitter Developer account at https://developer.twitter.com/
2. Create a new project and app
3. Generate API keys and tokens
4. Add them to your `.env` file

### Proxy Configuration

The extension includes support for using a proxy server to access the Twitter API:

```
DO_PROXY_ENABLED=true
DO_PROXY_HOST=your_proxy_host
DO_PROXY_PORT=your_proxy_port
DO_PROXY_USERNAME=your_proxy_username
DO_PROXY_PASSWORD=your_proxy_password
DO_PROXY_FALLBACK_DIRECT=true
```

- Set `DO_PROXY_ENABLED=false` to disable proxy usage
- Set `DO_PROXY_FALLBACK_DIRECT=true` to allow fallback to direct connection if proxy fails

## Troubleshooting

If you encounter any issues:

1. Check the console for error messages (right-click extension popup > Inspect > Console)
2. Verify your API credentials and proxy settings
3. Clear the extension's cache from the popup settings
4. Refer to the [TROUBLESHOOTING.md](TROUBLESHOOTING.md) file for common issues and solutions

## For Developers

### Project Structure

- `manifest.json` - Chrome extension manifest
- `popup/` - UI for the extension popup
- `scripts/` - Core functionality
  - `auth-handler.js` - Authentication and token management
  - `api-handler.js` - API request handling
  - `proxy-config.js` - Proxy configuration
- `env.js` - Environment configuration

### Building for Development

For development with hot-reloading:

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with Chrome Extension Manifest V3
- Uses Twitter API v2
- Proxy integration with DigitalOcean
