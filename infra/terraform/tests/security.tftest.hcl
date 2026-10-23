mock_provider "aws" {
  mock_data "aws_cloudfront_cache_policy" { defaults = { id = "11111111-1111-4111-8111-111111111111" } }
  mock_data "aws_cloudfront_origin_request_policy" { defaults = { id = "22222222-2222-4222-8222-222222222222" } }
  mock_data "aws_security_group" { defaults = { id = "sg-0123456789abcdef0" } }
  mock_resource "aws_lb" { defaults = { arn = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:loadbalancer/app/clipnest-staging-api/1234567890abcdef", dns_name = "internal-clipnest.ap-south-1.elb.amazonaws.com", arn_suffix = "app/clipnest-staging-api/1234567890abcdef" } }
  mock_data "aws_availability_zones" {
    defaults = { names = ["ap-south-1a", "ap-south-1b"] }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_resource "aws_db_instance" {
    defaults = {
      address            = "disposable.example.rds.amazonaws.com"
      master_user_secret = [{ secret_arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:master-test", kms_key_id = "test", secret_status = "active" }]
    }
  }
}
mock_provider "aws" {
  alias = "global"
}
variables {
  mail_from            = "owner@example.test"
  media_public_key_pem = <<PEM
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA00AnT4rfrLtdShaz4o4I
xTuU1YWedAg7fkR8ouTeQWa9kSuhH6aMNgZ2/aHFiUuxCk5DxrREq0sAHJcFvcTI
qC+GM0x32gXBZ5UIYuM8IFv4rYZSeGbsfra3B1Jhku6M7+K4IZVmYgL5LypAWGkH
nl9/RHg6U8+4aMXo9vdpCQILkql4y76cjYwCKcRmQWU68xEjbfsEnA5qWPgrZJrX
8vfxxEQizZFhAbKi708IOEjmQ2Dr9HWy8igCQj0CsdpCryarIDBGYF9CEQjc2oQo
asVER8aF7I2EHTpnf9bGRvp2Ss/GmhvR3Er+QA0AquGGgLJavPqpOTQbzcsMvlTs
lQIDAQAB
-----END PUBLIC KEY-----
PEM
  monthly_budget_usd   = 50
  db_engine_version    = "17.1"
}
run "private_bootstrap" {
  command = plan
  assert {
    condition     = output.security_posture.public_database == false && output.security_posture.encrypted_database && output.security_posture.database_multi_az
    error_message = "Database must remain private, encrypted and Multi-AZ."
  }
  assert {
    condition     = output.security_posture.private_alb && output.security_posture.private_frontend && output.security_posture.private_media
    error_message = "Origins and buckets must remain private."
  }
  assert {
    condition     = output.security_posture.initial_api_tasks == 0 && output.security_posture.initial_worker_tasks == 0 && output.security_posture.immutable_images == "IMMUTABLE" && !output.security_posture.public_registration
    error_message = "Bootstrap must not start an unverified image or open registration."
  }
}
