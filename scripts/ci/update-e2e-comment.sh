#!/usr/bin/env bash
set -euo pipefail

COMMENT_ID="${1:-}"
PLATFORM="${2:-}"
STATE="${3:-}"
DETAIL="${4:-}"

if [[ -z "$COMMENT_ID" || "$COMMENT_ID" == "null" ]]; then
  exit 0
fi
if [[ -z "$PLATFORM" || -z "$STATE" ]]; then
  echo "Usage: $0 comment-id platform state [detail]" >&2
  exit 2
fi

REQUESTER="${REQUESTED_BY:-jingjing2222}"
REVISION="${TESTED_REPOSITORY:-${GITHUB_REPOSITORY}}@${TESTED_SHA:-${GITHUB_SHA}}"
RUN_LINK="${RUN_URL:-https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}}"
UPDATED_AT="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

body="$(printf '@%s %s E2E: %s\n\n- Detail: %s\n- Revision: %s\n- Run: %s\n- Updated: %s\n' \
  "$REQUESTER" \
  "$PLATFORM" \
  "$STATE" \
  "${DETAIL:-No detail}" \
  "$REVISION" \
  "$RUN_LINK" \
  "$UPDATED_AT")"

if ! gh api -X PATCH "repos/${GITHUB_REPOSITORY}/issues/comments/${COMMENT_ID}" \
  -f body="$body" >/dev/null; then
  echo "Warning: failed to update E2E progress comment ${COMMENT_ID}" >&2
fi
