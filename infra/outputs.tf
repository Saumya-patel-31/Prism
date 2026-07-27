output "site_url" {
  description = "Public URL of the demo."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "bucket_name" {
  description = "S3 bucket holding the exported site. Set as AWS_S3_BUCKET in GitHub."
  value       = aws_s3_bucket.site.id
}

output "distribution_id" {
  description = "CloudFront distribution. Set as AWS_CLOUDFRONT_ID in GitHub."
  value       = aws_cloudfront_distribution.site.id
}

output "deploy_role_arn" {
  description = "Role GitHub Actions assumes. Set as AWS_DEPLOY_ROLE_ARN in GitHub."
  value       = aws_iam_role.deploy.arn
}
