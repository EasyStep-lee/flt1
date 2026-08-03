export type MiniappHttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export interface MiniappContractOperation<RequestBody = unknown, ResponseBody = unknown> {
  readonly requestBody: RequestBody;
  readonly responseBody: ResponseBody;
}

export type MiniappContractMap = Record<string, MiniappContractOperation>;

type MiniappContractShape<TContracts> = {
  readonly [TKey in keyof TContracts]: MiniappContractOperation;
};

export interface MiniappRuntimeResponse<TData> {
  readonly data: TData;
  readonly statusCode: number;
}

export interface MiniappRequestRuntime {
  request<TData>(options: {
    readonly data?: unknown;
    readonly fail: () => void;
    readonly header?: Readonly<Record<string, string>>;
    readonly method: MiniappHttpMethod;
    readonly success: (response: MiniappRuntimeResponse<TData>) => void;
    readonly url: string;
  }): unknown;
}

export interface MiniappRequestInput<TBody> {
  readonly body?: TBody;
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: MiniappHttpMethod;
  readonly url: string;
}

export class MiniappTransportError extends Error {
  readonly code: 'MINIAPP_HTTP_ERROR' | 'MINIAPP_REQUEST_FAILED';
  readonly statusCode: number | undefined;

  constructor(
    code: 'MINIAPP_HTTP_ERROR' | 'MINIAPP_REQUEST_FAILED',
    statusCode?: number,
  ) {
    super(code);
    this.name = 'MiniappTransportError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createMiniappRequestAdapter<
  TContracts extends MiniappContractShape<TContracts> = MiniappContractMap,
>(
  runtime: MiniappRequestRuntime,
) {
  return {
    execute<TKey extends keyof TContracts & string>(
      operation: TKey,
      input: MiniappRequestInput<TContracts[TKey]['requestBody']>,
    ): Promise<TContracts[TKey]['responseBody']> {
      void operation;
      return new Promise((resolve, reject) => {
        const optionalData = input.body === undefined ? {} : { data: input.body };
        const optionalHeaders = input.headers === undefined ? {} : { header: input.headers };
        runtime.request<TContracts[TKey]['responseBody']>({
          ...optionalData,
          ...optionalHeaders,
          fail: () => reject(new MiniappTransportError('MINIAPP_REQUEST_FAILED')),
          method: input.method ?? 'GET',
          success: (response) => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
              resolve(response.data);
              return;
            }
            reject(new MiniappTransportError('MINIAPP_HTTP_ERROR', response.statusCode));
          },
          url: input.url,
        });
      });
    },
  };
}
