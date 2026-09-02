export { getSupabase } from './client';
export { fetchHealth } from './health';
export { authenticate } from './auth';
export { fetchPaidLimits, fetchFxRates } from './config';
export { fetchMySpending } from './spending';
export {
  functionErrorMessage,
  isPaymentOutcomeUnknown,
  PaymentOutcomeUnknownError,
} from './errors';

export type { Health } from './health';
export type { AuthResult } from './auth';
export type { PaidLimits } from './config';
export type { Spending, SpendingReceipt } from './spending';
export type { PaymentResult } from './payments';
export type { Database, Tables, TablesInsert, TablesUpdate } from './database.types';
