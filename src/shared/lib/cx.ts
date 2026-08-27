/** Склейка классов: отбрасывает false, null и undefined. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
