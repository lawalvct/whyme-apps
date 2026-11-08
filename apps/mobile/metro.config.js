// https://docs.expo.dev/guides/customizing-metro/
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are .sql files imported by drizzle/migrations.js.
config.resolver.sourceExts.push('sql');

// Web preview (`pnpm --filter mobile web`, or "mobile-web" in .claude/launch.json):
// expo-sqlite runs SQLite as WebAssembly, and its synchronous calls (used by Drizzle
// and the kv-store) need SharedArrayBuffer, which needs a cross-origin isolated page.
config.resolver.assetExts.push('wasm');

const isolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  for (const [name, value] of Object.entries(isolationHeaders)) res.setHeader(name, value);
  middleware(req, res, next);
};

// Expo's dev server sends the HTML page itself, before Metro's middleware above, and
// the page is what has to be isolated. So every response from this dev-server process
// gets the two headers. This file only runs in the Expo CLI / Metro process (dev server
// and bundling), never in the app, so nothing changes for the native builds.
const writeHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function withIsolation(...args) {
  if (!this.headersSent) {
    for (const [name, value] of Object.entries(isolationHeaders)) {
      if (!this.hasHeader(name)) this.setHeader(name, value);
    }
  }
  return writeHead.apply(this, args);
};

module.exports = config;
