import { getAdminClient } from '../db.ts';

export interface ApplyResult {
  applied: boolean;
  projectId: number;
  pointsGranted: number;
}

/**
 * Обёртка над хранимкой: сама транзакция живёт в базе (см. миграцию
 * payment_layer). Здесь только вызов и разбор ответа.
 */
export async function applyPayment(
  paymentId: string,
  eventId: string,
  confirmed: boolean,
): Promise<ApplyResult> {
  const { data, error } = await getAdminClient().rpc('apply_payment', {
    p_payment_id: paymentId,
    p_provider_event_id: eventId,
    p_confirmed: confirmed,
  });

  if (error) throw error;
  type Row = { applied: boolean; project_id: number; points_granted: number };
  const row = (data as Row[] | null)?.[0];
  if (!row) throw new Error('apply_payment ничего не вернул');

  return {
    applied: row.applied,
    projectId: row.project_id,
    pointsGranted: Number(row.points_granted),
  };
}
