#!/bin/bash

# Smart Parking Deployment Script
# Usage: ./scripts/deploy.sh [stage] [region]

set -e

# Default values
STAGE=${1:-dev}
REGION=${2:-us-east-1}
PROFILE=${AWS_PROFILE:-default}

echo "🚀 Deploying Smart Parking Application"
echo "Stage: $STAGE"
echo "Region: $REGION"
echo "AWS Profile: $PROFILE"

# Validate stage
if [[ ! "$STAGE" =~ ^(dev|staging|prod)$ ]]; then
    echo "❌ Error: Stage must be one of: dev, staging, prod"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "❌ Error: AWS CDK is not installed"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

# Check AWS credentials
echo "🔍 Checking AWS credentials..."
if ! aws sts get-caller-identity --profile $PROFILE > /dev/null 2>&1; then
    echo "❌ Error: Invalid AWS credentials for profile $PROFILE"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm test

# Create SSM parameters if they don't exist (for non-prod environments)
if [[ "$STAGE" != "prod" ]]; then
    echo "🔐 Setting up SSM parameters for $STAGE..."
    
    # Check if Flutterwave secret exists
    if ! aws ssm get-parameter --name "/smartparking/$STAGE/flutterwave-secret-key" --profile $PROFILE > /dev/null 2>&1; then
        echo "Creating Flutterwave secret parameter..."
        aws ssm put-parameter \
            --name "/smartparking/$STAGE/flutterwave-secret-key" \
            --value "FLWSECK_TEST-your-test-key-here" \
            --type "SecureString" \
            --description "Flutterwave secret key for $STAGE environment" \
            --profile $PROFILE
    fi
    
    # Check if webhook secret exists
    if ! aws ssm get-parameter --name "/smartparking/$STAGE/webhook-secret" --profile $PROFILE > /dev/null 2>&1; then
        echo "Creating webhook secret parameter..."
        aws ssm put-parameter \
            --name "/smartparking/$STAGE/webhook-secret" \
            --value "$(openssl rand -hex 32)" \
            --type "SecureString" \
            --description "Webhook secret for $STAGE environment" \
            --profile $PROFILE
    fi
fi

# Bootstrap CDK (if needed)
echo "🏗️  Bootstrapping CDK..."
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)/$REGION \
    --profile $PROFILE \
    --context stageName=$STAGE

# Deploy stacks
echo "🚀 Deploying CDK stacks..."
cdk deploy --all \
    --require-approval never \
    --profile $PROFILE \
    --context stageName=$STAGE \
    --outputs-file cdk-outputs-$STAGE.json

echo "✅ Deployment completed successfully!"
echo "📄 Outputs saved to: cdk-outputs-$STAGE.json"

# Display API URL
if [[ -f "cdk-outputs-$STAGE.json" ]]; then
    API_URL=$(cat cdk-outputs-$STAGE.json | jq -r '.["SmartParking-API-'$STAGE'"].ApiUrl // empty')
    if [[ -n "$API_URL" ]]; then
        echo "🌐 API URL: $API_URL"
    fi
fi

echo "🎉 Smart Parking deployment complete!"