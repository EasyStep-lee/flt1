import type { operations } from '../types.js';

type JsonResponse<TOperation extends { readonly responses: object }> =
  TOperation['responses'][keyof TOperation['responses']] extends {
    readonly content: { readonly 'application/json': infer TBody };
  }
    ? TBody
    : never;

export type FoundationMiniappContracts = {
  readonly 'health.getLiveness': {
    readonly requestBody: undefined;
    readonly responseBody: JsonResponse<operations['health.getLiveness']>;
  };
  readonly 'health.getReadiness': {
    readonly requestBody: undefined;
    readonly responseBody: JsonResponse<operations['health.getReadiness']>;
  };
};
