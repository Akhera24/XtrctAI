# Troubleshooting Guide for X-Analyzer

## Message Port Closed Errors

If you're encountering "message port closed" errors in the console, here are the steps to diagnose and fix the issue:

### 1. Check Your Environment Configuration

Make sure your `.env` file has the correct credentials:

```
# DigitalOcean Proxy Configuration
DO_PROXY_ENABLED=true
DO_PROXY_HOST=143.198.111.238
DO_PROXY_PORT=3000
DO_PROXY_USERNAME=Akhera24
DO_PROXY_PASSWORD=N5$Ny2_mGeJ8Y
DO_PROXY_FALLBACK_DIRECT=true
```

Verify that:
- Your password is correctly entered (including special characters)
- The proxy host and port are correct
- The `DO_PROXY_FALLBACK_DIRECT` setting is set to `true` (this allows direct connections if proxy fails)

### 2. Test API Connection

Use the "Test API Connection" button in the extension to check if you can connect to the API:

1. Open the extension popup
2. Click the "Test API Connection" button
3. Check the console for detailed error messages

### 3. Check Proxy Connection

If you're using a proxy, you can test the proxy connection separately:

```javascript
// In Chrome DevTools console when extension is open
await chrome.runtime.sendMessage({action: 'testProxyConnection'})
```

This will return information about your proxy connection status.

### 4. Rebuild the Extension

Sometimes a clean rebuild can resolve issues:

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Rebuild the extension
npm run build
```

### 5. Inspect Background Script

Open the background script page to see detailed error logs:

1. Go to `chrome://extensions`
2. Find the X-Analyzer extension
3. Click on "background page" under "Inspect views"
4. Check the Console tab for errors

## Common Issues and Solutions

### Authentication Errors

If you see 401 or 403 errors:

1. Verify your Twitter API credentials in the `.env` file
2. Make sure your API keys have the correct permissions
3. Check if you've exceeded rate limits (in DevTools Network tab)

### Webpack Build Issues

If the build fails:

1. Check for JavaScript syntax errors in your code
2. Verify that all required dependencies are installed
3. Make sure your webpack.config.js is correct
4. Try running `npx webpack --config webpack.config.js` for detailed errors

### Extension Loading Issues

If the extension won't load in Chrome:

1. Check for errors in the `manifest.json` file
2. Verify that all required files are present in the `dist` directory
3. Try disabling and re-enabling developer mode
4. Clear browser cache and restart Chrome

## Advanced Debugging

For more advanced debugging:

1. Enable verbose logging in background.js:
```javascript
const DEBUG_MODE = true;
function debugLog(...args) {
  if (DEBUG_MODE) console.log(...args);
}
```

2. Add the debug flag to webpack:
```bash
npm run build -- --debug
```

3. Use Chrome's network monitor to inspect API requests:
   - Open DevTools in the extension popup
   - Go to the Network tab
   - Look for failed requests to the Twitter API or proxy server

## Getting Help

If you've tried the above steps and still encounter issues:

1. Create a detailed bug report with:
   - Steps to reproduce the issue
   - Error messages from the console
   - Your Chrome version
   - Extensions manifest version
   - Screenshots of the error

2. Submit your bug report to the project repository or contact support. 