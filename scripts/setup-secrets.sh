#!/bin/bash

# Smart Parking Secrets Setup Script
# Usage: ./scripts/setup-secrets.sh [stage]

set -e

STAGE=${1:-dev}
PROFILE=${AWS_PROFILE:-default}

echo "🔐 Setting up secrets for Smart Parking - $STAGE"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --profile $PROFILE > /dev/null 2>&1; then
    echo "❌ Error: AWS CLI is not configured or credentials are invalid"
    echo "Please run 'aws configure' to set up your AWS credentials"
    echo ""
    echo "You'll need:"
    echo "- AWS Access Key ID"
    echo "- AWS Secret Access Key"
    echo "- Default region (e.g., us-east-1)"
    echo "- Default output format (json)"
    echo ""
    echo "If you don't have AWS credentials, you can:"
    echo "1. Create an AWS account at https://aws.amazon.com"
    echo "2. Create an IAM user with programmatic access"
    echo "3. Attach necessary permissions (or use AdministratorAccess for development)"
    exit 1
fi

# Function to create or update SSM parameter
create_or_update_parameter() {
    local name=$1
    local value=$2
    local description=$3
    
    echo "Creating/updating parameter: $name"
    
    if aws ssm get-parameter --name "$name" --profile $PROFILE > /dev/null 2>&1; then
        echo "Updating existing parameter: $name"
        aws ssm put-parameter \
            --name "$name" \
            --value "$value" \
            --type "SecureString" \
            --description "$description" \
            --overwrite \
            --profile $PROFILE
    else
        echo "Creating new parameter: $name"
        aws ssm put-parameter \
            --name "$name" \
            --value "$value" \
            --type "SecureString" \
            --description "$description" \
            --profile $PROFILE
    fi
}

# Flutterwave Secret Key
echo "Enter your Flutterwave secret key (or press Enter for test key):"
read -s FLUTTERWAVE_SECRET
if [[ -z "$FLUTTERWAVE_SECRET" ]]; then
    FLUTTERWAVE_SECRET="FLWSECK_TEST-your-test-key-here"
    echo "Using test Flutterwave key for development"
fi

create_or_update_parameter \
    "/smartparking/$STAGE/flutterwave-secret-key" \
    "$FLUTTERWAVE_SECRET" \
    "Flutterwave secret key for $STAGE environment"

# Webhook Secret
echo "Enter webhook secret (or press Enter to generate one):"
read -s WEBHOOK_SECRET
if [[ -z "$WEBHOOK_SECRET" ]]; then
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    echo "Generated webhook secret: $WEBHOOK_SECRET"
fi

create_or_update_parameter \
    "/smartparking/$STAGE/webhook-secret" \
    "$WEBHOOK_SECRET" \
    "Webhook secret for $STAGE environment"

echo "✅ Secrets setup completed successfully!"
echo "🔍 You can view the parameters in AWS Systems Manager Parameter Store"