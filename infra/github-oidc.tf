# ─────────────────────────────────────────────────────────────────────────────
# Keyless deploys from GitHub Actions.
#
# Instead of storing an AWS access key in repository secrets, GitHub mints a
# short-lived OIDC token describing the workflow run. AWS verifies it against
# GitHub's published keys and returns credentials that expire in an hour. No
# long-lived secret exists anywhere, so there is nothing to leak or rotate.
#
# The trust policy is pinned to one repository AND one branch, so a fork or a
# pull-request build cannot assume this role.
# ─────────────────────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # AWS validates GitHub's certificate against its own trust store, so this
  # value is no longer load-bearing — the argument is still required.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

locals {
  oidc_provider_arn = (
    var.create_oidc_provider
    ? aws_iam_openid_connect_provider.github[0].arn
    : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
  )
}

data "aws_iam_policy_document" "deploy_assume_role" {
  statement {
    effect = "Allow"

    # sts:TagSession is required because configure-aws-credentials attaches
    # session tags by default. Without it STS refuses the call and reports the
    # failure against AssumeRoleWithWebIdentity, which is thoroughly misleading.
    actions = [
      "sts:AssumeRoleWithWebIdentity",
      "sts:TagSession",
    ]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Scoped to a single branch of a single repo.
    #
    # GitHub issues *immutable* subject claims: the numeric owner and repo IDs
    # are embedded after each name, e.g.
    #   repo:owner@205691003/repo@1313265081:ref:refs/heads/main
    # Matching on names alone silently never matches. Pinning the IDs is also
    # stronger — the claim survives a rename, and nobody who later registers
    # your old username inherits access.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_owner}@${var.github_owner_id}/${var.github_repo}@${var.github_repo_id}:ref:refs/heads/${var.github_branch}"
      ]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name                 = "${var.project_name}-github-deploy"
  description          = "Assumed by GitHub Actions to publish the Prism demo"
  assume_role_policy   = data.aws_iam_policy_document.deploy_assume_role.json
  max_session_duration = 3600
}

# Least privilege: write the site objects, and invalidate this one distribution.
data "aws_iam_policy_document" "deploy_permissions" {
  statement {
    sid    = "SyncSiteObjects"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObject",
    ]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  statement {
    sid       = "ListSiteBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }

  statement {
    sid       = "InvalidateCache"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${var.project_name}-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_permissions.json
}
