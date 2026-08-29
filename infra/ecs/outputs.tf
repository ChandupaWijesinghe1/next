output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "service_name" {
  value = aws_ecs_service.api.name
}

output "alb_dns_name" {
  description = "Public ALB DNS — use as API base URL"
  value       = aws_lb.main.dns_name
}

output "api_url" {
  value = "http://${aws_lb.main.dns_name}"
}

output "health_url" {
  value = "http://${aws_lb.main.dns_name}/health"
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

output "verify_commands" {
  description = "Commands to verify healthy task + connectivity"
  value       = <<-EOT
    # 1. Health via ALB
    curl http://${aws_lb.main.dns_name}/health

    # 2. List running tasks
    aws ecs list-tasks --cluster ${aws_ecs_cluster.main.name} --service-name ${aws_ecs_service.api.name} --region ${var.aws_region}

    # 3. CloudWatch logs (RDS/Redis/S3 activity)
    aws logs tail ${aws_cloudwatch_log_group.api.name} --follow --region ${var.aws_region}

    # 4. ECS Exec into the task (replace TASK_ID)
    aws ecs execute-command --cluster ${aws_ecs_cluster.main.name} --task TASK_ID --container api --interactive --command "/bin/sh" --region ${var.aws_region}
  EOT
}
