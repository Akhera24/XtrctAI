// Required dependencies
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin'); // For copying static assets
const Dotenv = require('dotenv-webpack'); // For loading environment variables

module.exports = {
  // Set build mode based on NODE_ENV, defaults to development
  mode: process.env.NODE_ENV || 'development',

  // Entry points for different parts of the extension
  entry: {
    background: './scripts/background.js', // Background service worker
    content: './scripts/content.js',       // Content script injected into pages
    popup: './popup/popup.js',            // Extension popup UI
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
    new Dotenv({
      systemvars: true,     // Load all system environment variables as well
      safe: true,           // Load '.env.example' to verify the '.env' variables
      defaults: true,       // Load '.env.defaults' as the default values
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
        { from: "icons", to: "icons" },                      // Extension icons
        { from: ".env", to: ".env" }                         // Copy .env file for runtime access
      ],
    }),
  ],

  // Configure how modules are resolved
  resolve: {
    extensions: ['.js'], // Allow importing JS files without extension
  }
};