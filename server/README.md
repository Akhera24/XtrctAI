# X API Proxy Server

A secure server-side proxy for handling X (Twitter) API requests to avoid CORS issues and protect API credentials.

## Why a Proxy Server?

This proxy server solves several common issues when working with the X API:

1. **CORS Issues**: The X API doesn't allow direct requests from browser extensions or web applications, resulting in CORS errors.
2. **API Key Security**: It keeps your API keys secure by storing them on the server, not exposing them in client-side code.
3. **Rate Limiting**: Provides centralized rate limiting management across multiple users.
4. **Error Handling**: Standardizes error responses and provides better error details.

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- X API credentials (Bearer Token, API Key, API Key Secret)

### Installation

1. Clone this repository
2. Navigate to the server directory

```bash
cd server
```

3. Install dependencies

```bash
npm install
```

4. Create an environment file

```bash
cp .env.example .env
```

5. Edit the `.env` file and add your X API credentials:

```bash
TWITTER_API_BEARER_TOKEN=your_bearer_token_here
TWITTER_API_KEY=your_api_key_here
TWITTER_API_KEY_SECRET=your_api_key_secret_here
```

### Running Locally

Start the development server:

```bash
npm run dev
```

The server will be available at http://localhost:3000

### Deployment

This server can be deployed to any Node.js hosting service like Heroku, Vercel, or Railway.

#### Deploying to Heroku

1. Install Heroku CLI and login
2. From the server directory:

```bash
heroku create x-analyzer-proxy
git init
heroku git:remote -a x-analyzer-proxy
git add .
git commit -m "Initial commit"
git push heroku main
```

3. Set environment variables:

```bash
heroku config:set TWITTER_API_BEARER_TOKEN=your_bearer_token_here
heroku config:set TWITTER_API_KEY=your_api_key_here
heroku config:set TWITTER_API_KEY_SECRET=your_api_key_secret_here
heroku config:set NODE_ENV=production
```

## API Endpoints

### Health Check

```
GET /health
```

Returns the server status and timestamp.

### Proxy API Requests

```
POST /api/proxy
```

Body:
```json
{
  "endpoint": "users/by/username/example",
  "method": "GET",
  "params": {
    "user.fields": "description,public_metrics"
  }
}
```

## Testing

To test the proxy server:

1. Start the server
2. Send a request to the health endpoint:

```
curl http://localhost:3000/health
```

3. Test the proxy with a simple X API call:

```
curl -X POST http://localhost:3000/api/proxy \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "tweets/1460323737035677698"}'
```

## Configuration

You can modify the server's behavior by changing environment variables in the `.env` file:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (`development` or `production`)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS 