#!/usr/bin/env bash
# Правило изоляции: ничто вне shared/platform и app/telegram не трогает Telegram напрямую.
# Это единственное, что удерживает кроссплатформенность — см. 08 План разработки.
set -uo pipefail

hits=$(grep -rn --include='*.ts' --include='*.tsx' \
  -e 'window\.Telegram' -e 'Telegram\.WebApp' \
  src/ \
  --exclude-dir=platform \
  --exclude-dir=telegram || true)

if [ -n "$hits" ]; then
  echo "Прямое обращение к Telegram вне shared/platform и app/telegram:"
  echo "$hits"
  echo
  echo "Используй слой shared/platform."
  exit 1
fi

echo "Изоляция платформы: ок"
