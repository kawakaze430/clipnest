output "security_posture" {
  value = {
    public_database      = aws_db_instance.main.publicly_accessible
    encrypted_database   = aws_db_instance.main.storage_encrypted
    database_multi_az    = aws_db_instance.main.multi_az
    private_alb          = aws_lb.api.internal
    private_frontend     = aws_s3_bucket_public_access_block.frontend.restrict_public_buckets
    private_media        = aws_s3_bucket_public_access_block.media.restrict_public_buckets
    immutable_images     = aws_ecr_repository.app.image_tag_mutability
    initial_api_tasks    = var.api_desired_count
    initial_worker_tasks = var.worker_desired_count
    public_registration  = false
  }
}
output "deployment" {
  value = {
    environment                 = var.environment
    mail_from                   = var.mail_from
    region                      = var.region
    cluster                     = aws_ecs_cluster.main.name
    api_service                 = aws_ecs_service.api.name
    worker_service              = aws_ecs_service.worker.name
    api_task                    = aws_ecs_task_definition.api.arn
    worker_task                 = aws_ecs_task_definition.worker.arn
    migration_task              = aws_ecs_task_definition.migration.arn
    application_subnets         = aws_subnet.application[*].id
    application_security_group  = aws_security_group.application.id
    image_repository            = aws_ecr_repository.app.repository_url
    frontend_bucket             = aws_s3_bucket.frontend.id
    media_bucket                = aws_s3_bucket.media.id
    public_origin               = local.public_origin
    distribution_id             = aws_cloudfront_distribution.site.id
    database_id                 = aws_db_instance.main.id
    alarm_prefix                = local.name
    database_host               = aws_db_instance.main.address
    master_database_secret      = aws_db_instance.main.master_user_secret[0].secret_arn
    application_database_secret = aws_secretsmanager_secret.application_database.arn
    session_secret              = aws_secretsmanager_secret.session.arn
    media_signing_secret        = aws_secretsmanager_secret.media_signing.arn
    viewer_tls_policy           = var.custom_domain == "" ? "TLSv1 (AWS default certificate)" : "TLSv1.2_2021"
    media_key_id                = aws_cloudfront_public_key.media.id
    media_public_key_sha256     = sha256(trimspace(var.media_public_key_pem))
    queue_url                   = aws_sqs_queue.work.id
    dead_letter_url             = aws_sqs_queue.dead.id
    deployment_role             = try(aws_iam_role.github_deploy[0].arn, null)
    alerts_topic                = aws_sns_topic.alerts.arn
  }
}
