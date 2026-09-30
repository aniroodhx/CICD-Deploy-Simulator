# CI/CD Deploy Simulator

A hands-on platform where you push code, watch a real GitHub Actions pipeline
build/test/deploy a sample app to a Kubernetes sandbox, hit a scripted failure,
debug it, and roll back — the deployment experience most bootcamp/CS grads never
get before their first job.

## Status

Phase 1 (core loop) built and verified locally: sample app + tests + Docker
build + health check. Pipeline written; not yet run in CI.

## Layout

```
app/                     Sample deployable API (Node 20, zero deps)
  server.js              / , /health , /version
  server.test.js         node --test suite
  Dockerfile             node:20-alpine
.github/workflows/
  pipeline.yml           build -> test -> push image to GHCR
k8s/                     Deployment + Service (readiness/liveness probes)
docs/DECISIONS.md        Architecture decision log
```

## Run locally

```bash
cd app
npm test                 # run tests
docker build -t deploy-sim-app:local .
docker run -p 8080:8080 deploy-sim-app:local
curl localhost:8080/health
```

## Stack

Node 20 · Docker · GitHub Actions · GHCR · Kubernetes (kind, in CI) ·
Terraform · Vite + React dashboard (planned).
