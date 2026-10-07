#!/usr/bin/env bash
# Phase 3 - rollback. Reliably restores the known-good declared state by
# re-applying the Terraform defaults (GREETING set, version=local).
#
# This is the declarative / GitOps-style rollback: revert to known-good CONFIG
# rather than `kubectl rollout undo`, whose "previous revision" may itself be bad
# if several broken deploys stacked up. Bonus: it also fixes IaC drift, so code
# and cluster agree afterward.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}/terraform"

echo "==> Current revision history (for reference):"
kubectl -n prod rollout history deploy/deploy-sim-app || true

echo "==> Rolling back: re-applying known-good config (GREETING set, version=local)"
terraform apply -auto-approve

echo "==> Rollout status:"
kubectl -n prod rollout status deploy/deploy-sim-app --timeout=90s
kubectl -n prod get pods

cat <<'EOF'

Rolled back to the known-good declared state — pods healthy, and Terraform
state now matches reality (no drift).
EOF