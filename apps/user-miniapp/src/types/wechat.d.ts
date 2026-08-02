import type { MiniappRequestRuntime } from '@fulishe/miniapp-kit';

declare global {
  const wx: MiniappRequestRuntime;
  function App<TDefinition extends Record<string, unknown>>(definition: TDefinition): void;
  function Page<TDefinition extends Record<string, unknown>>(definition: TDefinition): void;
}

export {};
