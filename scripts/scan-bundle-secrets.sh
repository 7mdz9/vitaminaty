#!/usr/bin/env bash
# Bundle secret scan - guards against the service-role key VALUE leaking into the client bundle.
# Per the M0 Final Audit forensic dive (THREAT_MODEL.md Section 6, Section 9; PROJECT_STATE.md Section 6 item #5):
#   - The env-var NAME SUPABASE_SERVICE_ROLE_KEY legitimately appears in compiled bundles
#     because src/lib/env.ts references it via Zod validation. Scanning for the NAME is a
#     guaranteed false positive - that 8-char prefix hit during M0 was an anon-key collision.
#   - Supabase JWT-shaped keys share their header prefix until about char 110. Prefix scans for
#     JWT-shaped values must use at least 130 chars to disambiguate anon vs service-role.
# This scan reads the live service-role key VALUE from .env.local at execution time and looks
# for its first 130 characters in the .next/ build output. Zero matches = pass.

set -u

LOCAL_ENV=".env.local"
BUILD_DIR=".next"

if [ ! -f "$LOCAL_ENV" ]; then
  echo "ERROR: $LOCAL_ENV not found." >&2
  exit 2
fi

if [ ! -d "$BUILD_DIR" ]; then
  echo "ERROR: $BUILD_DIR not found. Run 'pnpm build' first." >&2
  exit 2
fi

PREFIX=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$LOCAL_ENV" \
  | head -n 1 \
  | cut -d= -f2- \
  | tr -d '"' \
  | head -c 130)

if [ "${#PREFIX}" -lt 130 ]; then
  echo "ERROR: extracted prefix is shorter than 130 chars (got ${#PREFIX})." >&2
  echo "  .env.local may have a malformed or missing SUPABASE_SERVICE_ROLE_KEY." >&2
  exit 2
fi

# -F fixed-string because JWTs contain regex-significant characters.
# -r recursive, -q silent.
if grep -rqF "$PREFIX" "$BUILD_DIR"; then
  echo "FAIL: service-role key VALUE prefix found in $BUILD_DIR - service-role key leaked." >&2
  echo "Run: grep -rlF \"\$PREFIX\" $BUILD_DIR" >&2
  exit 1
fi

echo "OK no service-role value in bundle"
exit 0
