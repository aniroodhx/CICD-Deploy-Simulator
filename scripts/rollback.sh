#!/usr/bin/env bash
# Phase 3 - rollback. Reverts the Deployment to its previous healthy revision
# (the canonical k8s "stop the bleeding" response), then shows status.
set -euo pipefail

echo "==> Revision history:"
kubectl -n prod rollout history deploy/deploy-sim-app

echo "==> Rolling back to the previous revision"
kubectl -n prod rollout undo deploy/deploy-sim-app

echo "==> Rollout status:"
kubectl -n prod rollout status deploy/deploy-sim-app --timeout=60s
kubectl -n prod get pods

cat <<'EOF'

Rolled back - live pods are healthy again.

NOTE (IaC drift): `kubectl rollout undo` fixed the LIVE cluster, but Terraform
state still records the broken value. Reconcile IaC so code matches reality:
  ./scripts/deploy-local.sh        # re-applies the good default config
EOF