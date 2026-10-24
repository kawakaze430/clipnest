variable "aws_account_id" {
  type        = string
  description = "Expected owner-authorized AWS account. Both providers refuse another authenticated account."
  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Supply the exact 12-digit owner-authorized AWS account ID."
  }
}
variable "region" {
  type    = string
  default = "ap-south-1"
}
variable "environment" {
  type    = string
  default = "staging"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Use staging or production."
  }
}
variable "name_prefix" {
  type    = string
  default = "clipnest"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,18}$", var.name_prefix))
    error_message = "Use a short lowercase resource prefix."
  }
}
variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}
variable "mail_from" {
  type        = string
  description = "Owner-controlled SES sender. Actual sending/production access must be verified before launch."
  validation {
    condition     = can(regex("^[^@ ]+@[^@ ]+\\.[^@ ]+$", var.mail_from))
    error_message = "Supply an owner-controlled email address."
  }
}
variable "media_public_key_pem" {
  type        = string
  description = "Public RSA key from scripts/prepare-deployment.mjs   never put the private key in tfvars."
  validation {
    condition     = strcontains(var.media_public_key_pem, "BEGIN PUBLIC KEY")
    error_message = "Supply the public PEM key only."
  }
}
variable "monthly_budget_usd" {
  type        = number
  description = "An owner-selected alert budget, not a guaranteed spending cap."
  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "An explicit positive budget is required."
  }
}
variable "alert_email" {
  type    = string
  default = ""
}
variable "github_repository" {
  type    = string
  default = ""
  validation {
    condition     = var.github_repository == "" || can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Use owner/repository, or leave empty to omit GitHub deployment access."
  }
}
variable "db_engine_version" {
  type        = string
  description = "Exact supported PostgreSQL 17 minor, verified using the target Region's RDS API."
  validation {
    condition     = can(regex("^17\\.[0-9]+$", var.db_engine_version))
    error_message = "Choose a currently supported PostgreSQL 17 minor in the selected Region."
  }
}
variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}
variable "container_image_digest" {
  type    = string
  default = ""
  validation {
    condition     = var.container_image_digest == "" || can(regex("^sha256:[a-f0-9]{64}$", var.container_image_digest))
    error_message = "Use a verified SHA-256 image digest."
  }
}
variable "api_desired_count" {
  type    = number
  default = 0
  validation {
    condition     = var.api_desired_count >= 0 && var.api_desired_count <= 4 && floor(var.api_desired_count) == var.api_desired_count && (var.api_desired_count == 0 || var.container_image_digest != "")
    error_message = "Use an integer count 0-4; a running task requires an explicitly verified image digest."
  }
}
variable "worker_desired_count" {
  type    = number
  default = 0
  validation {
    condition     = var.worker_desired_count >= 0 && var.worker_desired_count <= 4 && floor(var.worker_desired_count) == var.worker_desired_count && (var.worker_desired_count == 0 || var.container_image_digest != "")
    error_message = "Use an integer count 0-4; a running task requires an explicitly verified image digest."
  }
}
variable "enable_autoscaling" {
  type    = bool
  default = false
  validation {
    condition     = !var.enable_autoscaling || var.container_image_digest != ""
    error_message = "Populate a verified image digest before enabling autoscaling."
  }
}

variable "custom_domain" {
  type        = string
  default     = ""
  description = "Optional owner-controlled hostname; requires an already validated us-east-1 ACM certificate and DNS."
  validation {
    condition     = var.custom_domain == "" || can(regex("^[a-z0-9][a-z0-9.-]+[.][a-z]{2,}$", var.custom_domain))
    error_message = "Supply a hostname only, or leave empty for the generated staging hostname."
  }
}
variable "acm_certificate_arn" {
  type    = string
  default = ""
  validation {
    condition     = (var.custom_domain == "" && var.acm_certificate_arn == "") || (var.custom_domain != "" && can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/", var.acm_certificate_arn)))
    error_message = "A custom hostname requires a validated us-east-1 ACM certificate; leave both empty for the default hostname."
  }
}
