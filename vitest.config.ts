import { defineConfig } from 'vitest/config';

export const testProjects = [
  {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['packages/test-kit/test/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'api-contract',
      environment: 'node',
      include: ['apps/api/test/supertest/**/*.test.mjs'],
      testTimeout: 15_000,
    },
  },
];

export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: testProjects,
  },
});
