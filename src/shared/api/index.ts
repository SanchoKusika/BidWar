export { getSupabase } from './client';
export { fetchHealth } from './health';
export { authenticate } from './auth';
export { fetchPaidLimits } from './config';
export { functionErrorMessage } from './errors';

export type { Health } from './health';
export type { AuthResult } from './auth';
export type { PaidLimits } from './config';
export type { Database, Tables, TablesInsert, TablesUpdate } from './database.types';
