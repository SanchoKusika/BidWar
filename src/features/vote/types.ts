/**
 * Контракт cast-votes. Правила — потолок баланса, тип и статус цели — держит
 * хранимка `cast_votes`; клиент их не дублирует, он только показывает отказ.
 */
export interface CastVotesParams {
  initData: string;
  projectId: number;
  /** Голоса целые и всегда положительные: дробного голоса не бывает. */
  amount: number;
}

export interface CastVotesResult {
  applied: true;
  balanceAfter: number;
}
