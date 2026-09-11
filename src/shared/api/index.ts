export { getSupabase } from './client';
export { fetchHealth } from './health';
export { authenticate } from './auth';
export { fetchPaidLimits, fetchFxRates } from './config';
export { fetchMySpending } from './spending';
export { fetchPreferences, savePreferences } from './preferences';
export {
  functionErrorMessage,
  isPaymentOutcomeUnknown,
  PaymentOutcomeUnknownError,
} from './errors';

export type { Health } from './health';
export type { AuthResult } from './auth';
export type { PaidLimits } from './config';
export type { Spending, SpendingReceipt } from './spending';
export type { Preferences, PreferencesPatch } from './preferences';
export type { PaymentResult } from './payments';
export type { Database, Tables, TablesInsert, TablesUpdate } from './database.types';
