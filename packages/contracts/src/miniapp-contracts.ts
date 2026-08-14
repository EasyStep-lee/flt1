import type { operations } from '../types.js';

type JsonResponse<TOperation extends { readonly responses: object }> =
  TOperation['responses'][keyof TOperation['responses']] extends {
    readonly content: { readonly 'application/json': infer TBody };
  }
    ? TBody
    : never;

type SuccessJsonResponse<TOperation extends { readonly responses: object }> =
  TOperation['responses'] extends {
    readonly 200: {
      readonly content: { readonly 'application/json': infer TBody };
    };
  }
    ? TBody
    : never;

type OperationById<TOperationId extends string> =
  TOperationId extends keyof operations ? operations[TOperationId] : never;

export type FoundationMiniappContracts = {
  readonly 'health.getLiveness': {
    readonly requestBody: undefined;
    readonly responseBody: JsonResponse<operations['health.getLiveness']>;
  };
  readonly 'health.getReadiness': {
    readonly requestBody: undefined;
    readonly responseBody: JsonResponse<operations['health.getReadiness']>;
  };
  readonly 'catalog.listSupplierProducts': {
    readonly requestBody: undefined;
    readonly responseBody: SuccessJsonResponse<
      OperationById<'catalog.listSupplierProducts'>
    >;
  };
  readonly 'catalog.getProductDetail': {
    readonly requestBody: undefined;
    readonly responseBody: SuccessJsonResponse<OperationById<'catalog.getProductDetail'>>;
  };
  readonly 'catalog.listProducts': {
    readonly requestBody: undefined;
    readonly responseBody: SuccessJsonResponse<OperationById<'catalog.listProducts'>>;
  };
};
