# ECS Application Auto Scaling

## What this adds

| Requirement | Implementation |
|---|---|
| Auto Scaling target min 1 / max 4 | `aws_appautoscaling_target.api` |
| Target tracking CPU 70% | `aws_appautoscaling_policy.api_cpu` |
| Scale-out under load | `scripts/generate-load.ps1` hits `/load-test` |
| Scale-in after load stops | Stop load; wait for cooldown (~5 min) |

Files: `autoscaling.tf`, `scripts/generate-load.ps1`, `scripts/watch-scaling.ps1`

---

## Step 1 — Deploy autoscaling + load-test endpoint

```powershell
cd D:\INTERN\wseek-9\next\infra\ecs
terraform apply
```

This creates:
- Scaling target: **min 1**, **max 4** tasks
- Policy: **ECSServiceAverageCPUUtilization** target **70%**

Also rebuild/push API image (new `/load-test` route):

```powershell
# Commit security-demo changes, push to main → ECR Push workflow
# Then force new deployment:
aws ecs update-service --cluster wseek-cluster --service wseek-api --force-new-deployment --region eu-north-1
```

Verify load endpoint:

```powershell
curl.exe "$(terraform output -raw api_url)/load-test?duration=5"
```

---

## Step 2 — Confirm baseline (1 task)

**Terminal A:**

```powershell
cd D:\INTERN\wseek-9\next\infra\ecs
powershell -File .\scripts\watch-scaling.ps1
```

Expect: `desired=1 running=1`

Or:

```powershell
aws ecs describe-services --cluster wseek-cluster --services wseek-api --region eu-north-1 --query "services[0].{desired:desiredCount,running:runningCount}"
```

---

## Step 3 — Generate artificial load (scale-out)

**Terminal B** (keep Terminal A running):

```powershell
cd D:\INTERN\wseek-9\next\infra\ecs
powershell -File .\scripts\generate-load.ps1 -Workers 50 -DurationSeconds 600
```

What happens:
1. Many parallel requests hit `/load-test` (CPU burn ~45s each)
2. Average service CPU rises above **70%**
3. Application Auto Scaling increases **desired count** (up to 4)
4. New Fargate tasks start; ALB registers them in target group

In Terminal A you should see `desired` go **2 → 3 → 4** and `pending` > 0 while tasks launch.

Also check in AWS Console:
- **ECS** → cluster `wseek-cluster` → service `wseek-api` → **Tasks** tab
- **CloudWatch** → **Metrics** → `AWS/ECS` → `CPUUtilization` for service `wseek-api`

---

## Step 4 — Observe scale-in

1. Press **Ctrl+C** in Terminal B to stop load (or wait for script to finish)
2. Keep Terminal A running
3. Wait **~5–10 minutes** (scale-in cooldown default **300s** + metric stabilization)

You should see `desired` drop back toward **1** when CPU stays below target.

---

## Step 5 — Evidence for internship report

Capture screenshots or CLI output of:

```powershell
# Before load
aws ecs describe-services --cluster wseek-cluster --services wseek-api --region eu-north-1

# During load (desired > 1)
aws ecs list-tasks --cluster wseek-cluster --service-name wseek-api --region eu-north-1

# After load subsides (desired back to 1)
aws application-autoscaling describe-scaling-activities `
  --service-namespace ecs `
  --resource-id service/wseek-cluster/wseek-api `
  --region eu-north-1
```

Scaling activities show **ScaleOut** and **ScaleIn** events with timestamps.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| CPU never hits 70% | Increase `-Workers` (e.g. 80) or `-DurationSeconds` |
| No scale-out | Confirm `terraform apply` created autoscaling resources; check CloudWatch CPU metric |
| `/load-test` 404 | Redeploy API image with `ENABLE_LOAD_TEST=true` in task env |
| Tasks stuck at 1 | Service may still have manual desired count; autoscaling target must exist |

Disable load endpoint in production:

```hcl
enable_load_test_endpoint = false
```
