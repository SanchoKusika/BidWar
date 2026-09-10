import { getSettings, subscribeSettings } from '@/shared/settings';
import { en } from './en';
import { ru } from './ru';
import { uz } from './uz';
import type { Locale } from './locale';

/** Форму словаря задаёт английский: он обязан быть полным. */
export type Strings = typeof en;

/**
 * Перевод одного значения. Английский объявлен через `as const`, поэтому у
 * каждой строки там литеральный тип (`'Cancel'`, а не `string`) — без
 * расширения ни один перевод не присвоился бы. Функции сохраняют сигнатуру
 * целиком: у перевода обязаны быть те же аргументы, иначе подстановка
 * развалится молча.
 */
type Translated<T> = T extends (...args: infer Args) => infer Result
  ? (...args: Args) => Result
  : T extends string
    ? string
    : { [K in keyof T]: Translated<T[K]> };

/**
 * Остальные языки — частичные: непереведённый ключ берётся из английского.
 * Так перевод можно вести по частям, и незакрытая строка выглядит как чужой
 * язык, а не как пустое место или имя ключа на экране.
 *
 * Вложенные объекты (`addProject.free`, `docs.tabs`) переводятся целиком, а не
 * по ключу: словарь возвращает их одним значением, и половина перевода дала бы
 * `undefined` на второй половине.
 */
export type PartialStrings = {
  [Section in keyof Strings]?: {
    [Key in keyof Strings[Section]]?: Translated<Strings[Section][Key]>;
  };
};

const DICTS: Record<Locale, PartialStrings> = { RU: ru, UZ: uz, EN: en };

let current: Locale = getSettings().language;
subscribeSettings(() => {
  current = getSettings().language;
});

/**
 * Раздел словаря, который читает язык не в момент импорта, а в момент
 * обращения к строке.
 *
 * Прокси, а не обычный объект, ради одной вещи: половина экранов делает
 * `const t = strings.tasks` на уровне модуля — снимок берётся один раз за
 * жизнь вкладки, и после смены языка он остался бы старым. Переписать это
 * хуком значило бы тронуть двадцать файлов и всё равно не помочь помощникам
 * вроде `toReceipt`, которые не компоненты и хук позвать не могут.
 */
function createSection<Section extends keyof Strings>(name: Section): Strings[Section] {
  const fallback = en[name] as Record<string, unknown>;

  return new Proxy({} as Strings[Section], {
    get(_target, key: string) {
      const dict = DICTS[current][name] as Record<string, unknown> | undefined;
      const value = dict?.[key];
      return value !== undefined ? value : fallback[key];
    },
    // Прокси должен выглядеть как настоящий объект для Object.keys и `in`:
    // иначе редкий перебор строк молча увидит пустоту.
    has: (_target, key: string) => key in fallback,
    ownKeys: () => Reflect.ownKeys(fallback),
    getOwnPropertyDescriptor: (_target, key) => ({
      ...Reflect.getOwnPropertyDescriptor(fallback, key),
      configurable: true,
      enumerable: true,
    }),
  });
}

// Раздел создаётся один раз: `const t = strings.tasks` обязан получить один и
// тот же прокси, а не новый на каждое обращение.
const sections = new Map<string, unknown>();

export const strings: Strings = new Proxy({} as Strings, {
  get(_target, name: string) {
    let section = sections.get(name);
    if (section === undefined) {
      section = createSection(name as keyof Strings);
      sections.set(name, section);
    }
    return section;
  },
  has: (_target, key: string) => key in en,
  ownKeys: () => Reflect.ownKeys(en),
  getOwnPropertyDescriptor: (_target, key) => ({
    ...Reflect.getOwnPropertyDescriptor(en, key),
    configurable: true,
    enumerable: true,
  }),
});
