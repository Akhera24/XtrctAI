#!/usr/bin/env node

/**
 * Updates package.json with dependencies required for the proxy implementation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load the current package.json
const packageJsonPath = path.resolve(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add the new dependencies if they don't exist yet
const newDevDependencies = {
  "express": "^4.18.2",
  "axios": "^1.6.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.1.5"
};

// Check if we need to add any dependencies
let dependenciesAdded = false;
for (const [name, version] of Object.entries(newDevDependencies)) {
  if (!packageJson.dependencies[name] && !packageJson.devDependencies[name]) {
    packageJson.devDependencies[name] = version;
    dependenciesAdded = true;
    console.log(`Adding dependency: ${name}@${version}`);
  }
}

if (dependenciesAdded) {
  // Save the updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('Updated package.json with new dependencies');
  
  // Install the new dependencies
  console.log('Installing new dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('Dependencies installed successfully!');
} else {
  console.log('All required dependencies are already installed.');
}

// Create server directory if it doesn't exist
const serverDir = path.resolve(__dirname, 'server');
if (!fs.existsSync(serverDir)) {
  fs.mkdirSync(serverDir);
  console.log('Created server directory');
}

console.log(`
Setup completed successfully!

Next steps:
1. Deploy the proxy server from the server/ directory
2. Update PROXY_SERVER_URL in scripts/proxy.js with your server URL
3. Rebuild the extension

For detailed instructions, see the server/README.md file.
`); 