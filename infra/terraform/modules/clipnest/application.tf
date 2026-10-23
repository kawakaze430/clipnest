locals {
  public_origin = "https://${var.custom_domain != "" ? var.custom_domain : aws_cloudfront_distribution.site.domain_name}"
  ecs_trust = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Principal = {
        Service = "ecs-tasks.amazonaws.com"
      },
      Action = "sts:AssumeRole"
      }
    ]
    }
  )
  image = var.container_image_digest == "" ? "${aws_ecr_repository.app.repository_url}:bootstrap-unavailable" : "${aws_ecr_repository.app.repository_url}@${var.container_image_digest}"
  runtime_environment = {
    NODE_ENV                   = "production"
    HOST                       = "0.0.0.0"
    PORT                       = "8787"
    DEPLOYMENT_ENV             = var.environment
    PUBLIC_ORIGIN              = local.public_origin
    DATABASE_SECRET_ARN        = aws_secretsmanager_secret.application_database.arn
    DB_TLS                     = "verify-full"
    DB_CA_FILE                 = "/app/certs/rds-global-bundle.pem"
    COOKIE_SECURE              = "true"
    INLINE_WORKER              = "false"
    ALLOW_REGISTRATION         = "false"
    REQUIRE_EMAIL_VERIFICATION = "true"
    TRUST_PROXY_HOPS           = "2"
    STORAGE_BACKEND            = "s3"
    S3_BUCKET                  = aws_s3_bucket.media.id
    MEDIA_BASE_URL             = local.public_origin
    CLOUDFRONT_KEY_PAIR_ID     = aws_cloudfront_public_key.media.id
    QUEUE_MODE                 = "sqs"
    SQS_QUEUE_URL              = aws_sqs_queue.work.id
    SQS_DLQ_URL                = aws_sqs_queue.dead.id
    MAIL_MODE                  = "ses"
    MAIL_FROM                  = var.mail_from
    AWS_REGION                 = var.region
    MAX_FILE_BYTES             = "262144000"
    MAX_DURATION_SECONDS       = "900"
    MAX_CONCURRENT_JOBS        = "2"
    GLOBAL_DAILY_JOB_LIMIT     = "100"
    GLOBAL_DAILY_BYTE_LIMIT    = "10737418240"
    MAX_QUEUED_JOBS            = "100"
    DATA_DIR                   = "/app/.cache"
    TMPDIR                     = "/tmp"
  }
  log_options = {
    "awslogs-group" = aws_cloudwatch_log_group.app.name, "awslogs-region" = var.region, "awslogs-stream-prefix" = "clipnest"
  }
}
resource "aws_cloudwatch_log_group" "app" {
  name              = "/clipnest/${var.environment}"
  retention_in_days = 14
}
resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = local.ecs_trust
}
resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_iam_role_policy" "execution_secrets" {
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [aws_secretsmanager_secret.session.arn, aws_secretsmanager_secret.media_signing.arn]
      },
      {
        Effect = "Allow", Action = ["kms:Decrypt"], Resource = aws_kms_key.secrets.arn, Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.region}.amazonaws.com"
          }
        }
      }
    ]
    }
  )
}
resource "aws_iam_role" "api" {
  name               = "${local.name}-api"
  assume_role_policy = local.ecs_trust
}
resource "aws_iam_role" "worker" {
  name               = "${local.name}-worker"
  assume_role_policy = local.ecs_trust
}
resource "aws_iam_role" "migration" {
  name               = "${local.name}-migration"
  assume_role_policy = local.ecs_trust
}
resource "aws_iam_role_policy" "runtime_database" {
  for_each = {
    api = aws_iam_role.api.id, worker = aws_iam_role.worker.id
  }
  role = each.value
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = aws_secretsmanager_secret.application_database.arn
      },
      {
        Effect = "Allow", Action = ["kms:Decrypt"], Resource = aws_kms_key.secrets.arn, Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.region}.amazonaws.com"
          }
        }
      }
    ]
    }
  )
}
resource "aws_iam_role_policy" "worker" {
  role = aws_iam_role.worker.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [
      {
        Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"], Resource = "${aws_s3_bucket.media.arn}/media/*"
      },
      {
        Effect = "Allow", Action = ["s3:ListBucket"], Resource = aws_s3_bucket.media.arn, Condition = {
          StringLike = {
            "s3:prefix" = "media/*"
          }
        }
      },
      {
        Effect = "Allow", Action = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes", "sqs:SendMessage"], Resource = aws_sqs_queue.work.arn
      },
      {
        Effect = "Allow", Action = ["sqs:SendMessage"], Resource = aws_sqs_queue.dead.arn
      },
      {
        Effect = "Allow", Action = ["ses:SendEmail"], Resource = aws_sesv2_email_identity.sender.arn, Condition = {
          StringEquals = {
            "ses:FromAddress" = var.mail_from
          }
        }
      }
    ]
    }
  )
}
resource "aws_iam_role_policy" "migration" {
  role = aws_iam_role.migration.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [
      {
        Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [aws_db_instance.main.master_user_secret[0].secret_arn, aws_secretsmanager_secret.application_database.arn]
      },
      {
        Effect = "Allow", Action = ["secretsmanager:PutSecretValue"], Resource = aws_secretsmanager_secret.application_database.arn
      },
      {
        Effect = "Allow", Action = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"], Resource = aws_kms_key.secrets.arn, Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.region}.amazonaws.com"
          }
        }
      }
    ]
    }
  )
}
resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.api.arn
  volume {
    name = "cache"
  }
  volume {
    name = "temporary"
  }
  ephemeral_storage {
    size_in_gib = 30
  }
  container_definitions = jsonencode([{
    name = "api", image = local.image, essential = true, readonlyRootFilesystem = true, user = "1000", stopTimeout = 30, portMappings = [{
      containerPort = 8787, protocol = "tcp"
      }
      ], environment = [for name, value in merge(local.runtime_environment, {
        APP_ROLE = "api"
        }
        ) : {
        name = name, value = value
      }
      ], secrets = [{
        name = "SESSION_SECRET", valueFrom = aws_secretsmanager_secret.session.arn
      },
      {
        name = "CLOUDFRONT_PRIVATE_KEY", valueFrom = aws_secretsmanager_secret.media_signing.arn
      }
      ], mountPoints = [{
        sourceVolume = "cache", containerPath = "/app/.cache", readOnly = false
      },
      {
        sourceVolume = "temporary", containerPath = "/tmp", readOnly = false
      }
      ], linuxParameters = {
      capabilities = {
        drop = ["ALL"]
      },
      initProcessEnabled = true
    },
    healthCheck = {
      command = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:8787/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""], interval = 30, timeout = 15, retries = 3, startPeriod = 60
    },
    logConfiguration = {
      logDriver = "awslogs", options = local.log_options
    }
    }
  ])
  lifecycle {
    precondition {
      condition     = (var.api_desired_count == 0 && var.worker_desired_count == 0) || var.container_image_digest != ""
      error_message = "Bootstrap with zero services, or provide a verified image digest."
    }
  }
}
resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.worker.arn
  volume {
    name = "cache"
  }
  volume {
    name = "temporary"
  }
  ephemeral_storage {
    size_in_gib = 30
  }
  container_definitions = jsonencode([{
    name = "worker", image = local.image, command = ["node", "backend/worker.mjs"], essential = true, readonlyRootFilesystem = true, user = "1000", stopTimeout = 30, environment = [for name, value in merge(local.runtime_environment, {
      APP_ROLE = "worker"
      }
      ) : {
      name = name, value = value
      }
      ], secrets = [{
        name = "SESSION_SECRET", valueFrom = aws_secretsmanager_secret.session.arn
      }
      ], mountPoints = [{
        sourceVolume = "cache", containerPath = "/app/.cache", readOnly = false
      },
      {
        sourceVolume = "temporary", containerPath = "/tmp", readOnly = false
      }
      ], linuxParameters = {
      capabilities = {
        drop = ["ALL"]
      },
      initProcessEnabled = true
    },
    healthCheck = {
      command = ["CMD", "node", "backend/worker-health.mjs"], interval = 30, timeout = 10, retries = 3, startPeriod = 60
    },
    logConfiguration = {
      logDriver = "awslogs", options = local.log_options
    }
    }
  ])
}
resource "aws_ecs_task_definition" "migration" {
  family                   = "${local.name}-migration"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.migration.arn
  container_definitions = jsonencode([{
    name = "migration", image = local.image, command = ["node", "backend/bootstrap-database.mjs"], essential = true, readonlyRootFilesystem = true, user = "1000",
    secrets = [{ name = "SESSION_SECRET", valueFrom = aws_secretsmanager_secret.session.arn }], environment = [
      { name = "PUBLIC_ORIGIN", value = local.public_origin }, {
        name = "AWS_REGION", value = var.region
      },
      {
        name = "MASTER_DATABASE_SECRET_ARN", value = aws_db_instance.main.master_user_secret[0].secret_arn
      },
      {
        name = "APPLICATION_DATABASE_SECRET_ARN", value = aws_secretsmanager_secret.application_database.arn
      },
      {
        name = "DB_HOST", value = aws_db_instance.main.address
      },
      {
        name = "DB_PORT", value = "5432"
      },
      {
        name = "DB_NAME", value = "clipnest"
      },
      {
        name = "DB_CA_FILE", value = "/app/certs/rds-global-bundle.pem"
      }
      ], logConfiguration = {
      logDriver = "awslogs", options = local.log_options
    },
    healthCheck = {
      command = ["CMD", "node", "-e", "process.exit(0)"], interval = 30, timeout = 5, retries = 2
    }
    }
  ])
}
resource "aws_ecs_service" "api" {
  name                               = "${local.name}-api"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.api.arn
  desired_count                      = var.api_desired_count
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 90
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = aws_subnet.application[*].id
    security_groups  = [aws_security_group.application.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8787
  }
  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }
  depends_on = [aws_lb_listener.private, aws_iam_role_policy.execution_secrets]
}
resource "aws_ecs_service" "worker" {
  name                               = "${local.name}-worker"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.worker.arn
  desired_count                      = var.worker_desired_count
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = aws_subnet.application[*].id
    security_groups  = [aws_security_group.application.id]
    assign_public_ip = false
  }
  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }
  depends_on = [aws_iam_role_policy.execution_secrets, aws_iam_role_policy.worker]
}
resource "aws_appautoscaling_target" "api" {
  count              = var.enable_autoscaling ? 1 : 0
  max_capacity       = 4
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}
resource "aws_appautoscaling_policy" "api_cpu" {
  count              = var.enable_autoscaling ? 1 : 0
  name               = "${local.name}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api[0].resource_id
  scalable_dimension = aws_appautoscaling_target.api[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.api[0].service_namespace
  target_tracking_scaling_policy_configuration {
    target_value = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
