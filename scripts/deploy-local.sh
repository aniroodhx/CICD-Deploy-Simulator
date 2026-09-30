#!/usr/bin/env bash
# Phase 2: build the app image, load it into a local kind cluster, and deploy it via Terraform. Run from the repo root:  ./scripts/deploy-local.sh [tag]

set -euo pipefail

CLUSTER="deploysim"
TAG="${1:-local}"
IMAGE="deploy-sim-app:${TAG}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> [1/5] Ensuring kind cluster '${CLUSTER}' exists"
if ! kind get clusters | grep -q "^${CLUSTER}$"; then
  kind create cluster --name "${CLUSTER}"
fi

echo "==> [2/5] Building image ${IMAGE}"
docker build -t "${IMAGE}" "${ROOT}/app"

echo "==> [3/5] Loading image into kind (no registry needed)"
kind load docker-image "${IMAGE}" --name "${CLUSTER}"

echo "==> [4/5] Terraform apply"
cd "${ROOT}/terraform"
terraform init -input=false
terraform apply -auto-approve \
  -var="image=${IMAGE}" \
  -var="app_version=${TAG}"

echo "==> [5/5] Waiting for rollout"
kubectl -n prod rollout status deploy/deploy-sim-app --timeout=90s

cat <<EOF

Deployed. To reach it:
  kubectl -n prod port-forward svc/deploy-sim-app 8080:80
  curl localhost:8080/health
EOF