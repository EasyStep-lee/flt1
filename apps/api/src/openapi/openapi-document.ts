import {
  Module,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

import { HealthLivenessDto, HealthReadinessDto } from '../health/health.dto.js';
import { HealthService } from '../health/health.service.js';
import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import {
  FOUNDATION_PROBES,
  HEALTH_PROBE_TIMEOUT_MS,
} from '../infrastructure/probe.js';
import {
  SINGLE_MERCHANT_REPOSITORY,
  type SingleMerchantRepository,
} from '../merchant/single-merchant.repository.js';
import { SingleMerchantService } from '../merchant/single-merchant.service.js';
import { OPENAPI_CONTROLLERS } from './openapi-controller.registry.js';

type JsonValue =
  | boolean
  | null
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

const forbiddenPublicResponseFields = new Set([
  'approvedSupplyPrice',
  'grossMargin',
  'grossMarginRate',
  'supplierPayable',
  'supplierPayableAmount',
  'supplyPrice',
  'supplyPriceSnapshot',
]);

@Module({
  controllers: [...OPENAPI_CONTROLLERS],
  providers: [
    HealthService,
    { provide: FOUNDATION_PROBES, useValue: [] },
    { provide: HEALTH_PROBE_TIMEOUT_MS, useValue: 50 },
    SingleMerchantService,
    {
      provide: SINGLE_MERCHANT_REPOSITORY,
      useValue: {
        findCustomerFacingCompanies: async () => [],
      } satisfies SingleMerchantRepository,
    },
  ],
})
class OpenApiGenerationModule {}

const sortJsonValue = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, sortJsonValue(entry)]),
    );
  }
  return value;
};

const stableDocument = (document: OpenAPIObject): OpenAPIObject =>
  sortJsonValue(
    JSON.parse(JSON.stringify(document)) as JsonValue,
  ) as unknown as OpenAPIObject;

const collectForbiddenFields = (
  value: JsonValue,
  location = '$',
): readonly string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectForbiddenFields(entry, `${location}[${index}]`),
    );
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value).flatMap(([key, entry]) => {
    const current = `${location}.${key}`;
    const matches = forbiddenPublicResponseFields.has(key) ? [current] : [];
    return [...matches, ...collectForbiddenFields(entry, current)];
  });
};

export const createDeterministicOpenApiDocument = async (): Promise<OpenAPIObject> => {
  const app = await NestFactory.create(OpenApiGenerationModule, {
    abortOnError: true,
    logger: false,
  });

  try {
    await app.init();
    const configuration = new DocumentBuilder()
      .setTitle('福礼社统一 API')
      .setDescription('江苏福礼团供应链科技有限公司单商户平台 API 契约')
      .setVersion('1.0.0')
      .build();
    const document = SwaggerModule.createDocument(app, configuration, {
      extraModels: [
        ApiErrorResponseDto,
        HealthLivenessDto,
        HealthReadinessDto,
      ],
      operationIdFactory: (controllerKey, methodKey) =>
        `${controllerKey.replace(/Controller$/u, '').toLowerCase()}.${methodKey}`,
    });
    const sorted = stableDocument(document);
    const forbidden = collectForbiddenFields(
      JSON.parse(JSON.stringify(sorted)) as JsonValue,
    );
    if (forbidden.length > 0) {
      throw new Error(`PUBLIC_RESPONSE_FIELD_FORBIDDEN: ${forbidden.join(', ')}`);
    }
    return sorted;
  } finally {
    await app.close();
  }
};
