import type { Config } from 'jest';

/**
 * Jest configuration for the in-memory user CRUD API.
 *
 * Coverage minimums required by the project (rules/testing/node.md):
 * statements 80%, branches 70%, functions 80%, lines 80%.
 * They are verified from the report emitted by the full `npm run test:coverage`
 * run (WP06) instead of a hard threshold so partial directory runs used during
 * development are not blocked by uncovered modules.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  clearMocks: true,
  verbose: true,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          module: 'commonjs',
          esModuleInterop: true,
          strict: true,
        },
      },
    ],
  },
};

export default config;
