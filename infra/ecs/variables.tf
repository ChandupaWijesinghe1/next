variable "aws_region" {
  description = "AWS region (must match ECR)"
  type        = string
  default     = "eu-north-1"
}

variable "project_name" {
  description = "Name prefix for all resources"
  type        = string
  default     = "wseek"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "image_tag" {
  description = "ECR image tag for the API container"
  type        = string
  default     = "latest"
}

variable "cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 512
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "cors_origins" {
  description = "Comma-separated allowed CORS origins"
  type        = string
  default     = "https://next-rho-ebon.vercel.app,http://127.0.0.1:3000"
}

variable "db_username" {
  type    = string
  default = "wseek"
}

variable "db_name" {
  type    = string
  default = "wseek"
}

variable "enable_ecs_exec" {
  description = "Enable ECS Exec for shell access into running tasks"
  type        = bool
  default     = true
}
