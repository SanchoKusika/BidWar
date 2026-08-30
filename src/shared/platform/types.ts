/**
 * Единственный слой, знающий про Telegram.
 *
 * Всё остальное приложение работает через этот интерфейс и не знает, где оно
 * выполняется. В вебе методы не падают, а деградируют: системных кнопок нет,
 * тема берётся из prefers-color-scheme, оплата открывается редиректом.
 */

export type PlatformName = 'telegram' | 'web';

export type ColorScheme = 'light' | 'dark';

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

/**
 * У Telegram BackButton нет текста — это всегда просто стрелка назад, метод
 * setText у неё в реальном клиенте не существует (в отличие от MainButton).
 * Раньше оба типа кнопок были одним интерфейсом с общим show(text, onClick) —
 * вызов setText на BackButton падал необработанным исключением и ронял всё
 * приложение при первом переходе на вложенный экран (Rules, Doc, Project).
 */
export interface BackButton {
  /** В вебе — no-op: кнопку рисует сама разметка. */
  show(onClick: () => void): void;
  hide(): void;
}

export interface SystemButton {
  /** В вебе — no-op: кнопку рисует сама разметка. */
  show(text: string, onClick: () => void): void;
  hide(): void;
}

export interface Platform {
  readonly name: PlatformName;

  /**
   * Подписанные данные Telegram. На сервере проверяются заново — доверять
   * содержимому на клиенте нельзя. В вебе всегда null.
   */
  getInitData(): string | null;

  getColorScheme(): ColorScheme;
  onColorSchemeChange(handler: (scheme: ColorScheme) => void): () => void;

  /** Открыть внешнюю ссылку. Только в ответ на действие пользователя. */
  openLink(url: string): void;

  /** Открыть оплату. Только в ответ на действие пользователя. */
  openInvoice(url: string): Promise<InvoiceStatus>;

  haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error'): void;

  backButton: BackButton;
  mainButton: SystemButton;

  /** Сообщить оболочке, что приложение готово, и развернуть на весь экран. */
  ready(): void;
}
