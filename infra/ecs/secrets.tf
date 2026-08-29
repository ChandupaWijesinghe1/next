resource "random_password" "jwt" {
  length  = 48
  special = false
}

# Secrets Manager: JWT secret + database password
resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.project_name}/jwt-secret"
  description             = "JWT signing secret for WSeek API"
  recovery_window_in_days = 0

  tags = {
    Project = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.project_name}/db-password"
  description             = "RDS Postgres password for WSeek API"
  recovery_window_in_days = 0

  tags = {
    Project = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

# SSM Parameter Store (SecureString) — also required by the assignment
resource "aws_ssm_parameter" "jwt" {
  name        = "/${var.project_name}/jwt-secret"
  description = "JWT signing secret (Parameter Store mirror)"
  type        = "SecureString"
  value       = random_password.jwt.result

  tags = {
    Project = var.project_name
  }
}

resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.project_name}/db-password"
  description = "RDS password (Parameter Store mirror)"
  type        = "SecureString"
  value       = random_password.db.result

  tags = {
    Project = var.project_name
  }
}

locals {
  # Full SQLAlchemy URL with password — stored as one secret for ECS injection
  database_url = format(
    "postgresql+psycopg://%s:%s@%s:5432/%s",
    var.db_username,
    urlencode(random_password.db.result),
    aws_db_instance.main.address,
    var.db_name,
  )

  redis_url = format(
    "redis://%s:6379/0",
    aws_elasticache_cluster.main.cache_nodes[0].address,
  )
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.project_name}/database-url"
  description             = "Full DATABASE_URL for the API (includes password)"
  recovery_window_in_days = 0

  tags = {
    Project = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}
