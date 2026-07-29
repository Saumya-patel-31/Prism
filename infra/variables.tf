variable "project_name" {
  description = "Prefix for resource names and tags."
  type        = string
  default     = "prism-demo"
}

variable "aws_region" {
  description = "Region for the S3 bucket. CloudFront itself is global."
  type        = string
  default     = "us-east-1"
}

variable "github_owner" {
  description = "GitHub user or org that owns the repository, e.g. \"saumyapatel\"."
  type        = string
}

variable "github_repo" {
  description = "Repository name, e.g. \"prism\"."
  type        = string
}

variable "github_branch" {
  description = "Only this branch may assume the deploy role."
  type        = string
  default     = "main"
}

variable "github_owner_id" {
  description = <<-EOT
    Numeric GitHub account ID. GitHub issues immutable OIDC subject claims of
    the form repo:OWNER@OWNER_ID/REPO@REPO_ID:ref:..., so the trust policy has
    to include the IDs or it will never match.

    Find it with:  curl -s https://api.github.com/users/<owner> | jq .id
  EOT
  type        = string
}

variable "github_repo_id" {
  description = <<-EOT
    Numeric repository ID, the second half of the immutable subject claim.

    Find it with:  curl -s https://api.github.com/repos/<owner>/<repo> | jq .id
  EOT
  type        = string
}

variable "create_oidc_provider" {
  description = <<-EOT
    Create the GitHub OIDC provider in this account. An AWS account can only
    hold one provider per URL, so set this to false if you have already added
    token.actions.githubusercontent.com for another project.
  EOT
  type        = bool
  default     = true
}
