# ─────────────────────────────────────────────────────────────────────────────
# Static hosting for the Prism demo: a private S3 bucket fronted by CloudFront.
#
# The bucket is never public. CloudFront reaches it through an Origin Access
# Control, and the bucket policy trusts only this one distribution, so the
# objects cannot be fetched directly from S3.
#
# Cost: CloudFront's always-free tier covers 1 TB egress and 10M requests per
# month; the bundle is a couple of megabytes. Nothing here provisions compute.
# ─────────────────────────────────────────────────────────────────────────────

# Bucket names are globally unique, so suffix with random hex.
resource "random_id" "bucket" {
  byte_length = 4
}

resource "aws_s3_bucket" "site" {
  bucket = "${var.project_name}-${random_id.bucket.hex}"

  # Every object here is regenerated from source by CI, so there is nothing to
  # protect. Without this, `terraform destroy` fails on a versioned bucket and
  # you have to delete each object version by hand.
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id

  # Lets you roll back a bad deploy. Old versions of a 2 MB site cost nothing
  # meaningful, but they are expired below so they cannot accumulate forever.
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "site" {
  bucket     = aws_s3_bucket.site.id
  depends_on = [aws_s3_bucket_versioning.site]

  rule {
    id     = "expire-noncurrent"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# ── CloudFront ───────────────────────────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.project_name}-oac"
  description                       = "Signs CloudFront requests to the private demo bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# The export is directory-style (/chat/index.html). CloudFront does not apply
# a default root object to subpaths, so rewrite them at the edge.
resource "aws_cloudfront_function" "rewrite_index" {
  name    = "${var.project_name}-rewrite-index"
  runtime = "cloudfront-js-2.0"
  comment = "Maps directory-style URLs onto their index.html"
  publish = true

  # Kept to conservative ES5 string methods — the CloudFront Functions runtime
  # is not a full modern JS engine.
  code = <<-JS
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      if (uri.charAt(uri.length - 1) === "/") {
        request.uri = uri + "index.html";
      } else if (uri.lastIndexOf(".") < uri.lastIndexOf("/")) {
        // Last segment carries no file extension (/chat) — serve its index.
        request.uri = uri + "/index.html";
      }

      return request;
    }
  JS
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "${var.project_name} static demo"

  # Free, and some mobile networks are IPv6-only.
  is_ipv6_enabled = true

  # North America and Europe only — the cheapest tier.
  price_class = "PriceClass_100"

  origin {
    origin_id                = "s3-${aws_s3_bucket.site.id}"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${aws_s3_bucket.site.id}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS managed "CachingOptimized" policy.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.rewrite_index.arn
    }
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 300
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # The free *.cloudfront.net certificate. Attaching a custom domain would
    # mean a Route 53 hosted zone, which is not free.
    cloudfront_default_certificate = true
  }
}

# Only this distribution may read the bucket.
data "aws_iam_policy_document" "bucket_policy" {
  statement {
    sid     = "AllowCloudFrontRead"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    resources = ["${aws_s3_bucket.site.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket     = aws_s3_bucket.site.id
  policy     = data.aws_iam_policy_document.bucket_policy.json
  depends_on = [aws_s3_bucket_public_access_block.site]
}
