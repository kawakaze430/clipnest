resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alerts"
}
resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Principal = {
        Service = ["cloudwatch.amazonaws.com", "budgets.amazonaws.com"]
      },
      Action = "sns:Publish", Resource = aws_sns_topic.alerts.arn, Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
      }
    ]
    }
  )
}
resource "aws_sns_topic_subscription" "operator" {
  count     = var.alert_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }
  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }
}
locals {
  alarms = {
    queue_age = {
      namespace = "AWS/SQS", metric = "ApproximateAgeOfOldestMessage", threshold = 300, statistic = "Maximum", period = 60, dimensions = {
        QueueName = aws_sqs_queue.work.name
      }
    }
    dead_letters = {
      namespace = "AWS/SQS", metric = "ApproximateNumberOfMessagesVisible", threshold = 0, statistic = "Maximum", period = 60, dimensions = {
        QueueName = aws_sqs_queue.dead.name
      }
    }
    database_storage = {
      namespace = "AWS/RDS", metric = "FreeStorageSpace", threshold = 2147483648, statistic = "Minimum", period = 60, dimensions = {
        DBInstanceIdentifier = aws_db_instance.main.id
      }
    }
    database_connections = {
      namespace = "AWS/RDS", metric = "DatabaseConnections", threshold = 60, statistic = "Maximum", period = 60, dimensions = {
        DBInstanceIdentifier = aws_db_instance.main.id
      }
    }
    api_errors = {
      namespace = "AWS/ApplicationELB", metric = "HTTPCode_Target_5XX_Count", threshold = 5, statistic = "Sum", period = 60, dimensions = {
        LoadBalancer = aws_lb.api.arn_suffix
      }
    }
    api_cpu = {
      namespace = "AWS/ECS", metric = "CPUUtilization", threshold = 85, statistic = "Average", period = 60, dimensions = {
        ClusterName = aws_ecs_cluster.main.name, ServiceName = aws_ecs_service.api.name
      }
    }
    worker_memory = {
      namespace = "AWS/ECS", metric = "MemoryUtilization", threshold = 85, statistic = "Average", period = 60, dimensions = {
        ClusterName = aws_ecs_cluster.main.name, ServiceName = aws_ecs_service.worker.name
      }
    }
    cleanup_age = {
      namespace = "ClipNest", metric = "OldestExpiredSeconds", threshold = 300, statistic = "Maximum", period = 60, dimensions = {
        Environment = var.environment, Role = "worker"
      }
    }
    source_failures = {
      namespace = "ClipNest", metric = "AnalysisFailure", threshold = 5, statistic = "Sum", period = 300, dimensions = {
        Environment = var.environment, Role = "worker"
      }
    }
    worker_disk = {
      namespace = "ECS/ContainerInsights", metric = "EphemeralStorageUtilized", threshold = 25, statistic = "Maximum", period = 60, dimensions = {
        ClusterName = aws_ecs_cluster.main.name, ServiceName = aws_ecs_service.worker.name
      }
    }
  }
}
resource "aws_cloudwatch_metric_alarm" "application" {
  for_each            = local.alarms
  alarm_name          = "${local.name}-${each.key}"
  namespace           = each.value.namespace
  metric_name         = each.value.metric
  comparison_operator = each.key == "database_storage" ? "LessThanThreshold" : "GreaterThanThreshold"
  statistic           = each.value.statistic
  threshold           = each.value.threshold
  period              = each.value.period
  dimensions          = each.value.dimensions
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}
resource "aws_cloudwatch_dashboard" "application" {
  dashboard_name = local.name
  dashboard_body = jsonencode({
    widgets = concat([
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6, properties = {
          title = "API response latency and errors", region = var.region, metrics = [["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.api.arn_suffix, {
            stat = "p95"
            }
            ], ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.api.arn_suffix, {
              stat = "Sum"
            }
          ]]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6, properties = {
          title = "Queue age and dead letters", region = var.region, metrics = [["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.work.name], ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.dead.name]]
        }
      }
      ], [for i, name in ["AnalysisSuccess", "AnalysisFailure", "JobReady", "JobFailure", "PreparedBytes", "ExpiredObjects", "OldestExpiredSeconds", "CleanupFailure", "QueuePublishFailure", "MailFailure"] : {
        type = "metric", x = (i % 2) * 12, y = 6 + floor(i / 2) * 6, width = 12, height = 6, properties = {
          title = name, region = var.region, metrics = [["ClipNest", name, "Environment", var.environment, "Role", "worker"]], stat = contains(["OldestExpiredSeconds", "ExpiredObjects"], name) ? "Maximum" : "Sum", period = 60
        }
      }
    ])
    }
  )
}
resource "aws_iam_openid_connect_provider" "github" {
  count          = var.github_repository == "" ? 0 : 1
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}
resource "aws_iam_role" "github_deploy" {
  count = var.github_repository == "" ? 0 : 1
  name  = "${local.name}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Principal = {
        Federated = aws_iam_openid_connect_provider.github[0].arn
      },
      Action = "sts:AssumeRoleWithWebIdentity", Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com", "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:${var.environment}"
        }
      }
      }
    ]
    }
  )
}
resource "aws_iam_role_policy" "github_deploy" {
  count = var.github_repository == "" ? 0 : 1
  role  = aws_iam_role.github_deploy[0].id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [
      {
        Effect = "Allow", Action = ["ecr:GetAuthorizationToken", "ecs:RegisterTaskDefinition", "ecs:DescribeTaskDefinition", "ecs:DescribeTasks", "ecs:DescribeServices", "ecs:ListTasks"], Resource = "*"
      },
      {
        Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"], Resource = aws_ecr_repository.app.arn
      },
      {
        Effect = "Allow", Action = ["ecs:UpdateService"], Resource = [aws_ecs_service.api.id, aws_ecs_service.worker.id]
      },
      {
        Effect = "Allow", Action = ["ecs:RunTask"], Resource = "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:task-definition/${local.name}-migration:*", Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.main.arn
          }
        }
      },
      {
        Effect = "Allow", Action = ["iam:PassRole"], Resource = [aws_iam_role.execution.arn, aws_iam_role.api.arn, aws_iam_role.worker.arn, aws_iam_role.migration.arn], Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      },
      {
        Effect = "Allow", Action = ["s3:ListBucket"], Resource = aws_s3_bucket.frontend.arn
      },
      {
        Effect = "Allow", Action = ["s3:PutObject", "s3:DeleteObject"], Resource = "${aws_s3_bucket.frontend.arn}/*"
      },
      {
        Effect = "Allow", Action = ["cloudfront:CreateInvalidation"], Resource = aws_cloudfront_distribution.site.arn
      }
    ]
    }
  )
}
