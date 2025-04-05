# X API Proxy Server Deployment Guide

This guide provides step-by-step instructions for deploying the X API proxy server to various hosting platforms.

## Prerequisites

Before you begin deployment, make sure you have:

1. X API credentials (Bearer Token, API Key, API Key Secret)
2. Node.js 18+ and npm installed (for local testing)
3. Git installed

## Local Testing

Before deploying to production, test the server locally:

```bash
# Clone the repository if you haven't already
git clone <your-repository-url>
cd server

# Install dependencies
npm install

# Create .env file with your credentials
cp .env.example .env
# Edit the .env file with your actual credentials

# Start the server
npm run dev
```

The server should be running at http://localhost:3000. Test with:

```bash
curl http://localhost:3000/health
```

## Deployment Options

### 1. Heroku Deployment

Heroku is a great choice for quick deployment.

#### Prerequisites:
- Heroku CLI installed
- Heroku account

#### Steps:

1. Login to Heroku:
```bash
heroku login
```

2. Create a new Heroku app:
```bash
heroku create x-analyzer-proxy
```

3. Set your environment variables:
```bash
heroku config:set TWITTER_API_BEARER_TOKEN=your_bearer_token_here
heroku config:set TWITTER_API_KEY=your_api_key_here
heroku config:set TWITTER_API_KEY_SECRET=your_api_key_secret_here
heroku config:set NODE_ENV=production
```

4. Deploy the code:
```bash
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a x-analyzer-proxy
git push heroku main
```

5. Ensure a dyno is running:
```bash
heroku ps:scale web=1
```

6. Open the app:
```bash
heroku open
```

### 2. Railway Deployment

Railway is a modern hosting platform with a generous free tier.

#### Prerequisites:
- Railway CLI installed (optional)
- Railway account

#### Steps:

