# ECR and image management

This folder provisions Amazon ECR repositories for the WSeek backend services and defines how images are built and retained.

## What is configured

| Requirement | Implementation |
|---|---|
| Image pushed with commit SHA + `latest` | `.github/workflows/ecr-push.yml` tags each build with `${{ github.sha }}` and `latest` |
| Scan on push | `image_scanning_configuration.scan_on_push = true` in Terraform |
| Lifecycle policy | Keep last **10** tagged images; delete **untagged** images older than **7 days** |

## Repositories

| Service | Dockerfile | ECR repository name |
|---|---|---|
| API (`security-demo`) | `security-demo/Dockerfile` | `wseek-api` |
| Notifications | `notifications/Dockerfile` | `wseek-notifications` |

## One-time AWS setup

### 1. Install tools

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [Terraform](https://developer.hashicorp.com/terraform/install) 1.5+

### 2. Configure AWS credentials

```powershell
aws configure
```

Your IAM user/role needs at least:

- `ecr:CreateRepository`
- `ecr:PutLifecyclePolicy`
- `ecr:PutImageScanningConfiguration`
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`
- `ecr:PutImage`

### 3. Create ECR repositories

```powershell
cd D:\INTERN\wseek-9\next\infra\ecr
copy terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

After apply, note the output `repository_urls`.

### 4. Add GitHub secrets

In your GitHub repo → **Settings → Secrets and variables → Actions**:

| Secret | Example |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `AWS_REGION` | `eu-north-1` |

Optional repository variable:

| Variable | Purpose |
|---|---|
| `ECR_REPOSITORY_PREFIX` | Override repo prefix if not using `wseek` |

### 5. Trigger a build

Push to `main` (when `security-demo/` or `notifications/` changes), or run **ECR Push** manually from the Actions tab.

## Manual local push (optional)

```powershell
$AWS_REGION = "eu-north-1"
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$REGISTRY = "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
$SHA = git rev-parse HEAD

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REGISTRY

docker build -t wseek-api:$SHA -f security-demo/Dockerfile security-demo
docker tag wseek-api:$SHA $REGISTRY/wseek-api:$SHA
docker tag wseek-api:$SHA $REGISTRY/wseek-api:latest
docker push $REGISTRY/wseek-api:$SHA
docker push $REGISTRY/wseek-api:latest
```

Repeat for `wseek-notifications` with `notifications/Dockerfile`.

## Verify scanning and lifecycle

```powershell
aws ecr describe-repositories --repository-names wseek-api --region eu-north-1
aws ecr get-lifecycle-policy --repository-name wseek-api --region eu-north-1
aws ecr describe-image-scan-findings --repository-name wseek-api --image-id imageTag=latest --region eu-north-1
```

Scan results appear in the ECR console under **Image scan findings** after the first push.
