export interface CheckSubscriptionParams {
  initData: string;
  /** Проект, чей канал проверяем: задание привязано к нему, а не к каналу напрямую. */
  projectId: number;
}

export interface CheckSubscriptionResult {
  subscribed: boolean;
  /** Начислено за это задание. Ноль, когда оно уже было засчитано раньше. */
  granted: number;
  /** Доплата пригласившему, если это первое задание новичка. */
  referralGranted: number;
  /**
   * Баланс после начисления — из той же хранимки, что его и изменила.
   * Складывать `granted` с балансом, который держит экран, нельзя дважды: тот
   * может отставать от голоса, отданного на другой вкладке, и доплаты за
   * приглашённого в нём нет вовсе.
   */
  balanceAfter: number;
}
