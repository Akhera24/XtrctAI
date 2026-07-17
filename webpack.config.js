const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

// No .env injection here, deliberately.
//
// This build used to inject credentials from .env into the bundle via
// dotenv-webpack. That is security theater: whatever lands in the bundle ships
// to every user, who can unzip the extension and read it. The extension holds
// no credentials at all now — it calls the proxy, and the proxy (server/.env)
// is the only place a token exists. Re-adding dotenv-webpack here would undo
// that and put the token back in the client.

module.exports = {
  // Set build mode based on NODE_ENV, defaults to development
  // This is only used during build time and not in the Chrome extension
  mode: process.env.NODE_ENV || 'development',

  // Entry points — these must match what manifest.json actually loads.
  // The old entries pointed at ./scripts/background.js and ./scripts/content.js,
  // which were dead modules importing a file that was never committed. The
  // shipping service worker is the ROOT background.js, and the shipping content
  // script is the ROOT content.js.
  entry: {
    background: './background.js', // Service worker (manifest: background.service_worker)
    content: './content.js',       // Content script injected into pages
    popup: './popup/popup.js'      // Extension popup UI
  },

  // Fail the build on the first error so a broken bundle can never be
  // packaged and shipped as if it were fine.
  bail: true,

  // Output configuration
  output: {
    path: path.resolve(__dirname, 'dist'), // Build files will go to ./dist
    // background.js and content.js sit at the root of dist/, matching the paths
    // in manifest.json. The popup bundle must land in dist/popup/ because
    // popup/popup.html loads <script src="popup.js"> relative to itself —
    // emitting it as dist/popup.js leaves the built popup with a dead script tag.
    filename: (pathData) =>
      pathData.chunk.name === 'popup' ? 'popup/popup.js' : '[name].js',
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

  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy static assets to dist folder
        { from: "manifest.json", to: "manifest.json" },     // Extension manifest
        { from: "popup/popup.html", to: "popup/popup.html" }, // Popup HTML
        { from: "popup/popup.css", to: "popup/popup.css" },  // Popup styles
        { from: "styles", to: "styles" },                    // Global styles
        { from: "icons", to: "icons" },                       // Extension icons
        // manifest.json's content_scripts load these as plain files, not as
        // bundles, so they must exist verbatim in dist/ or the extension fails
        // to load. Only the files the manifest actually references are copied.
        { from: "scripts/bridge.js", to: "scripts/bridge.js" },
        { from: "scripts/debugging.js", to: "scripts/debugging.js" },
        { from: "scripts/utils/uiHelpers.js", to: "scripts/utils/uiHelpers.js" },
        { from: "scripts/utils/domHelpers.js", to: "scripts/utils/domHelpers.js" }
      ],
    }),
  ],

  // Configure how modules are resolved
  resolve: {
    extensions: ['.js'], // Allow importing JS files without extension
  }
};