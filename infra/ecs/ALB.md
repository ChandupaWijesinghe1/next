# Application Load Balancer (ALB)

## Requirement checklist

| Requirement | Status | Where |
|---|---|---|
| ALB in **public subnets** with **alb-sg** | Done | `alb.tf`, SG name `wseek-alb-sg` |
| Target group **type=ip**, health → `/health` | Done | `aws_lb_target_group.api` |
| HTTP listener (internship) **or** HTTP→HTTPS + ACM | Done | HTTP forward by default; set `acm_certificate_arn` for HTTPS |
| ECS service registered with target group | Done | `aws_ecs_service.api.load_balancer` |
| Health checks passing | Verify | `describe-target-health` → `healthy` |
| App reachable at ALB DNS | Done | `terraform output api_url` |
| E2E via ALB (auth, CRUD, uploads) | Script | `scripts/verify-alb-e2e.ps1` |

## Current live values (eu-north-1)

- ALB DNS: `wseek-alb-183297113.eu-north-1.elb.amazonaws.com`
- Health: `http://wseek-alb-183297113.eu-north-1.elb.amazonaws.com/health` → `{"status":"ok"}`
- Mode: **HTTP** (internship — no domain/ACM required)

## Apply ALB updates (HTTPS port on SG, optional ACM)

```powershell
cd D:\INTERN\wseek-9\next\infra\ecs
terraform apply
```

### Optional HTTPS later

1. Request/import an ACM certificate in **eu-north-1**.
2. Set in `terraform.tfvars`:

```hcl
acm_certificate_arn = "arn:aws:acm:eu-north-1:ACCOUNT:certificate/UUID"
```

3. `terraform apply` → HTTP:80 redirects to HTTPS:443.

## Verify health + target group

```powershell
curl.exe http://wseek-alb-183297113.eu-north-1.elb.amazonaws.com/health

aws elbv2 describe-target-health `
  --target-group-arn (aws elbv2 describe-target-groups --names wseek-api-tg --region eu-north-1 --query "TargetGroups[0].TargetGroupArn" --output text) `
  --region eu-north-1
```

Expect `"State": "healthy"`.

## End-to-end through ALB

```powershell
cd D:\INTERN\wseek-9\next\infra\ecs
powershell -File .\scripts\verify-alb-e2e.ps1 -BaseUrl http://wseek-alb-183297113.eu-north-1.elb.amazonaws.com
```

This exercises:

1. `GET /health`
2. Auth: `POST /auth/register` + `POST /auth/login`
3. CRUD: create team → project → task → patch task status
4. File upload: `POST /tasks/{id}/attachments` (S3)

## Point frontend at ALB

On Vercel:

```env
NEXT_PUBLIC_API_URL=http://wseek-alb-183297113.eu-north-1.elb.amazonaws.com
```

Ensure API `CORS_ORIGINS` includes your Vercel URL (already defaulted in Terraform).
