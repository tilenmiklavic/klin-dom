module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/test/**/*.test.{ts,tsx}'],
  // @klindom/shared is consumed as TypeScript source with NodeNext-style `./x.js` specifiers.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
