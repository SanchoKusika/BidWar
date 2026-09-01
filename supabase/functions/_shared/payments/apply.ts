import { getAdminClient } from '../db.ts';

export interface ApplyResult {
  applied: boolean;
  projectId: number;
  /** Очки платежа: для raise — прибавка к своей ставке, для attack — урон цели. */
  pointsGranted: number;
  /** Что долетело до СВОЕЙ ставки. У raise равно pointsGranted, у attack — после хейрката. */
  creditedPoints: number;
  /**
   * Почему платёж не применён; null при успехе. Раньше applied = false
   * приходило по пяти разным причинам без способа их различить, и вызывающий
   * не мог сказать человеку, что именно случилось.
   */
  reason: string | null;
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
  type Row = {
    applied: boolean;
    project_id: number;
    points_granted: number;
    credited_points: number;
    reason: string | null;
  };
  const row = (data as Row[] | null)?.[0];
  if (!row) throw new Error('apply_payment ничего не вернул');

  return {
    applied: row.applied,
    projectId: row.project_id,
    pointsGranted: Number(row.points_granted),
    creditedPoints: Number(row.credited_points),
    reason: row.reason,
  };
}
