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
 * Виды тактильного отклика.
 *
 * `selection` стоит особняком: в Telegram это `selectionChanged()` — самый
 * слабый из откликов, придуманный ровно под переключатели и выбор из
 * нескольких вариантов. Остальные — про событие с последствиями (платёж,
 * голос, отказ), и путать их нельзя: если щелчок тумблера ощущается как
 * применённый платёж, оба перестают что-либо значить.
 *
 * `warning` — третий итог рядом с успехом и отказом, и он нужен: «платёж
 * создан, ждём подтверждения» и «связь оборвалась, исход неизвестен» — не то и
 * не другое. Молчать в этих двух случаях хуже всего: человек смотрит в экран
 * ровно тогда, когда не понимает, что стало с его деньгами.
 *
 * `heavy` — единственный удар, который мы используем, и только под атаку: она
 * одна бьёт по другому человеку, и ощущаться должна не так, как зачисленное
 * повышение. `light`, `rigid` и `soft` не объявлены намеренно — честного случая
 * под них нет, а отклик ради разнообразия это шум.
 */
export type HapticKind =
  'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection';

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

  /**
   * Язык оболочки в формате Telegram (`ru`, `uz`, `en-US`). Это подсказка для
   * первого запуска, а не настройка: null — подсказки нет.
   */
  getLanguageCode(): string | null;

  getColorScheme(): ColorScheme;
  onColorSchemeChange(handler: (scheme: ColorScheme) => void): () => void;

  /** Открыть внешнюю ссылку. Только в ответ на действие пользователя. */
  openLink(url: string): void;

  /** Открыть оплату. Только в ответ на действие пользователя. */
  openInvoice(url: string): Promise<InvoiceStatus>;

  haptic(kind: HapticKind): void;

  /**
   * Пока открыта своя шторка, системный свайп-вниз Telegram (сворачивает
   * мини-апп) конкурирует с drag-to-dismiss шторки за один и тот же жест —
   * без этого одиночный свайп пальцем сворачивает всё приложение, а не
   * двигает панель (нужен обходной двойной тап с лупой). В вебе — no-op.
   */
  setVerticalSwipesEnabled(enabled: boolean): void;

  backButton: BackButton;
  mainButton: SystemButton;

  /** Сообщить оболочке, что приложение готово, и развернуть на весь экран. */
  ready(): void;
}
