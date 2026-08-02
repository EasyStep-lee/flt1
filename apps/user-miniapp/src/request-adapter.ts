import {
  createMiniappRequestAdapter,
  type MiniappContractMap,
} from '@fulishe/miniapp-kit';

// M0-008 will replace this boundary alias with deterministic generated contract types.
type GeneratedContractsFromM0008 = MiniappContractMap;

export const requestAdapter = createMiniappRequestAdapter<GeneratedContractsFromM0008>(wx);
