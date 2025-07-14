# Quick Setup Guide - X Profile Analyzer

Get your X Profile Analyzer working with real, live data in 5 minutes!

## 🚀 Quick Start

### Step 1: Get X API Access (5 minutes)

1. **Visit the X Developer Portal**: https://developer.twitter.com/en/portal/dashboard
2. **Sign up** for a developer account (if you don't have one)
3. **Create a new app** or use an existing one
4. **Get your Bearer Token**:
   - Go to your app's "Keys and tokens" section
   - Click "Generate" next to "Bearer Token"
   - **Copy the token** - you'll need it in the next step

### Step 2: Configure the Extension (1 minute)

1. **Open** the `env.js` file in your extension folder
2. **Find** this line:
   ```javascript
   bearerToken: '', // Get from https://developer.twitter.com/en/portal/dashboard
   ```
3. **Paste your Bearer Token** between the quotes:
   ```javascript
   bearerToken: 'AAAAAAAAAAAAAAAAAAAAAYourRealTokenHere', // Your real token
   ```
4. **Save** the file

### Step 3: Test Your Setup (1 minute)

**Option A: Use the Test Script**
```bash
node test-api-setup.js
```

**Option B: Test in Extension**
1. Load the extension in Chrome (chrome://extensions/)
2. Click the extension icon
3. Try analyzing any public profile (e.g., `elonmusk`)
4. Look for "✅ Real-time Data Analysis" in the results

## ✅ Success Indicators

**You know it's working when you see:**
- ✅ "Real-time Data Analysis" message in results
- Accurate follower counts matching X.com
- Recent tweet data and engagement metrics
- No "estimated data" warnings

## ❌ Troubleshooting

**If you see "⚠️ Using Estimated Data":**

1. **Check your Bearer Token**:
   - Should start with `AAAA`
   - Should be 80+ characters long
   - No spaces or special characters

2. **Verify X API Access**:
   - Your X Developer account is approved
   - Bearer Token is active (not revoked)
   - App has "Read" permissions

3. **Check Browser Console**:
   - Right-click extension → "Inspect popup" → Console tab
   - Look for specific error messages

## 🔑 Getting X API Access

### For Free Accounts:
- **Basic** access: 1,500 requests/month
- **Perfect** for personal use
- Takes 1-2 business days for approval

### For Paid Accounts:
- **Basic** ($100/month): 10,000 requests/month
- **Pro** ($5,000/month): 1M requests/month
- Instant approval

### Application Tips:
- **Use case**: "Profile analysis and social media research tool"
- **Description**: "Building a Chrome extension to analyze Twitter profiles for engagement metrics and growth insights"
- **Be specific** about your intended use

## 🛡️ Security Notes

- **Never share** your Bearer Token publicly
- **Don't commit** real tokens to Git repositories
- **Consider** using environment variables for production
- **Monitor** your API usage in the X Developer Portal

## 🚀 Advanced Setup (Optional)

### Multiple API Configurations
Add a second Bearer Token for higher rate limits:

```javascript
config2: {
  bearerToken: 'AAAAAAAAAAAAAAAAAAAAASecondTokenHere',
  // ... other fields
}
```

### Proxy Server (For CORS Issues)
If direct API calls fail, the extension automatically uses a proxy server. No additional setup required for most users.

## 📞 Need Help?

1. **Check the main README.md** for detailed instructions
2. **Run the test script**: `node test-api-setup.js`
3. **Open a GitHub issue** with your error messages
4. **Check X Developer Documentation**: https://developer.twitter.com/en/docs

---

**🎯 Goal**: See "✅ Real-time Data Analysis" when analyzing profiles!

Once you complete these steps, your X Profile Analyzer will provide accurate, real-time data for any public X profile. 