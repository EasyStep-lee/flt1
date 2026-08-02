import {
  ConfigurationError,
  loadApiRuntimeConfig,
} from '../packages/config/dist/index.js';

try {
  const config = loadApiRuntimeConfig(process.env);
  process.stdout.write(
    `Configuration check passed: ${config.deploymentEnvironment} / ${config.nodeEnvironment}\n`,
  );
} catch (error) {
  if (error instanceof ConfigurationError) {
    process.stderr.write(
      `Configuration check failed [${error.code}]: ${error.fields.join(', ')}\n`,
    );
    process.exitCode = 1;
  } else {
    process.stderr.write('Configuration check failed [UNEXPECTED]\n');
    process.exitCode = 1;
  }
}
