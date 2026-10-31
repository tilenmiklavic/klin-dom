const { getDefaultConfig } = require('expo/metro-config');

const { resolveJsAsTs } = require('./metro-resolve');

const config = getDefaultConfig(__dirname);

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) =>
  resolveJsAsTs(upstream, context, moduleName, platform);

module.exports = config;
