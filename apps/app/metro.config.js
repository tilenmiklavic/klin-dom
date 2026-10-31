const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @klindom/shared is consumed as TypeScript source with NodeNext-style `./x.js` specifiers:
// resolve them to the `.ts` files.
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  if (/^\.{1,2}\//.test(moduleName) && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.slice(0, -3), platform);
    } catch {
      // fall through to the unmodified specifier
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
