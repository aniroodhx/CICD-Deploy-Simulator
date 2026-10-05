#!/usr/bin/env bash
# Phase 3 - failure scenario "blank GREETING"
# Ships a broken deploy: GREETING is emptied, so /health returns 503, the
# readiness probe never passes, and the new rollout gets stuck. The old healthy
# pods keep serving, so "prod" stays up while the deploy is jammed - exactly how
# a bad config change behaves in real life.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}/terraform"

echo "==> Shipping BROKEN deploy (GREETING='', version=broken)"
terraform apply -auto-approve -var="greeting=" -var="app_version=broken"

echo
echo "==> Rollout status (expected: does NOT complete):"
kubectl -n prod rollout status deploy/deploy-sim-app --timeout=40s || true

cat <<'EOF'

The rollout is stuck. Investigate like an on-call engineer:
  kubectl -n prod get pods                   # a new pod stuck at 0/1 Running
  kubectl -n prod describe pod <pod>         # Events: "Readiness probe failed: HTTP 503"
  kubectl -n prod logs <pod>                 # the app's own logs
Then decide: fix forward, or roll back:
  ./scripts/rollback.sh
EOF