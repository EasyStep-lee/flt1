import 'reflect-metadata';

import type { INestApplication, LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import {
  loadRuntimeConfig,
  type RuntimeConfig,
} from './config/runtime-config.js';
import { FoundationExceptionFilter } from './http/foundation-exception.filter.js';
import { requestIdMiddleware } from './http/request-id.middleware.js';
import type { InfrastructureProbe } from './infrastructure/probe.js';
import { SafeJsonLogger } from './logging/safe-json.logger.js';

type Environment = Readonly<Record<string, string | undefined>>;

export interface CreateApplicationOptions {
  readonly env?: Environment;
  readonly config?: RuntimeConfig;
  readonly probes?: readonly InfrastructureProbe[];
  readonly logger?: LoggerService | false;
}

export const createApplication = async (
  options: CreateApplicationOptions = {},
): Promise<INestApplication> => {
  const config = options.config ?? loadRuntimeConfig(options.env ?? process.env);
  const moduleOptions = options.probes
    ? { config, probes: options.probes }
    : { config };
  const logger = options.logger === false ? false : options.logger ?? new SafeJsonLogger();
  const app = await NestFactory.create(AppModule.register(moduleOptions), {
    abortOnError: true,
    logger,
  });
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new FoundationExceptionFilter());
  return app;
};
