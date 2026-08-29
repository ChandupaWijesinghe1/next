resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project_name}-api"
  retention_in_days = 14

  tags = {
    Project = var.project_name
  }
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name    = "${var.project_name}-cluster"
    Project = var.project_name
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${data.aws_ecr_repository.api.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]

      # Non-secret configuration
      environment = [
        { name = "APP_ENV", value = "production" },
        { name = "REDIS_URL", value = local.redis_url },
        { name = "S3_BUCKET_NAME", value = aws_s3_bucket.attachments.bucket },
        { name = "S3_REGION", value = var.aws_region },
        { name = "S3_ENDPOINT_URL", value = "" },
        { name = "CORS_ORIGINS", value = var.cors_origins },
        { name = "ARQ_QUEUE_NAME", value = "security-demo" },
        { name = "NOTIFICATIONS_URL", value = "http://127.0.0.1:8001" },
        { name = "AWS_DEFAULT_REGION", value = var.aws_region },
      ]

      # Secrets from Secrets Manager (JWT + DB password / full DATABASE_URL)
      secrets = [
        {
          name      = "JWT_SECRET_KEY"
          valueFrom = aws_secretsmanager_secret.jwt.arn
        },
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = aws_secretsmanager_secret.db_password.arn
        },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      # Container-level health check (assignment requirement)
      healthCheck = {
        command     = ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5)\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name    = "${var.project_name}-api"
    Project = var.project_name
  }
}

resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  enable_execute_command = var.enable_ecs_exec

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy.ecs_execution_secrets,
    aws_db_instance.main,
    aws_elasticache_cluster.main,
  ]

  tags = {
    Name    = "${var.project_name}-api"
    Project = var.project_name
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}
