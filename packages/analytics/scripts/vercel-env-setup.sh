#!/usr/bin/env bash
set -euo pipefail

: "${ANALYTICS_SUPABASE_URL:?required}"
: "${ANALYTICS_SUPABASE_SERVICE_ROLE_KEY:?required}"

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI is required. Install it with: pnpm add -g vercel" >&2
  exit 1
fi

add_env() {
  local name="$1"
  local environment="$2"
  local value="$3"
  shift 3

  if [ "$environment" = "preview" ]; then
    vercel env add "$name" "$environment" "" --value "$value" --yes --force "$@"
  else
    vercel env add "$name" "$environment" --value "$value" --yes --force "$@"
  fi
}

# URL: production, all preview branches, and local Development.
for environment in production preview development; do
  add_env ANALYTICS_SUPABASE_URL "$environment" "$ANALYTICS_SUPABASE_URL"
done

# Service role key: production + all preview branches only.
# Vercel does not allow sensitive variables in Development.
add_env \
  ANALYTICS_SUPABASE_SERVICE_ROLE_KEY \
  production \
  "$ANALYTICS_SUPABASE_SERVICE_ROLE_KEY" \
  --sensitive
add_env \
  ANALYTICS_SUPABASE_SERVICE_ROLE_KEY \
  preview \
  "$ANALYTICS_SUPABASE_SERVICE_ROLE_KEY" \
  --sensitive

echo "Done. Redeploy to pick up the new analytics environment variables."
