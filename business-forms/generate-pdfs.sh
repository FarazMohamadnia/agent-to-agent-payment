#!/usr/bin/env bash
# Generate A4 PDFs from RTL Persian business diagnostic forms.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
FORMS_DIR="$ROOT/forms"
PDF_DIR="$ROOT/pdf"
mkdir -p "$PDF_DIR"

CHROME="${CHROME_BIN:-}"
if [[ -z "$CHROME" ]]; then
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then
      CHROME="$(command -v "$c")"
      break
    fi
  done
fi

if [[ -z "${CHROME}" ]]; then
  echo "Chrome/Chromium not found" >&2
  exit 1
fi

FORMS=(
  "F01-business-identity:F01-شناسنامه-کسب-وکار"
  "F02-revenue-model:F02-مدل-درآمد-و-مالی"
  "F03-customer-market:F03-مشتری-و-بازار"
  "F04-sales-marketing:F04-فروش-و-بازاریابی"
  "F05-operations-automation:F05-عملیات-و-اتوماسیون"
  "F06-online-digital:F06-حضور-آنلاین-و-دیجیتال"
  "F07-team-priorities:F07-تیم-مشکلات-و-اولویت‌ها"
  "F08-physical-digital-security:F08-امنیت-فیزیکی-و-دیجیتال"
  "F09-bottlenecks-ai-replacement:F09-گلوگاه‌ها-و-جایگزینی-با-AI"
)

echo "Using: $CHROME"
for entry in "${FORMS[@]}"; do
  src="${entry%%:*}"
  out="${entry##*:}"
  html="$FORMS_DIR/${src}.html"
  pdf="$PDF_DIR/${out}.pdf"
  if [[ ! -f "$html" ]]; then
    echo "Missing: $html" >&2
    exit 1
  fi
  echo "→ $out.pdf"
  # Cloud/VM Chrome needs --no-sandbox; timeout avoids rare hangs after PDF write.
  timeout 60 "$CHROME" \
    --headless=new \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --no-pdf-header-footer \
    --print-to-pdf-no-header \
    --run-all-compositor-stages-before-draw \
    --virtual-time-budget=8000 \
    --print-to-pdf="$pdf" \
    "file://$html" \
    >/dev/null 2>&1 || true
  if [[ ! -s "$pdf" ]]; then
    echo "Failed to create $pdf" >&2
    exit 1
  fi
  ls -lh "$pdf"
done

echo "Done. PDFs in $PDF_DIR"
