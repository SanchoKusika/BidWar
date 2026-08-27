import type { CSSProperties } from 'react';
import { ICONS, type IconName } from './icons';

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Задаёт доступное имя. Без него иконка считается декоративной. */
  title?: string;
  style?: CSSProperties;
}

/**
 * Единственный способ вставить иконку. Никаких инлайновых path, PNG и эмодзи —
 * иконка обязана наследовать currentColor и работать в обеих темах.
 */
export function Icon({ name, size = 20, color = 'currentColor', title, style }: IconProps) {
  const Glyph = ICONS[name];

  // Реестр собран вручную, поэтому опечатка или новая иконка в макете возможны.
  // Отсутствующая иконка не должна ронять экран — только шуметь в разработке.
  if (!Glyph) {
    if (import.meta.env.DEV) console.warn(`Icon: нет в реестре — "${name}"`);
    return null;
  }

  return (
    <Glyph
      width={size}
      height={size}
      color={color}
      strokeWidth={2}
      absoluteStrokeWidth
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flex: '0 0 auto', display: 'block', ...style }}
    />
  );
}
