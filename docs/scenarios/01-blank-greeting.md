# Scenario 01 - "The greeting config got dropped"

## Ticket
> **DEPLOY-101:** Ship v`broken` of deploy-sim-app to prod. QA reported the
> homepage greeting looked off in the last change - deploy and confirm it's live.

## What actually happens
The deploy blanks the `GREETING` env var. The app's `/health` returns **503**
when `GREETING` is empty, so the new pods **never pass their readiness probe**
and the rollout stalls. The previous healthy pods keep serving traffic, so prod
stays up — but your new version is stuck and won't take over.

## Your job
1. **Ship it:** `./scripts/break.sh`
2. **Notice it's stuck:** the rollout never completes.
3. **Diagnose** like an on-call engineer:
   ```
   kubectl -n prod get pods                 # new pod stuck 0/1
   kubectl -n prod describe pod <pod>       # Events -> Readiness probe failed: HTTP 503
   kubectl -n prod logs <pod>               # app log line
   kubectl -n prod exec <pod> -- wget -qO- localhost:8080/health   # {"status":"unhealthy","reason":"GREETING not configured"}
   ```
4. **Decide:** fix forward (set `GREETING` correctly) or **roll back**:
   ```
   ./scripts/rollback.sh
   ```

## The lesson
- A failing **health check** is what stops a bad deploy from taking traffic -
  the probe is doing its job.
- **Rollback is a first-class response**, not an admission of failure.
- `kubectl rollout undo` fixes the live cluster fast but drifts from your IaC -
  reconcile Terraform afterward. (Fast recovery vs. IaC correctness is a real
  production trade-off.)