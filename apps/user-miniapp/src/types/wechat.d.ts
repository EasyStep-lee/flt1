import type { MiniappRequestRuntime } from '@fulishe/miniapp-kit';

declare global {
  const wx: MiniappRequestRuntime & {
    getStorageSync<TValue = unknown>(key: string): TValue;
    setStorageSync(key: string, value: unknown): void;
    removeStorageSync(key: string): void;
    scanCode(options: {
      readonly fail?: (error: { readonly errMsg?: string }) => void;
      readonly onlyFromCamera?: boolean;
      readonly scanType?: readonly ['qrCode', 'barCode'];
      readonly success: (result: { readonly result: string }) => void;
    }): void;
    requestPayment(options: {
      readonly timeStamp: string;
      readonly nonceStr: string;
      readonly package: string;
      readonly signType: 'RSA';
      readonly paySign: string;
      readonly success: (result: { readonly errMsg?: string }) => void;
      readonly fail: (error: { readonly errMsg?: string }) => void;
    }): void;
  };
  const __FULISHE_API_BASE_URL__: string;
  function App<TDefinition extends Record<string, unknown>>(definition: TDefinition): void;
  function getApp<TApplication extends object>(): TApplication;
  function Page<TDefinition extends Record<string, unknown>>(definition: TDefinition): void;
}

export {};
