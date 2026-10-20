export interface ClaimTaskParams {
  initData: string;
  taskId: number;
}

export interface ClaimTaskResult {
  /** The task was counted by this call. */
  claimed: boolean;
  /** Paid by this call; zero when it was not ready or counted before. */
  granted: number;
  /** The inviter's bonus, when this was the friend's seventh day in a row. */
  referralGranted: number;
  /** From the procedure that changed it — never `granted` added on the client. */
  balanceAfter: number;
  /**
   * Why nothing was paid, when the screen has something to do about it:
   * open the bot, open the channel's boost page, or redraw the list.
   */
  reason?: 'not_ready' | 'done' | 'bot_unreachable' | 'not_boosted';
}
