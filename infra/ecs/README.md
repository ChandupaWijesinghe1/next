# ECS Fargate — WSeek API

Deploys the API as an **ECS Fargate** service in **private subnets** with security group **`wseek-app-sg`**, backed by **RDS Postgres**, **ElastiCache Redis**, and **S3**.

## What this creates

| Requirement | Resource |
|---|---|
| Task definition: ECR image | `aws_ecs_task_definition.api` ← `wseek-api:latest` |
| CPU / memory | `256` CPU / `512` MiB (configurable) |
| Env vars | `REDIS_URL`, `S3_BUCKET_NAME`, `S3_REGION`, `CORS_ORIGINS`, … |
| Secrets | Secrets Manager + SSM Parameter Store (`JWT_SECRET_KEY`, `DB_PASSWORD`, `DATABASE_URL`) |
| CloudWatch logs | `/ecs/wseek-api` via `awslogs` driver |
| Container health check | `GET http://127.0.0.1:8000/health` |
| Fargate in private subnets | `assign_public_ip = false`, subnets = private |
| `app-sg` | `wseek-app-sg` — only ALB → port 8000 |
| ECS Exec | Enabled for connectivity checks |

Also created: VPC, NAT, ALB, RDS, Redis, S3, IAM roles.

## Prerequisites

1. ECR repos + pushed image (`infra/ecr` already done).
2. Image must include `psycopg` (added to `security-demo/requirements.txt`) — **rebuild & push** before/after apply:
   ```powershell
   # After commit, run GitHub Action "ECR Push", or rebuild locally
   ```
3. AWS credentials with permissions for VPC, ECS, RDS, ElastiCache, S3, IAM, Secrets Manager, SSM, Logs, ELB.

## Cost warning

This stack includes a **NAT Gateway** + **RDS** + **Redis** + **ALB** + **Fargate**. Expect ongoing AWS charges. Destroy when done:

```powershell
terraform destroy
```

## Deploy

```powershell
cd D:\INTERN\wseek-9\next\infra\ecs
copy terraform.tfvars.example terraform.tfvars
# edit cors_origins if needed
terraform init
terraform plan
terraform apply
```

Type `yes` when prompted. First apply can take **15–25 minutes** (RDS + Redis).

## Verify (≥ 1 healthy task + RDS / Redis / S3)

### 1. ALB health

```powershell
terraform output health_url
curl http://<alb-dns>/health
```

Expected: `{"status":"ok"}`

### 2. ECS service healthy

```powershell
aws ecs describe-services `
  --cluster wseek-cluster `
  --services wseek-api `
  --region eu-north-1 `
  --query "services[0].{running:runningCount,desired:desiredCount,events:events[0].message}"
```

`runningCount` should be `1`.

### 3. CloudWatch logs

```powershell
aws logs tail /ecs/wseek-api --follow --region eu-north-1
```

Look for uvicorn startup (DB connect via SQLAlchemy) without connection errors.

### 4. ECS Exec (shell into the task)

```powershell
# Get task ID
aws ecs list-tasks --cluster wseek-cluster --service-name wseek-api --region eu-north-1

# Open shell (replace TASK_ID)
aws ecs execute-command `
  --cluster wseek-cluster `
  --task TASK_ID `
  --container api `
  --interactive `
  --command "/bin/sh" `
  --region eu-north-1
```

Inside the container:

```sh
# Env shows Redis URL + S3 bucket (secrets are injected too)
env | grep -E 'REDIS|S3_|DATABASE|JWT' | sed 's/=.*/=***/'

# RDS reachability (host from DATABASE_URL)
python -c "import os,socket; u=os.environ['DATABASE_URL']; host=u.split('@')[1].split(':')[0]; print(socket.getaddrinfo(host,5432)[0])"

# Redis ping
python -c "import os,redis; r=redis.from_url(os.environ['REDIS_URL']); print(r.ping())"

# S3 list (task role)
python -c "import os,boto3; print(boto3.client('s3',region_name=os.environ['S3_REGION']).list_objects_v2(Bucket=os.environ['S3_BUCKET_NAME'],MaxKeys=1))"
```

## Point Vercel at the API

Set on Vercel:

```env
NEXT_PUBLIC_API_URL=http://<alb-dns-name>
```

(Prefer HTTPS later with an ACM certificate + HTTPS listener.)

## Update image after code change

1. Push to `main` → ECR Push workflow tags `latest` + SHA.
2. Force new ECS deployment:

```powershell
aws ecs update-service --cluster wseek-cluster --service wseek-api --force-new-deployment --region eu-north-1
```

Or bump `image_tag` in `terraform.tfvars` and `terraform apply`.
