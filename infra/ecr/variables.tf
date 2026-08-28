variable "aws_region" {
  description = "AWS region for ECR repositories"
  type        = string
  default     = "eu-north-1"
}

variable "project_name" {
  description = "Prefix for ECR repository names"
  type        = string
  default     = "wseek"
}

variable "repositories" {
  description = "Docker services to host in ECR"
  type        = list(string)
  default     = ["api", "notifications"]
}

variable "tagged_image_count" {
  description = "Maximum number of tagged images to retain per repository"
  type        = number
  default     = 10
}

variable "untagged_image_max_age_days" {
  description = "Delete untagged images older than this many days"
  type        = number
  default     = 7
}
