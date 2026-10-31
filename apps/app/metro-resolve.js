/**
 * @klindom/shared is consumed as TypeScript source with NodeNext-style `./x.js` specifiers:
 * resolve them to the `.ts` files. A specifier that resolves as written (e.g. merge-options'
 * own `./index.js` next to `index.mjs`) is left alone; stripping it would alias the module to itself.
 */
function resolveJsAsTs(upstream, context, moduleName, platform) {
  const resolve = upstream ?? context.resolveRequest;
  if (/^\.{1,2}\//.test(moduleName) && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName, platform);
    } catch {
      return resolve(context, moduleName.slice(0, -3), platform);
    }
  }
  return resolve(context, moduleName, platform);
}

module.exports = { resolveJsAsTs };
