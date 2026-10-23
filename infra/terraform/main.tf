module "clipnest" {
  source = "./modules/clipnest"
  providers = {
    aws = aws, aws.global = aws.global
  }
  custom_domain          = var.custom_domain
  acm_certificate_arn    = var.acm_certificate_arn
  region                 = var.region
  environment            = var.environment
  name_prefix            = var.name_prefix
  vpc_cidr               = var.vpc_cidr
  mail_from              = var.mail_from
  media_public_key_pem   = var.media_public_key_pem
  monthly_budget_usd     = var.monthly_budget_usd
  alert_email            = var.alert_email
  github_repository      = var.github_repository
  db_engine_version      = var.db_engine_version
  db_instance_class      = var.db_instance_class
  container_image_digest = var.container_image_digest
  api_desired_count      = var.api_desired_count
  worker_desired_count   = var.worker_desired_count
  enable_autoscaling     = var.enable_autoscaling
}
output "deployment" {
  value = module.clipnest.deployment
}
output "security_posture" {
  value = module.clipnest.security_posture
}
