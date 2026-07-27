# Demo site infrastructure

Terraform for the public Prism demo: a private S3 bucket behind CloudFront,
plus a GitHub Actions deploy role that uses OIDC instead of stored AWS keys.

The Prism app itself is **not** deployed. It runs local models through Ollama,
so there is nothing to host — only the static demo bundle goes here.

## What gets created

| Resource | Why |
|---|---|
| S3 bucket (private, encrypted, versioned) | Holds the exported site. Never public. |
| CloudFront distribution | HTTPS, CDN, and the only path to the bucket. |
| Origin Access Control | Signs CloudFront→S3 requests so the bucket stays private. |
| CloudFront Function | Rewrites `/chat` → `/chat/index.html`. |
| IAM OIDC provider | Lets GitHub authenticate without a stored key. |
| IAM role + inline policy | Assumed by CI. Can write this bucket and invalidate this distribution — nothing else. |

## Cost

Everything here sits inside the always-free tier:

- **CloudFront** — 1 TB egress and 10M requests per month, permanently free. The bundle is about 2.4 MB.
- **S3** — a few megabytes of storage plus minimal requests, fractions of a cent.
- **IAM, OIDC, CloudFront Functions** — free.

No compute is provisioned. There is no NAT gateway, no load balancer, no
database, and no custom domain — those are the line items that generate
surprise bills. A custom domain is deliberately omitted because a Route 53
hosted zone costs $0.50/month; the `*.cloudfront.net` URL is free.

**Set a billing alarm before you apply anything.** AWS Budgets is free:

```bash
aws budgets create-budget \
  --account-id "$(aws sts get-caller-identity --query Account --output text)" \
  --budget '{"BudgetName":"prism-guardrail","BudgetLimit":{"Amount":"1","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}'
```

## Applying it

You need Terraform ≥ 1.6, the AWS CLI, and AWS credentials with permission to
create the resources above. On Windows both tools install with:

```bash
winget install Hashicorp.Terraform Amazon.AWSCLI
```

Open a **new** terminal afterwards so `PATH` picks them up, then authenticate.
`aws configure` prompts for an access key from your own IAM user and stores it
in `~/.aws/credentials`; Terraform reads it from there.

```bash
aws configure
aws sts get-caller-identity
```

The second command should print your account ID. Then:

```bash
cd infra
terraform init
```

Create `terraform.tfvars`:

```hcl
github_owner = "your-github-username"
github_repo  = "prism"
github_branch = "main"

# Set to false if this AWS account already has a GitHub OIDC provider —
# an account may only hold one per URL.
create_oidc_provider = true
```

Review before creating anything:

```bash
terraform plan
```

Read that output. It should create roughly a dozen resources and nothing that
runs continuously. Then:

```bash
terraform apply
```

## Wiring up GitHub

`terraform output` prints the four values CI needs. Add them to the repository
under **Settings → Secrets and variables → Actions**:

| Name | Kind | Value |
|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | Secret | `deploy_role_arn` |
| `AWS_S3_BUCKET` | Secret | `bucket_name` |
| `AWS_CLOUDFRONT_ID` | Secret | `distribution_id` |
| `SITE_URL` | Variable | `site_url` |
| `AWS_REGION` | Variable | matches `aws_region` (default `us-east-1`) |

Push to `main` and the workflow publishes. The role's trust policy is pinned to
that one repository and branch, so forks and pull-request builds cannot assume
it.

## Tearing it down

```bash
terraform destroy
```

The bucket is versioned, so if `destroy` refuses because it is not empty:

```bash
aws s3 rm "s3://$(terraform output -raw bucket_name)" --recursive
```

then destroy again.

## Notes

- CloudFront distributions take roughly 5–15 minutes to deploy, and `destroy`
  is similarly slow. That is normal.
- State is local by default. For a solo portfolio project that is fine; a team
  would move it to an S3 backend with DynamoDB locking.
