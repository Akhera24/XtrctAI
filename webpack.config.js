// Required dependencies
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin'); // For copying static assets
const Dotenv = require('dotenv-webpack'); // For loading environment variables
const webpack = require('webpack'); // Add webpack for DefinePlugin
const dotenv = require('dotenv');

// Load environment variables from .env file
const env = dotenv.config().parsed || {};

// Log which environment we're building for
console.log('Building extension with environment:', process.env.NODE_ENV || 'development');

module.exports = {
  // Set build mode based on NODE_ENV, defaults to development
  // This is only used during build time and not in the Chrome extension
  mode: process.env.NODE_ENV || 'development',

  // Entry points for different parts of the extension
  entry: {
    background: './scripts/background.js', // Background service worker
    content: './scripts/content.js',       // Content script injected into pages
    popup: './popup/popup.js',            // Extension popup UI (enhanced version)
    grokService: './scripts/grokService.js' // Grok AI integration service
  },

  // Output configuration
  output: {
    path: path.resolve(__dirname, 'dist'), // Build files will go to ./dist
    filename: '[name].js',                 // Use entry point name as file name
  },

  // Module rules for processing different file types
  module: {
    rules: [
      {
        test: /\.js$/,                    // Process all JS files
        exclude: /node_modules/,          // Except those in node_modules
        use: {
          loader: 'babel-loader',         // Use Babel for JS transpilation
          options: {
            presets: ['@babel/preset-env'] // Use preset-env for modern JS features
          }
        }
      }
    ]
  },

  // Webpack plugins
  plugins: [
    // Define environment variables for browser context
    new webpack.DefinePlugin({
      // Define an __ENV__ object that contains environment variables
      // This replaces references to __ENV__ with the processed environment variables
      '__ENV__': JSON.stringify({
        NODE_ENV: process.env.NODE_ENV || 'development',
        // Include all environment variables from .env file
        ...env,
        // Add build-time information
        BUILD_TIME: new Date().toISOString(),
        VERSION: require('./package.json').version
      }),
      // Provide an empty process.env object to prevent errors from any remaining references
      'process.env': JSON.stringify({
        NODE_ENV: process.env.NODE_ENV || 'development'
      })
    }),
    
    // Load environment variables from .env file
    new Dotenv({
      systemvars: true,     // Load all system environment variables as well
      safe: false,          // Don't require .env.example file
      defaults: false,      // Don't load .env.defaults file
      expand: true,         // Allows your variables to expand inside of one another
      ignoreStub: false,    // Set to true to avoid issues with the webpack-dev-server
      path: './.env'        // Specify the path to your .env file
    }),
    
    new CopyPlugin({
      patterns: [
        // Copy static assets to dist folder
        { from: "manifest.json", to: "manifest.json" },     // Extension manifest
        { from: "popup/popup.html", to: "popup/popup.html" }, // Popup HTML
        { from: "popup/popup.css", to: "popup/popup.css" },  // Popup styles
        { from: "styles", to: "styles" },                    // Global styles
        { from: "icons", to: "icons" },                       // Extension icons
        // Copy service worker for proxy functionality
        { from: "proxy-service-worker.js", to: "proxy-service-worker.js" }
      ],
    }),
  ],

  // Configure how modules are resolved
  resolve: {
    extensions: ['.js'], // Allow importing JS files without extension
  }
};