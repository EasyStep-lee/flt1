import {
  createMiniappRequestAdapter,
} from '@fulishe/miniapp-kit';
import type { FoundationMiniappContracts } from '@fulishe/contracts';

export const requestAdapter =
  createMiniappRequestAdapter<FoundationMiniappContracts>(wx);
