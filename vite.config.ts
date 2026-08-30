import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Кадры анимаций дизайн-системы объявлены один раз и глобально
 * (`shared/ui/tokens/motion.css`), а пользуются ими CSS-модули компонентов.
 * По умолчанию модуль скоупит не только классы, но и **имя анимации**, на
 * которое ссылается: `animation: ds-spin` превращается в
 * `animation: _ds-spin_a1b2c_1`, тогда как само `@keyframes ds-spin` остаётся
 * глобальным. Ссылка перестаёт находить определение, и анимация молча не
 * проигрывается — так были мертвы сразу все: спиннер кнопки, мерцание
 * скелетонов, точка «в сети», пламя на бейджах призёров.
 *
 * Поэтому имена с префиксом `ds-` остаются глобальными: это общий словарь
 * движения, и локальным он быть не должен. Классы компонентов так не
 * называются (проверяется тем, что они верблюжьи: `.scrim`, `.methodIcon`),
 * так что под правило попадают только кадры.
 */
function generateScopedName(name: string, filename: string): string {
  if (name.startsWith('ds-')) return name;
  // От пути относительно корня, а не абсолютного: иначе имена классов
  // разъезжаются между машиной разработчика и CI.
  const hash = createHash('sha256').update(relative(root, filename)).digest('hex').slice(0, 6);
  return `_${name}_${hash}`;
}

export default defineConfig({
  plugins: [react()],
  css: {
    modules: { generateScopedName },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
