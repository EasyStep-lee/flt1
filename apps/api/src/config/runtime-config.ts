export {
  ConfigurationError as RuntimeConfigError,
  loadApiRuntimeConfig as loadRuntimeConfig,
} from '@fulishe/config';
export type {
  ApiRuntimeConfig as RuntimeConfig,
  NodeEnvironment as RuntimeEnvironment,
} from '@fulishe/config';

export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');
