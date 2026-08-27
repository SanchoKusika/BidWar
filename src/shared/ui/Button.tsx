import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/**
 * Единственная кнопка системы. Вариант несёт экономику и риск, а не просто цвет:
 * paid тратит деньги, free — голоса, attack — платное действие против другого
 * человека. Attack никогда не используется как обычное подтверждение.
 */
export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'outline' | 'paid' | 'free' | 'attack' | 'attack-quiet';

export type ButtonSize = 'sm' | 'md' | 'lg';

interface SizeSpec {
  h: number;
  px: number;
  gap: number;
  fs: string;
  icon: number;
}

/** md (44px) — минимальная цель для пальца, поэтому он и по умолчанию. */
const SIZES: Record<ButtonSize, SizeSpec> = {
  sm: { h: 36, px: 12, gap: 6, fs: 'var(--fs-13)', icon: 15 },
  md: { h: 44, px: 16, gap: 8, fs: 'var(--fs-15)', icon: 18 },
  lg: { h: 52, px: 20, gap: 8, fs: 'var(--fs-16)', icon: 20 },
};

interface VariantSpec {
  bg: string;
  fg: string;
  border: string;
  hover: string;
  press: string;
}

const VARIANTS: Record<ButtonVariant, VariantSpec> = {
  primary: {
    bg: 'var(--btn-primary-bg)',
    fg: 'var(--btn-primary-fg)',
    border: 'transparent',
    hover: 'var(--n-800)',
    press: 'var(--n-700)',
  },
  secondary: {
    bg: 'var(--btn-secondary-bg)',
    fg: 'var(--btn-secondary-fg)',
    border: 'transparent',
    hover: 'var(--border-default)',
    press: 'var(--border-strong)',
  },
  ghost: {
    bg: 'transparent',
    fg: 'var(--btn-ghost-fg)',
    border: 'transparent',
    hover: 'var(--surface-sunken)',
    press: 'var(--border-subtle)',
  },
  outline: {
    bg: 'transparent',
    fg: 'var(--text-primary)',
    border: 'var(--border-default)',
    hover: 'var(--surface-sunken)',
    press: 'var(--border-subtle)',
  },
  paid: {
    bg: 'var(--paid-accent)',
    fg: 'var(--paid-on-accent)',
    border: 'transparent',
    hover: 'var(--paid-accent-hover)',
    press: 'var(--paid-accent-press)',
  },
  free: {
    bg: 'var(--free-accent)',
    fg: 'var(--free-on-accent)',
    border: 'transparent',
    hover: 'var(--free-accent-hover)',
    press: 'var(--free-accent-press)',
  },
  attack: {
    bg: 'var(--attack-accent)',
    fg: 'var(--attack-on-accent)',
    border: 'transparent',
    hover: 'var(--attack-accent-hover)',
    press: 'var(--attack-accent-press)',
  },
  'attack-quiet': {
    bg: 'var(--attack-tint)',
    fg: 'var(--attack-text)',
    border: 'var(--attack-tint-border)',
    hover: 'var(--attack-tint)',
    press: 'var(--attack-tint-border)',
  },
};

export interface ButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  /** Квадратная кнопка без подписи. */
  iconOnly?: boolean;
  /** Во всю ширину — так выглядят основные действия в шторках. */
  block?: boolean;
  pill?: boolean;
  disabled?: boolean;
  /** Спиннер и блокировка. Показывается, пока идёт платёж. */
  loading?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  iconOnly = false,
  block = false,
  pill = false,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  style,
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const v = VARIANTS[variant];
  const s = SIZES[size];
  const off = disabled || loading;

  const background = off ? 'var(--btn-disabled-bg)' : press ? v.press : hover ? v.hover : v.bg;
  const color = off ? 'var(--btn-disabled-fg)' : v.fg;

  return (
    <button
      type={type}
      disabled={off}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      onTouchStart={() => setPress(true)}
      onTouchEnd={() => setPress(false)}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : iconOnly ? s.h : undefined,
        height: s.h,
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: iconOnly ? 0 : `0 ${s.px}px`,
        background,
        color,
        border: `var(--border-w) solid ${off ? 'transparent' : v.border}`,
        borderRadius: pill || iconOnly ? 'var(--radius-pill)' : 'var(--radius-control)',
        font: 'var(--type-button)',
        fontSize: s.fs,
        letterSpacing: 'var(--ls-tight)',
        transform: press && !off ? 'scale(var(--press-scale))' : 'none',
        transition: 'var(--t-control)',
        cursor: off ? 'not-allowed' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        ...style,
      }}
    >
      {loading ? (
        <Spinner size={s.icon} color={color} />
      ) : (
        icon && <Icon name={icon} size={s.icon} />
      )}
      {!iconOnly && children}
      {iconRight && !loading && <Icon name={iconRight} size={s.icon} />}
    </button>
  );
}

function Spinner({ size, color }: { size: number; color: string }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        animation: 'ds-spin 700ms linear infinite',
        display: 'inline-block',
        flex: '0 0 auto',
      }}
    />
  );
}