1. Go to [Railway.app](https://railway.app) and create an account
2. Create a new project
3. Choose "Deploy from GitHub"
4. Connect your GitHub account and select your repository
5. Go to the Variables tab and add:
   - `TWITTER_API_BEARER_TOKEN`
   - `TWITTER_API_KEY`
   - `TWITTER_API_KEY_SECRET`
   - `NODE_ENV=production`
6. Railway will automatically deploy your app
7. Click on "Settings" to find your app URL

### 3. AWS Elastic Beanstalk

For more production-level deployments, AWS Elastic Beanstalk is a good choice.

#### Prerequisites:
- AWS account
- AWS CLI and EB CLI installed

#### Steps:

1. Initialize EB CLI:
```bash
eb init x-analyzer-proxy --platform node.js --region us-east-1
```

2. Create a `.ebextensions` directory with configuration files:
```bash
mkdir .ebextensions
```

3. Create a file `.ebextensions/env.config`:
```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
```

4. Create a `Procfile`:
```
web: npm start
```

5. Create the environment:
```bash
eb create production-env
```

6. Set environment variables (either through AWS Console or CLI):
```bash
eb setenv TWITTER_API_BEARER_TOKEN=your_bearer_token_here TWITTER_API_KEY=your_api_key_here TWITTER_API_KEY_SECRET=your_api_key_secret_here
```

7. Deploy:
```bash
eb deploy
```

### 4. Digital Ocean App Platform

Another easy-to-use platform with good scaling capabilities.

#### Prerequisites:
- Digital Ocean account

#### Steps:

1. Login to Digital Ocean
2. Go to App Platform and click "Create App"
3. Connect your GitHub repository
4. Configure your app:
   - Select Node.js environment
   - Set HTTP port to 3000 (or the port you're using)
   - Set environment variables:
     - `TWITTER_API_BEARER_TOKEN`
     - `TWITTER_API_KEY`
     - `TWITTER_API_KEY_SECRET`
     - `NODE_ENV=production`
5. Choose your plan (Start with Basic)
6. Click Deploy to Production

## Post-Deployment Configuration

After deploying, you'll need to:

1. Update the proxy URL in your extension code:
   - Navigate to `scripts/proxy.js`
   - Update the `PROXY_SERVER_URL` constant with your deployed server URL

2. Test the proxy connection:
   - Use the "Test API Connection" button in the extension
   - Check the server logs for any issues

## Security Considerations

1. Never commit your API keys to version control
2. For production, consider setting up:
   - HTTPS (most platforms handle this automatically)
   - API rate limiting (implemented in the proxy server)
   - Monitoring and alerting

## Troubleshooting

If you encounter issues:

1. Check the server logs:
   - Heroku: `heroku logs --tail`
   - Railway: View logs in the dashboard
   - AWS EB: `eb logs`

2. Verify your environment variables are set correctly

3. Check the proxy server's health endpoint:
   - `https://your-server-url.com/health`

4. If the server is running but the extension can't connect:
   - Check CORS configuration
   - Ensure the server URL is correctly set in the extension

## Maintenance

1. Keep your dependencies updated regularly:
```bash
npm update
```

2. Monitor your API usage to avoid hitting rate limits

3. Set up a monitoring solution for production deployments 

## DigitalOcean Deployment

### Option 1: Deploy as a Standalone App

1. Create a new Droplet or App on DigitalOcean
2. Connect your GitHub repository or upload the code
3. Add environment variables:
   - `TWITTER_API_BEARER_TOKEN`: Your X/Twitter API Bearer Token
   - `PORT`: The port to run the server on (default: 3000)
   - `NODE_ENV`: Set to "production" for production deployments

### Option 2: Using DigitalOcean as a Proxy Server

The X Analyzer server can be configured to route API requests through a DigitalOcean proxy server. This can help with rate limiting issues, IP blocking, and regional API access.

1. Set up a DigitalOcean Droplet to serve as your proxy
2. Install and configure a proxy service like Squid:

   ```bash
   apt-get update
   apt-get install squid
   
   # Edit the Squid configuration
   nano /etc/squid/squid.conf
   ```
   
   Add the following configuration:
   
   ```
   # Create a username/password combination
   auth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/squid_passwd
   auth_param basic realm proxy
   acl authenticated proxy_auth REQUIRED
   http_access allow authenticated
   http_access deny all
   
   # Accept connections on port
   http_port 3128
   ```

3. Create a user for proxy authentication:
   ```bash
   touch /etc/squid/squid_passwd
   htpasswd -c /etc/squid/squid_passwd your_username
   ```

4. Restart Squid:
   ```bash
   systemctl restart squid
   ```

5. Configure your X Analyzer server to use the proxy by setting these environment variables:
   ```
   DO_PROXY_ENABLED=true
   DO_PROXY_HOST=your_droplet_ip
   DO_PROXY_PORT=3128
   DO_PROXY_USERNAME=your_username
   DO_PROXY_PASSWORD=your_password
   ```

## Managing Proxy Configurations

The X Analyzer proxy server supports multiple configuration options for connecting to the Twitter/X API:

1. **Direct Connection**: The default mode where the server connects directly to the Twitter API.

2. **DigitalOcean Proxy**: Route requests through a DigitalOcean proxy server to:
   - Bypass IP-based rate limits
   - Avoid region-specific restrictions
   - Add an additional layer of privacy

3. **Custom Proxy**: Configure a custom proxy server by setting the appropriate environment variables.

### Proxy Configuration Options

| Environment Variable | Description | Example |
|----------------------|-------------|---------|
| `DO_PROXY_ENABLED` | Enable/disable proxy (true/false) | `true` |
| `DO_PROXY_HOST` | Proxy server hostname or IP | `123.456.789.0` |
| `DO_PROXY_PORT` | Proxy server port | `3128` |
| `DO_PROXY_USERNAME` | Proxy authentication username | `proxyuser` |
| `DO_PROXY_PASSWORD` | Proxy authentication password | `proxypass` |

## Troubleshooting

- **Connection Issues**: Ensure your API credentials are correct and that your proxy server is properly configured
- **Rate Limiting**: Use the proxy configuration to avoid rate limiting issues
- **CORS Errors**: Configure the CORS settings properly for your client domains

## Additional Resources

- [Twitter API Documentation](https://developer.twitter.com/en/docs)
- [DigitalOcean Droplet Documentation](https://docs.digitalocean.com/products/droplets/)
- [Squid Proxy Documentation](http://www.squid-cache.org/Doc/) 