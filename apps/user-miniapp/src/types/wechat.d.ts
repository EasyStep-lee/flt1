import type { MiniappRequestRuntime } from '@fulishe/miniapp-kit';

declare global {
  const wx: MiniappRequestRuntime & {
    getStorageSync<TValue = unknown>(key: string): TValue;
    setStorageSync(key: string, value: unknown): void;
    removeStorageSync(key: string): void;
  };
  const __FULISHE_API_BASE_URL__: string;
  function App<TDefinition extends Record<string, unknown>>(definition: TDefinition): void;
  function getApp<TApplication extends object>(): TApplication;
  function Page<TDefinition extends Record<string, unknown>>(definition: TDefinition): void;
}

export {};
