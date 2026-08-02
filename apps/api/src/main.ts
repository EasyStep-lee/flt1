import { createApplication } from './bootstrap.js';
import { loadRuntimeConfig } from './config/runtime-config.js';

const config = loadRuntimeConfig(process.env);
const app = await createApplication({ config });
app.enableShutdownHooks();
await app.listen(config.apiPort, config.apiHost);

process.stdout.write(
  `${JSON.stringify({
    level: 'info',
    event: 'api.listening',
    host: config.apiHost,
    port: config.apiPort,
  })}\n`,
);
