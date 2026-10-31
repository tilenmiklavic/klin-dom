// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveJsAsTs } = require('../metro-resolve') as {
  resolveJsAsTs: (upstream: undefined, ctx: any, name: string, platform: string) => unknown;
};

const ctxWith = (existing: string[]) => ({
  resolveRequest: (_ctx: unknown, name: string) => {
    if (existing.includes(name)) return { type: 'sourceFile', filePath: name };
    throw new Error(`unresolvable ${name}`);
  },
});

describe('resolveJsAsTs', () => {
  it('resolves a ./x.js specifier to ./x when only the extensionless file exists (shared TS source)', () => {
    const ctx = ctxWith(['./x']);
    expect(resolveJsAsTs(undefined, ctx, './x.js', 'web')).toEqual({ type: 'sourceFile', filePath: './x' });
  });

  it('keeps a real ./index.js file instead of stripping it onto a sibling (merge-options index.mjs)', () => {
    const ctx = ctxWith(['./index.js', './index']);
    expect(resolveJsAsTs(undefined, ctx, './index.js', 'web')).toEqual({ type: 'sourceFile', filePath: './index.js' });
  });
});
