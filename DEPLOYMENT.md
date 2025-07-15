# Deployment Guide

This guide covers deployment procedures for the Smart Parking Serverless application across different environments.

## 🏗️ Infrastructure Overview

The application uses AWS CDK to manage infrastructure as code with the following stacks:

- **Database Stack**: DynamoDB tables with GSIs
- **API Stack**: Lambda functions, API Gateway, and IAM roles

## 🔧 Prerequisites

### Required Tools

- Node.js >= 18.0.0
- AWS CLI v2
- AWS CDK CLI v2
- Git

### AWS Permissions

Your AWS user/role needs the following permissions:

- CloudFormation (full access)
- Lambda (full access)
- API Gateway (full access)
- DynamoDB (full access)
- IAM (create/update roles and policies)
- SSM Parameter Store (read/write)
- CloudWatch Logs (create/write)

## 🌍 Environments

### Development (dev)
- **Purpose**: Local development and testing
- **Data**: Test data, can be destroyed/recreated
- **Monitoring**: Basic logging
- **Secrets**: Test keys and dummy values

### Staging (staging)
- **Purpose**: Pre-production testing and QA
- **Data**: Production-like test data
- **Monitoring**: Full monitoring enabled
- **Secrets**: Production-like but separate keys

### Production (prod)
- **Purpose**: Live production environment
- **Data**: Real customer data with backups
- **Monitoring**: Full monitoring with alerts
- **Secrets**: Production keys and sensitive data

## 🚀 Deployment Process

### 1. Pre-deployment Checklist

- [ ] Code reviewed and approved
- [ ] Tests passing (`npm test`)
- [ ] Linting passed (`npm run lint`)
- [ ] Environment variables configured
- [ ] Secrets set up in SSM Parameter Store
- [ ] AWS credentials configured

### 2. First-time Setup

```bash
# Clone repository
git clone <repository-url>
cd smart-parking-serverless

# Install dependencies
npm install

# Bootstrap CDK (one-time per account/region)
npx cdk bootstrap

# Set up secrets
npm run setup-secrets:dev
```

### 3. Development Deployment

```bash
# Deploy to development
npm run deploy:dev

# Or with custom parameters
./scripts/deploy.sh dev us-east-1
```

### 4. Staging Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Verify deployment
curl https://{api-url}/available-spaces?limit=5
```

### 5. Production Deployment

```bash
# Deploy to production (requires extra confirmation)
npm run deploy:prod

# Monitor deployment
aws cloudformation describe-stacks --stack-name SmartParking-API-prod
```

## 🔐 Secrets Management

### Setting Up Secrets

1. **Flutterwave API Key**
   ```bash
   aws ssm put-parameter \
     --name "/smartparking/prod/flutterwave-secret-key" \
     --value "FLWSECK-your-secret-key" \
     --type "SecureString"
   ```

2. **Webhook Secret**
   ```bash
   aws ssm put-parameter \
     --name "/smartparking/prod/webhook-secret" \
     --value "$(openssl rand -hex 32)" \
     --type "SecureString"
   ```

### Rotating Secrets

```bash
# Update existing parameter
aws ssm put-parameter \
  --name "/smartparking/prod/flutterwave-secret-key" \
  --value "new-secret-value" \
  --type "SecureString" \
  --overwrite

# Redeploy to pick up new secrets
npm run deploy:prod
```

## 📊 Post-deployment Verification

### 1. Health Checks

```bash
# Check API Gateway health
curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/prod/available-spaces?limit=1"

# Expected response
{
  "success": true,
  "message": "Available parking spaces retrieved",
  "data": {
    "items": [...],
    "count": 1,
    "cursor": null
  }
}
```

### 2. Lambda Function Tests

```bash
# Test each function via AWS CLI
aws lambda invoke \
  --function-name smartparking-prod-view-available-spots \
  --payload '{"queryStringParameters":{"limit":"5"}}' \
  response.json
```

### 3. Database Verification

```bash
# Check DynamoDB tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `smartparking`)]'

# Verify table structure
aws dynamodb describe-table --table-name payment-history-prod
```

## 🔄 Rollback Procedures

### 1. Application Rollback

```bash
# Rollback to previous version
git checkout <previous-commit>
npm run deploy:prod
```

### 2. Database Rollback

```bash
# Point-in-time recovery (if enabled)
aws dynamodb restore-table-to-point-in-time \
  --source-table-name payment-history-prod \
  --target-table-name payment-history-prod-restored \
  --restore-date-time 2025-01-15T10:00:00Z
```

### 3. Emergency Procedures

```bash
# Disable API Gateway stage
aws apigateway update-stage \
  --rest-api-id {api-id} \
  --stage-name prod \
  --patch-ops op=replace,path=/throttle/rateLimit,value=0

# Scale down Lambda concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name smartparking-prod-make-reservation \
  --provisioned-concurrency-config ProvisionedConcurrencyConfig=0
```

## 📈 Monitoring and Alerts

### CloudWatch Dashboards

Create dashboards for:
- API Gateway metrics (requests, latency, errors)
- Lambda metrics (invocations, duration, errors)
- DynamoDB metrics (read/write capacity, throttling)

### Alarms

Set up alarms for:
- High error rates (>5%)
- High latency (>5 seconds)
- DynamoDB throttling
- Lambda timeout errors

### Log Analysis

```bash
# View recent API Gateway logs
aws logs filter-log-events \
  --log-group-name /aws/apigateway/smartparking-prod \
  --start-time $(date -d '1 hour ago' +%s)000

# View Lambda function logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/smartparking-prod-make-reservation \
  --start-time $(date -d '1 hour ago' +%s)000
```

## 🧹 Cleanup

### Development Environment

```bash
npm run destroy:dev
```

### Staging Environment

```bash
npm run destroy:staging
```

### Production Environment

```bash
# Requires manual confirmation
npm run destroy:prod
```

## 🚨 Troubleshooting

### Common Deployment Issues

1. **CDK Bootstrap Required**
   ```
   Error: Need to perform AWS CDK bootstrap
   Solution: Run `npx cdk bootstrap`
   ```

2. **Insufficient Permissions**
   ```
   Error: User is not authorized to perform action
   Solution: Check IAM permissions and AWS credentials
   ```

3. **Parameter Not Found**
   ```
   Error: Parameter /smartparking/prod/flutterwave-secret-key not found
   Solution: Run setup-secrets script or create parameter manually
   ```

4. **Stack Update Failed**
   ```
   Error: Resource already exists
   Solution: Check for naming conflicts or manual resource creation
   ```

### Debug Commands

```bash
# View CDK diff before deployment
npx cdk diff --context stageName=prod

# Synthesize CloudFormation template
npx cdk synth --context stageName=prod

# View stack events
aws cloudformation describe-stack-events --stack-name SmartParking-API-prod
```

## 📞 Support

For deployment issues:
1. Check CloudFormation stack events
2. Review CloudWatch logs
3. Verify AWS permissions
4. Contact the development team with error details

## 📋 Deployment Checklist

### Pre-deployment
- [ ] Code changes reviewed
- [ ] Tests passing
- [ ] Secrets configured
- [ ] Environment variables set
- [ ] Backup created (for production)

### During Deployment
- [ ] Monitor CloudFormation events
- [ ] Check for any errors or warnings
- [ ] Verify resource creation

### Post-deployment
- [ ] Run health checks
- [ ] Verify API endpoints
- [ ] Check monitoring dashboards
- [ ] Update documentation if needed