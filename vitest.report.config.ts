import { defineConfig } from 'vitest/config';

import { testProjects } from './vitest.config.js';

const reportRoot = 'artifacts/test-results/vitest';

export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: testProjects,
    reporters: ['default', 'json', 'junit'],
    outputFile: {
      json: `${reportRoot}/results.json`,
      junit: `${reportRoot}/junit.xml`,
    },
  },
});
