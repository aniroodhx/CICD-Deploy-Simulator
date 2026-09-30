# Architecture Decisions

Running log of locked decisions, so context isn't lost mid-build. Newest at top.

## Logs: backend is the source of truth, not GitHub

**Decision:** The dashboard's live log feed does **not** depend on GitHub for streamed logs.

- **Pipeline stage UI** (queued → building → testing → deploying, per-stage red/green):
  driven by polling the **GitHub Actions REST API** for job/step *status*. This is live and reliable.
- **Live log lines:** the build/deploy scripts in the workflow **POST their own log lines
  to our backend as they run**, e.g.:
  ```bash
  curl -sf -X POST "$DASHBOARD_URL/logs" \
    --data-urlencode "run=$GITHUB_RUN_ID" \
    --data-urlencode "line=[deploy] applying image tag ${GITHUB_SHA::7}" || true
  ```
  (`|| true` so a logging hiccup never fails the real pipeline step.)

**Why:** GitHub's REST API only returns full logs as a downloadable **zip after a job
completes** — there is no clean live per-line stream. Pushing our own lines is a few lines
of Bash, keeps the dashboard as the source of truth for logs (not just status), and makes
the product feel like an own platform rather than a wrapper around GitHub's UI.

**Implications:**
- Backend needs a `POST /logs` ingest endpoint + a stream/read endpoint (SSE or poll) per run.
- `DASHBOARD_URL` is injected into the workflow as an env/secret.
- Keep line format structured enough to tag by stage (e.g. `[build]`, `[test]`, `[deploy]`).

## Stack (locked)

| Layer | Choice |
|---|---|
| Sample app | Node 20, zero-dep `http`; tests via `node --test` |
| Container | Docker, `node:20-alpine` |
| CI/CD | GitHub Actions; registry GHCR |
| Orchestrator | Kubernetes via **kind, run in the Actions VM** (local k8s blocked in AgentSpaces — nested cgroup). Local dev uses a Docker "prod" target. |
| IaC | Terraform (kubernetes provider) — Phase 2 |
| Scenario engine | config-driven deterministic failures — Phase 3 |
| Dashboard | **Vite + React**, live GitHub Actions **status** via REST API + own **log** ingest (above) |
