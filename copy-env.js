// Copy environment file to dist directory
const fs = require('fs');
const path = require('path');

console.log('Running post-build processes...');

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Read .env file
try {
  const envFile = fs.readFileSync('.env', 'utf8');
  
  // Write to dist directory
  fs.writeFileSync(path.join('dist', '.env'), envFile);
  
  console.log('Environment file copied successfully.');
} catch (error) {
  console.error('Error copying environment file:', error.message);
}

// Copy proxy service worker
try {
  console.log('Ensuring proxy service worker is available...');
  
  // Check if proxy-service-worker.js exists in root
  if (fs.existsSync('proxy-service-worker.js')) {
    // Read the worker file
    const workerContent = fs.readFileSync('proxy-service-worker.js', 'utf8');
    
    // Write to dist directory
    fs.writeFileSync(path.join('dist', 'proxy-service-worker.js'), workerContent);
    
    console.log('Proxy service worker copied successfully.');
  } else {
    console.error('Could not find proxy-service-worker.js in root directory!');
  }
} catch (error) {
  console.error('Error copying proxy service worker:', error.message);
}

// Copy any other necessary files that might be missed by webpack
console.log('Post-build processes completed.'); 