output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "service_name" {
  value = aws_ecs_service.api.name
}

output "alb_dns_name" {
  description = "Public ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_security_group_id" {
  description = "alb-sg id (wseek-alb-sg)"
  value       = aws_security_group.alb.id
}

output "target_group_arn" {
  value = aws_lb_target_group.api.arn
}

output "https_enabled" {
  value = local.https_enabled
}

output "api_url" {
  value = "${local.api_scheme}://${aws_lb.main.dns_name}"
}

output "health_url" {
  value = "${local.api_scheme}://${aws_lb.main.dns_name}/health"
}

output "ecr_image" {
  value = "${data.aws_ecr_repository.api.repository_url}:${var.image_tag}"
}

output "s3_bucket_name" {
  value = aws_s3_bucket.attachments.bucket
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "cloudwatch_log_group" {
  value = aws_cloudwatch_log_group.api.name
}

output "secrets_manager_jwt_arn" {
  value = aws_secretsmanager_secret.jwt.arn
}

output "ssm_jwt_parameter" {
  value = aws_ssm_parameter.jwt.name
}

output "autoscaling_target_id" {
  value = aws_appautoscaling_target.api.resource_id
}

output "autoscaling_cpu_target" {
  value = var.autoscaling_cpu_target
}

output "autoscaling_capacity" {
  value = {
    min = var.autoscaling_min_capacity
    max = var.autoscaling_max_capacity
  }
}

output "verify_commands" {
  description = "Commands to verify ALB + healthy task"
  value       = <<-EOT
    # Health via ALB
    curl ${local.api_scheme}://${aws_lb.main.dns_name}/health

    # Target health
    aws elbv2 describe-target-health --target-group-arn ${aws_lb_target_group.api.arn} --region ${var.aws_region}

    # E2E script
    powershell -File scripts/verify-alb-e2e.ps1 -BaseUrl ${local.api_scheme}://${aws_lb.main.dns_name}
  EOT
}
