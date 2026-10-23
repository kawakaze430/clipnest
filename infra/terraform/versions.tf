terraform {
  required_version = ">= 1.13.0, < 2.0.0"
  required_providers {
    aws = {
      source = "hashicorp/aws", version = "6.70.0"
    }
  }
  backend "s3" {
  }
}
provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Application = "ClipNest", Environment = var.environment, ManagedBy = "Terraform"
    }
  }
}
provider "aws" {
  alias  = "global"
  region = "us-east-1"
  default_tags {
    tags = {
      Application = "ClipNest", Environment = var.environment, ManagedBy = "Terraform"
    }
  }
}
